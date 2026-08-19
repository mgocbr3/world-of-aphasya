// Spike exporter: compose one Quaternius humanoid (Universal Base Characters
// body + a Modular Character Outfits - Fantasy kit + the Universal Animation
// Library clips) into a single game-ready GLB, so the renderer can draw a
// Quaternius-proportioned character beside the shipped KayKit chibi rigs.
//
// This is a THROWAWAY comparison build for the spike/quaternius-characters
// branch, not a pipeline: it exists to answer one direction question (does the
// heroic-proportion cast read better against the town kit?) with a real frame
// instead of a mockup. Nothing in src/ imports it.
//
// All three source packs are CC0 (Quaternius). Source zips are downloaded to a
// scratch dir and are NOT committed; this script names what it consumed so the
// build is reproducible from the pack pages.
//
// Usage:
//   node scripts/assets/build_quaternius_spike.mjs <packRoot> public/models/chars/players/spike/quaternius_ranger.glb
// where packRoot holds the extracted ubc/, outfits/, ual1/, ual2/ folders.

import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  mergeDocuments,
  meshopt,
  prune,
  resample,
  textureCompress,
} from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import {
  buildNearestIndex,
  invertMat4,
  transformDirection,
  transformPoint,
} from './lib/skin_weight_transfer.mjs';

// Where a skinned armour piece is anchored before its weights are transferred:
// the upper spine, with a small forward lift so the plate sits on the chest
// rather than inside it. Only the placement uses this; once weights are copied
// the piece follows the whole rig, shoulders included.
const ARMOR_BONE = 'spine_03';
const ARMOR_OFFSET = [0, 0.06, 0.02];

const packRoot = process.argv[2];
const outPath = process.argv[3];
if (!packRoot || !outPath) {
  console.error('usage: build_quaternius_spike.mjs <packRoot> <outGlb>');
  process.exit(1);
}

// The free tier ships two kits (Ranger, Peasant) in both genders. All four are
// built so the town can be repopulated end to end: judging one stranger among
// chibi townsfolk says nothing about how the world reads when the whole cast
// shares a proportion language.
const OUTFIT = process.argv[4] ?? 'Male_Ranger';
const FEMALE = OUTFIT.startsWith('Female');
const BODY = FEMALE ? 'Superhero_Female_FullBody' : 'Superhero_Male_FullBody';
// An optional replacement head (--head <glb>), for racial variety. The body,
// the kit, the rig and all 84 clips stay exactly as they are: only the head
// changes, which is where a fantasy race actually reads. An unrigged head is
// bound by the same nearest-vertex weight transfer the armour used, restricted
// to the neck and skull donors, so it follows the head bone like the original.
const HEAD_OVERRIDE = argFlag('--head');
function argFlag(name) {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : null;
}
// Hair per kit, from the free tier's eight styles. The hooded ranger takes a
// short cut that reads under a hood; the bare-headed peasant takes a fuller one
// because it is the whole silhouette of the head. Brows come from the body
// merge already, so only hair and beard are named here.
const HAIR = FEMALE
  ? ['Hair_Long']
  : OUTFIT.endsWith('Peasant')
    ? ['Hair_SimpleParted', 'Hair_Beard']
    : ['Hair_Buzzed', 'Hair_Beard'];

// The Base Characters glTF references two textures under names the pack does
// not actually ship (`T_Hair_1_Normal_png.png` for `T_Hair_1_Normal.png`, same
// for the eye normal): an export bug on their side, fatal to any strict glTF
// reader. Materialize the missing aliases beside the real files rather than
// rewriting the glTF, so the pack stays byte-identical to what was downloaded.
function healPackTextureNames(gltfPath) {
  const dir = dirname(gltfPath);
  const gltf = JSON.parse(readFileSync(gltfPath, 'utf8'));
  for (const image of gltf.images ?? []) {
    const uri = image.uri ? decodeURIComponent(image.uri) : null;
    if (!uri || existsSync(join(dir, uri))) continue;
    const real = uri.replace(/_png\.png$/, '.png');
    if (real !== uri && existsSync(join(dir, real))) copyFileSync(join(dir, real), join(dir, uri));
  }
}

