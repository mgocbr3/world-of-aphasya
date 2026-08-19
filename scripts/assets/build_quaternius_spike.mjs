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
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const packRoot = process.argv[2];
const outPath = process.argv[3];
if (!packRoot || !outPath) {
  console.error('usage: build_quaternius_spike.mjs <packRoot> <outGlb>');
  process.exit(1);
}

// The free tier ships two kits (Ranger, Peasant); Ranger is the one that reads
// as an adventurer next to our town cast, so it is the spike's subject.
const OUTFIT = 'Male_Ranger';

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
// The kit's tunic tops out at 1.60 and its hood spans 1.53 to 1.87, so a cut
// here leaves no gap at the collar and no seam in view.
const NECK_CUT_Y = 1.6;

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
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

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
const bodyPath = findFile(join(packRoot, 'ubc'), 'Superhero_Male_FullBody.gltf');
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
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }),
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
  }),
);