// Bind-pose height, in the pack's own units, of the cut between head and torso.
// Deliberately BELOW the collarbone rather than at the jaw: a cut at the neck
// line takes the neck with it and leaves a head floating over the collar, which
// is worse than the torso overlap it avoids (direction call: "nao pode tirar o
// pescoco, fica feio"). The kit's tunic spans 0.91 to 1.60 and its hood 1.53 to
// 1.87, so everything kept below the chin sits inside collar and hood.
const NECK_CUT_Y = 1.48;

/**
 * Keep only the triangles fully above `cutY`, rewriting every vertex attribute
 * so the result carries no orphan vertices. Operates per primitive and in place
 * on the mesh. Skinning survives untouched: JOINTS_0/WEIGHTS_0 travel with
 * their vertex, so the kept cap stays bound to the same neck and head bones.
 */
function keepAbove(mesh, cutY) {
  for (const prim of mesh.listPrimitives()) {
    const position = prim.getAttribute('POSITION');
    const indices = prim.getIndices();
    if (!position || !indices) continue;
    const kept = [];
    const remap = new Map();
    const vertex = [0, 0, 0];
    for (let i = 0; i < indices.getCount(); i += 3) {
      const tri = [indices.getScalar(i), indices.getScalar(i + 1), indices.getScalar(i + 2)];
      if (!tri.every((v) => position.getElement(v, vertex) && vertex[1] >= cutY)) continue;
      for (const v of tri) {
        if (!remap.has(v)) remap.set(v, remap.size);
        kept.push(remap.get(v));
      }
    }
    if (kept.length === 0 || remap.size === 0) {
      prim.dispose();
      continue;
    }
    const order = [...remap.entries()].sort((a, b) => a[1] - b[1]).map(([old]) => old);
    for (const semantic of prim.listSemantics()) {
      const src = prim.getAttribute(semantic);
      const stride = src.getElementSize();
      const Ctor = src.getArray().constructor;
      const dst = doc
        .createAccessor()
        .setType(src.getType())
        .setNormalized(src.getNormalized())
        .setArray(new Ctor(order.length * stride));
      const element = new Array(stride).fill(0);
      order.forEach((old, next) => {
        src.getElement(old, element);
        dst.setElement(next, element);
      });
      prim.setAttribute(semantic, dst);
    }
    prim.setIndices(doc.createAccessor().setArray(new Uint32Array(kept)));
  }
}

function findFile(root, name) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === name) return full;
    }
  }
  return null;
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const outfitPath = findFile(join(packRoot, 'outfits'), `${OUTFIT}.gltf`);
if (!outfitPath) throw new Error(`outfit ${OUTFIT}.gltf not found under ${packRoot}/outfits`);

const doc = await io.read(outfitPath);
const root = doc.getRoot();

// The outfit kits are GARMENTS, not characters: a kit ships the tunic, the
// sleeves, the trousers, the boots and the hood, and the body wearing them
// (head included) comes from the Universal Base Characters pack. Composing the
// kit alone is what shipped an empty hood on the first build of this spike.
//
// Only the HEAD is taken from that body. The kit already carries every scrap of
// skin it needs (bare hands, the neck line), and the free tier ships Superhero
// proportions while the kits are fitted to Regular, so a whole base body reads
// as a bulkier torso bursting through its own tunic. Cutting at the neck keeps
// the face, drops about 10k triangles of hidden torso, and the hood covers the
// seam.
//
// Both packs export the same 65-bone humanoid in the SAME joint order (asserted
// below, because a silent order mismatch would skin the body to the wrong bones
// rather than fail), so the base body can be merged in and pointed at the
// outfit's own skin with no index remap and no retarget.
const bodyPath = findFile(join(packRoot, 'ubc'), `${BODY}.gltf`);
if (!bodyPath) throw new Error(`base body not found under ${packRoot}/ubc`);
healPackTextureNames(bodyPath);
const bodyDoc = await io.read(bodyPath);

const outfitSkin = root.listSkins()[0];
const bodySkin = bodyDoc.getRoot().listSkins()[0];
if (!outfitSkin || !bodySkin) throw new Error('expected a skin in both the outfit and the body');
const outfitJoints = outfitSkin.listJoints().map((j) => j.getName());
const bodyJoints = bodySkin.listJoints().map((j) => j.getName());
if (outfitJoints.length !== bodyJoints.length || outfitJoints.some((n, i) => n !== bodyJoints[i])) {
  throw new Error('outfit and base body disagree on joint order; a JOINTS_0 remap would be needed');
}

const bodyScene = bodyDoc.getRoot().getDefaultScene() ?? bodyDoc.getRoot().listScenes()[0];
const bodyMeshNodes = [];
bodyScene?.traverse((node) => {
  if (node.getMesh()) bodyMeshNodes.push(node);
});
const map = mergeDocuments(doc, bodyDoc);
const scene = root.getDefaultScene() ?? root.listScenes()[0];
const adopted = new Set();
for (const sourceNode of bodyMeshNodes) {
  const node = map.get(sourceNode);
  if (!node) continue;
  adopted.add(node);
  // Take the mesh OUT of the merged hierarchy before adopting it: the merge
  // brings the body's own copy of the 65-bone skeleton along, and three binds
  // animation tracks by node NAME, so a second node called "pelvis" in the file
  // silently captures the tracks and the whole character holds bind pose (the
  // T-pose this spike shipped once). Re-skin to the outfit's rig, reparent onto
  // the outfit's scene, then drop the merged scene so prune() can collect the
  // duplicate bones with it.
  node.getParentNode()?.removeChild(node);
  if (node.getSkin()) node.setSkin(outfitSkin);
  scene?.addChild(node);
  // The eyes and brows are already head-only; the body mesh is the whole figure
  // and gets cut down to its head.
  // Identify the figure by its EXTENT, not its name: the pack exports the body
  // under a sculpting leftover ("Sphere.005_Retopology.004") while the eyes and
  // brows are already head-height, so anything reaching below the waist is the
  // mesh to cut.
  const mesh = node.getMesh();
  const lowest = Math.min(
    ...mesh
      .listPrimitives()
      .map((prim) => prim.getAttribute('POSITION')?.getMin([])[1] ?? Number.POSITIVE_INFINITY),
  );
  if (lowest < NECK_CUT_Y - 0.5) keepAbove(mesh, NECK_CUT_Y);
}
// Everything else the merge produced goes, explicitly: prune() will not collect
// an orphaned bone hierarchy (the nodes are still linked to each other and to
// their skins), and leaving it behind is what shadows the real skeleton by name.
// Disposing through the map covers the merged scene, its skins and all 65
// duplicate joints without guessing at names.
for (const sourceProp of [
  ...bodyDoc.getRoot().listNodes(),
  ...bodyDoc.getRoot().listScenes(),
  ...bodyDoc.getRoot().listSkins(),
]) {
  const merged = map.get(sourceProp);
  if (merged && !adopted.has(merged)) merged.dispose();
}

// Swap in a generated racial head, if one was named. The trick that makes this
// cheap: the pack's own head is merged FIRST and used as the weight DONOR, then
// discarded. Its vertices carry the artist's authored head and neck weights, so
// a generated head inherits exactly the binding the original had, and nothing
// about the body, the kit, the rig or the 84 clips changes. Race reads through
// the skull it swaps in.
let headStats = null;
if (HEAD_OVERRIDE) {
  // Bounds of the head already in the scene: the target the new one matches, so
  // a generated head lands at the pack's own scale instead of needing a magic
  // number per file.
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  const donorPos = [];
  const donorJoints = [];
  const donorWeights = [];
  for (const node of adopted) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      const jointsAttr = prim.getAttribute('JOINTS_0');
      const weightsAttr = prim.getAttribute('WEIGHTS_0');
      if (!position || !jointsAttr || !weightsAttr) continue;
      const p = [0, 0, 0];
      const j = [0, 0, 0, 0];
      const w = [0, 0, 0, 0];
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, p);
        jointsAttr.getElement(i, j);
        weightsAttr.getElement(i, w);
        // Bounds come from the vertices actually read, not the accessor's
        // cached min/max: those go stale the moment a primitive is rewritten.
        lo = lo.map((v, k) => Math.min(v, p[k]));
        hi = hi.map((v, k) => Math.max(v, p[k]));
        donorPos.push(p[0], p[1], p[2]);
        donorJoints.push(j[0], j[1], j[2], j[3]);
        donorWeights.push(w[0], w[1], w[2], w[3]);
      }
    }
  }
  if (donorPos.length === 0) throw new Error('no donor head in the scene to bind against');
  const nearest = buildNearestIndex(donorPos);

  const headDoc = await io.read(HEAD_OVERRIDE);
  const headRoot = headDoc.getRoot();
  // Measure the incoming head so it can be fitted to the donor's box. Meshy
  // exports land at whatever size and offset the generator chose.
  let hlo = [Infinity, Infinity, Infinity];
  let hhi = [-Infinity, -Infinity, -Infinity];
  for (const mesh of headRoot.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      if (!position) continue;
      const v = [0, 0, 0];
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, v);
        hlo = hlo.map((x, k) => Math.min(x, v[k]));
        hhi = hhi.map((x, k) => Math.max(x, v[k]));
      }
    }
  }
  const fit = hhi[1] - hlo[1] > 1e-6 ? (hi[1] - lo[1]) / (hhi[1] - hlo[1]) : 1;

  const headScene = headRoot.getDefaultScene() ?? headRoot.listScenes()[0];
  const headNodes = [];
  headScene?.traverse((node) => {
    if (node.getMesh()) headNodes.push(node);
  });
  const headMap = mergeDocuments(doc, headDoc);
  const keptHead = new Set();
  let headVertices = 0;
  for (const sourceNode of headNodes) {
    const node = headMap.get(sourceNode);
    if (!node) continue;
    keptHead.add(node);
    node.getParentNode()?.removeChild(node);
    for (const prim of node.getMesh().listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      const count = position.getCount();
      const jointArray = new Uint16Array(count * 4);
      const weightArray = new Float32Array(count * 4);
      const p = [0, 0, 0];
      for (let i = 0; i < count; i++) {
        position.getElement(i, p);
        // Fit to the donor box: uniform scale on height, centred on x and z,
        // base seated at the donor's own base so the neck meets the collar.
        const fitted = [
          (p[0] - (hhi[0] + hlo[0]) / 2) * fit + (hi[0] + lo[0]) / 2,
          (p[1] - hlo[1]) * fit + lo[1],
          (p[2] - (hhi[2] + hlo[2]) / 2) * fit + (hi[2] + lo[2]) / 2,
        ];
        position.setElement(i, fitted);
        const donor = nearest(fitted[0], fitted[1], fitted[2]);
        for (let k = 0; k < 4; k++) {
          jointArray[i * 4 + k] = donor >= 0 ? donorJoints[donor * 4 + k] : 0;
          weightArray[i * 4 + k] = donor >= 0 ? donorWeights[donor * 4 + k] : k === 0 ? 1 : 0;
        }
      }
      position.setArray(position.getArray());
      prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(jointArray));
      prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(weightArray));
      headVertices += count;
    }
    node.setSkin(outfitSkin);
    // Name it, because a generated export usually arrives anonymous and an
    // unnamed mesh is invisible in every later inspection.
    node.setName('racial_head');
    node.getMesh().setName('racial_head');
    scene?.addChild(node);
  }
  for (const sourceProp of [
    ...headRoot.listNodes(),
    ...headRoot.listScenes(),
    ...headRoot.listSkins(),
  ]) {
    const merged = headMap.get(sourceProp);
    if (merged && !keptHead.has(merged)) merged.dispose();
  }
  // The pack head has done its job as donor and now goes, or the two would
  // occupy the same skull.
  for (const node of adopted) node.dispose();
  headStats = { donors: donorPos.length / 3, headVertices, fitScale: +fit.toFixed(3) };
}

// Hair, and a beard where the kit suits one. Composing the head alone left
// every character bald, which the hood hides on a ranger and nothing hides on a
// peasant. These ship as their own skinned GLBs on the same 65-bone rig (the
// "Rigged to Head Bone" export), so they merge exactly like the body did: adopt
// the mesh, point it at the outfit's skin, drop the duplicate skeleton behind
// it. Note they are SKINNED, not parented to a bone, which is what lets long
// hair swing off the neck bones instead of rotating rigidly with the skull.
for (const style of HAIR) {
  const hairPath = findFile(join(packRoot, 'ubc'), `${style}.gltf`);
  if (!hairPath) throw new Error(`hair ${style}.gltf not found under ${packRoot}/ubc`);
  healPackTextureNames(hairPath);
  const hairDoc = await io.read(hairPath);
  const hairScene = hairDoc.getRoot().getDefaultScene() ?? hairDoc.getRoot().listScenes()[0];
  const hairNodes = [];
  hairScene?.traverse((node) => {
    if (node.getMesh()) hairNodes.push(node);
  });
  const hairMap = mergeDocuments(doc, hairDoc);
  const keep = new Set();
  for (const sourceNode of hairNodes) {
    const node = hairMap.get(sourceNode);
    if (!node) continue;
    keep.add(node);
    node.getParentNode()?.removeChild(node);
    if (node.getSkin()) node.setSkin(outfitSkin);
    scene?.addChild(node);
  }
  for (const sourceProp of [
    ...hairDoc.getRoot().listNodes(),
    ...hairDoc.getRoot().listScenes(),
    ...hairDoc.getRoot().listSkins(),
  ]) {
    const merged = hairMap.get(sourceProp);
    if (merged && !keep.has(merged)) merged.dispose();
  }
}

// Skin a generated armour piece INTO the body, if one was named. A prop bolted
// to a single bone is rigid, so a raised arm drives the pauldron straight
// through it; this makes the plate a real part of the character, deforming off
// the same weights the shoulder does. See lib/skin_weight_transfer.mjs for why
// nearest-vertex transfer beats distance-to-bone weighting at the shoulder.
// Positional, so it must not swallow a flag that follows the outfit name.
const ARMOR = process.argv[5]?.startsWith('--') ? null : process.argv[5];
let armorStats = null;
if (ARMOR) {
  const armorDoc = await io.read(ARMOR);
  const joints = outfitSkin.listJoints();
  const boneIndex = joints.findIndex((j) => j.getName() === ARMOR_BONE);
  if (boneIndex < 0) throw new Error(`armour anchor bone ${ARMOR_BONE} not in the rig`);
  const ibm = outfitSkin.getInverseBindMatrices();
  const bindWorld = invertMat4(ibm.getElement(boneIndex, new Array(16)));
  if (!bindWorld) throw new Error('inverse bind matrix for the anchor bone is singular');

  // Donor cloud: every skinned vertex of the character, already in bind space.
  const donorPos = [];
  const donorJoints = [];
  const donorWeights = [];
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      const jointsAttr = prim.getAttribute('JOINTS_0');
      const weightsAttr = prim.getAttribute('WEIGHTS_0');
      if (!position || !jointsAttr || !weightsAttr) continue;
      const p = [0, 0, 0];
      const j = [0, 0, 0, 0];
      const w = [0, 0, 0, 0];
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, p);
        jointsAttr.getElement(i, j);
        weightsAttr.getElement(i, w);
        donorPos.push(p[0], p[1], p[2]);
        donorJoints.push(j[0], j[1], j[2], j[3]);
        donorWeights.push(w[0], w[1], w[2], w[3]);
      }
    }
  }
  // Donors are restricted to the band the plate actually covers. Without this
  // the nearest vertex to the plate's lower rim is a thigh, so the skirt of the
  // armour follows the LEGS: the piece splays open at a walk and stretches to
  // the knees. A garment must only ever inherit from the part of the body it
  // sits on, and for a breastplate that is the torso band.
  const anchorY = bindWorld[13];
  const bandLo = anchorY - 0.42;
  const bandHi = anchorY + 0.55;
  const bandPos = [];
  const bandIndex = [];
  for (let i = 0; i < donorPos.length / 3; i++) {
    const y = donorPos[i * 3 + 1];
    if (y < bandLo || y > bandHi) continue;
    bandPos.push(donorPos[i * 3], y, donorPos[i * 3 + 2]);
    bandIndex.push(i);
  }
  const nearestInBand = buildNearestIndex(bandPos);
  const nearest = (x, y, z) => {
    const hit = nearestInBand(x, y, z);
    return hit >= 0 ? bandIndex[hit] : -1;
  };

  const armorMap = mergeDocuments(doc, armorDoc);
  const armorRoot = armorDoc.getRoot();
  const armorScene = armorRoot.getDefaultScene() ?? armorRoot.listScenes()[0];
  const armorNodes = [];
  armorScene?.traverse((node) => {
    if (node.getMesh()) armorNodes.push(node);
  });
  let vertexCount = 0;
  for (const sourceNode of armorNodes) {
    const node = armorMap.get(sourceNode);
    if (!node) continue;
    node.getParentNode()?.removeChild(node);
    for (const prim of node.getMesh().listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      const normal = prim.getAttribute('NORMAL');
      const count = position.getCount();
      const jointArray = new Uint16Array(count * 4);
      const weightArray = new Float32Array(count * 4);
      const p = [0, 0, 0];
      const n = [0, 0, 0];
      const world = [0, 0, 0];
      for (let i = 0; i < count; i++) {
        position.getElement(i, p);
        // Into bind space, through the anchor bone plus the authored offset.
        transformPoint(
          bindWorld,
          [p[0] + ARMOR_OFFSET[0], p[1] + ARMOR_OFFSET[1], p[2] + ARMOR_OFFSET[2]],
          world,
        );
        position.setElement(i, world);
        if (normal) {
          normal.getElement(i, n);
          normal.setElement(i, transformDirection(bindWorld, n, [0, 0, 0]));
        }
        const donor = nearest(world[0], world[1], world[2]);
        for (let k = 0; k < 4; k++) {
          jointArray[i * 4 + k] = donor >= 0 ? donorJoints[donor * 4 + k] : 0;
          weightArray[i * 4 + k] = donor >= 0 ? donorWeights[donor * 4 + k] : k === 0 ? 1 : 0;
        }
      }
      position.setArray(position.getArray());
      prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(jointArray));
      prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(weightArray));
      vertexCount += count;
    }
    node.setSkin(outfitSkin);
    scene?.addChild(node);
  }
  // Drop the leftovers the merge brought (its scene, and any node that is not
  // one of the mesh nodes just adopted), same rule as the base-body merge.
  const adoptedArmor = new Set(armorNodes.map((node) => armorMap.get(node)).filter(Boolean));
  for (const sourceProp of [...armorRoot.listNodes(), ...armorRoot.listScenes()]) {
    const merged = armorMap.get(sourceProp);
    if (merged && !adoptedArmor.has(merged)) merged.dispose();
  }
  armorStats = { donors: donorPos.length / 3, armorVertices: vertexCount };
}

// Kill the metal. The kits author a packed ORM map and leave metallicFactor at
// 1, so a fragment's metalness is whatever survives in the blue channel: fine
// in an offline renderer, wrong here twice over. The game ships its GLB
// textures KTX2/Basis, a luma-first codec that mangles packed non-colour maps,
// and a wet-looking metal sheen on cloth and leather reads as a bug against a
// stylized cast anyway (direction call: "muito reflexivo, muito metalico").
// Zeroing the factor makes the material codec-proof: cloth stays cloth however
// the blue channel is quantized. Buckles lose their metal too, a trade this
// spike happily takes.
for (const material of root.listMaterials()) {
  material.setMetallicFactor(0);
  material.setRoughnessFactor(Math.max(material.getRoughnessFactor(), 0.85));
}

// The animation libraries ride the same 65-bone humanoid rig as the outfits,
// so their clips bind by joint NAME with no retarget step. Copy every clip in
// (UAL1 carries locomotion, swim, death and the simple spell set; UAL2 carries
// the sword combos), skipping the T-pose reference and any name collision.
const clipSources = ['ual1', 'ual2'];
const jointNames = new Set(
  root
    .listSkins()
    .flatMap((skin) => skin.listJoints())
    .map((joint) => joint.getName()),
);
const boneByName = new Map();
for (const node of root.listNodes()) {
  if (jointNames.has(node.getName())) boneByName.set(node.getName(), node);
}

let copied = 0;
let skippedUnbound = 0;
for (const source of clipSources) {
  const dir = join(packRoot, source);
  if (!existsSync(dir)) continue;
  const glb = findFile(dir, source === 'ual1' ? 'UAL1_Standard.glb' : 'UAL2_Standard.glb');
  if (!glb) continue;
  const animDoc = await io.read(glb);
  const have = new Set(root.listAnimations().map((a) => a.getName()));
  for (const anim of animDoc.getRoot().listAnimations()) {
    const name = anim.getName();
    if (name === 'A_TPose' || have.has(name)) continue;
    const clip = doc.createAnimation(name);
    let bound = 0;
    for (const channel of anim.listChannels()) {
      const target = channel.getTargetNode();
      const bone = target ? boneByName.get(target.getName()) : null;
      if (!bone) continue;
      const src = channel.getSampler();
      if (!src) continue;
      const input = doc.createAccessor().setArray(src.getInput().getArray().slice());
      const output = doc.createAccessor().setArray(src.getOutput().getArray().slice());
      output.setType(src.getOutput().getType());
      const sampler = doc
        .createAnimationSampler()
        .setInput(input)
        .setOutput(output)
        .setInterpolation(src.getInterpolation());
      clip.addSampler(sampler);
      clip.addChannel(
        doc
          .createAnimationChannel()
          .setTargetNode(bone)
          .setTargetPath(channel.getTargetPath())
          .setSampler(sampler),
      );
      bound += 1;
    }
    if (bound === 0) {
      clip.dispose();
      skippedUnbound += 1;
      continue;
    }
    copied += 1;
  }
}

// A merge brings the source document's own buffer along, and a GLB may hold at
// most one: point every accessor at the first buffer before writing.
const primaryBuffer = root.listBuffers()[0];
for (const accessor of root.listAccessors()) accessor.setBuffer(primaryBuffer);
for (const buffer of root.listBuffers().slice(1)) buffer.dispose();

await doc.transform(
  resample(),
  dedup(),
  prune(),
  // 512 rather than 1024: textures, not geometry, are what make these bodies
  // heavy (four of them came to 28 MB), and a character seen from the game's
  // chase camera never resolves a 1024 atlas. The kits paint flat colour blocks
  // with almost no fine detail, so the halving is close to free visually and
  // takes the set to roughly a quarter of its size.
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512] }),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);

await mkdir(dirname(outPath), { recursive: true });
await io.write(outPath, doc);

const tris = root
  .listMeshes()
  .flatMap((mesh) => mesh.listPrimitives())
  .reduce((sum, prim) => {
    const indices = prim.getIndices();
    const count = indices ? indices.getCount() : (prim.getAttribute('POSITION')?.getCount() ?? 0);
    return sum + count / 3;
  }, 0);

console.log(
  JSON.stringify({
    out: outPath,
    outfit: OUTFIT,
    triangles: Math.round(tris),
    joints: root.listSkins()[0]?.listJoints().length ?? 0,
    animations: root.listAnimations().length,
    clipsCopied: copied,
    clipsSkippedUnbound: skippedUnbound,
    armor: armorStats,
    head: headStats,
  }),
);
