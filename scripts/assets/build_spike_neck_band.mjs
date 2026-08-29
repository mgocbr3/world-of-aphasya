// Restore the NECK to a headless spike body, from the geometry it used to have.
//
// The headless bodies (build_quaternius_spike.mjs --headless) discard the whole
// Universal Base Characters merge, neck included, and the racial head asset is
// cut at the neck line (HEAD_ASSET_CUT_Y, above the collar) so a rigid
// attachment does not carry shoulders that swing when the head turns. Between
// the two cuts nothing is left: the head floats over the collar with a visible
// gap, worst on the open-scooped peasant tunic (direction: "precisa arrumar os
// pescocos").
//
// The right geometry for that gap already exists: the pre-headless bodies baked
// the pack's own head cut BELOW the collarbone, and those files are in git.
// This tool cuts the neck BAND back out of a baked body and welds it into the
// shipped headless one:
//
//   band = baked head mesh  MINUS  the triangles the head ASSET kept
//
// computed by matching triangle centroids in bind-pose space, because both
// files quantize the same source triangles into different integer frames and
// no shared cut plane exists after that. The complement is exact by
// construction: the head asset kept exactly the triangles fully above its cut,
// so what it did not keep is exactly the collar ring plus every triangle the
// cut crossed, which is the jagged edge the screenshots show.
//
// The band stays SKINNED. Its vertices, weights and inverse bind matrices are
// carried over from the baked file untouched (meshopt folds each mesh's
// dequantization scale into its skin's IBMs, so raw data and IBMs must travel
// together), and only the skin's JOINT REFERENCES are remapped, by bone name,
// onto the headless file's live skeleton. The neck therefore deforms with
// neck_01/Head exactly as it did when it was part of the baked body, and the
// bone-scale proportion axes reach it for free.
//
// Two modes, because the two genders are two different sculpts:
//
//   MALE  (centroid mode): the shipped head asset came from this same skull, so
//   the complement is computed by matching triangle centroids against it, and a
//   full match (2600 of 2600) is the proof the band is exact.
//
//   FEMALE (--emit-head): the shipped asset was the MALE skull, which the
//   female body was wearing by omission. Here the female's own baked skull is
//   cut by the same plane the male asset used (y = 1.58; file units equal pack
//   units, measured: the male skull's baked cut sits at 1.4801 and the male
//   asset's bottom at 1.5808), the part above the plane is emitted as her own
//   head asset (skull + eyes + brows, carried into head-bone space), and the
//   band is the rest of the same mesh, which makes the complement exact by
//   construction.
//
// Usage:
//   node scripts/assets/build_spike_neck_band.mjs <bakedGlb> <headlessGlb> <headAssetGlb> <outGlb>
//   node scripts/assets/build_spike_neck_band.mjs <bakedGlb> <headlessGlb> - <outGlb> --emit-head <headOut>
//
// The baked inputs come from git (the last pre-headless commit):
//   git show <sha>:public/models/chars/players/spike/<body>.glb > baked.glb

import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { invertMat4 } from './lib/skin_weight_transfer.mjs';

const [bakedPath, headlessPath, headAssetPath, outPath] = process.argv.slice(2);
const emitHeadAt = process.argv.indexOf('--emit-head');
const EMIT_HEAD_OUT = emitHeadAt >= 0 ? process.argv[emitHeadAt + 1] : null;
// '-' for the head asset selects PLANE mode (cut at HEAD_ASSET_CUT_Y instead of
// matching an existing asset); --emit-head additionally writes this body's own
// head asset, and only makes sense in plane mode.
const PLANE_MODE = process.argv[4] === '-';
if (EMIT_HEAD_OUT && !PLANE_MODE) {
  console.error('--emit-head requires plane mode (pass - for the head asset)');
  process.exit(1);
}
// The plane the male head asset was cut at, in pack units, which the shipped
// files preserve (see the header measurement).
const HEAD_ASSET_CUT_Y = 1.58;
if (!bakedPath || !headlessPath || !headAssetPath || !outPath) {
  console.error(
    'usage: build_spike_neck_band.mjs <bakedGlb> <headlessGlb> <headAssetGlb|-> <outGlb> [--emit-head <headOut>]',
  );
  process.exit(1);
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// --- tiny column-major mat4 kit (glTF layout) -------------------------------

function mat4Multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

function mat4Point(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

function worldMatrixOf(node) {
  let m = node.getMatrix();
  for (let p = node.getParentNode(); p; p = p.getParentNode()) {
    m = mat4Multiply(p.getMatrix(), m);
  }
  return m;
}

// --- accessor readers (the shipped files are meshopt-quantized) -------------

/** Element i of `accessor`. getElement already denormalizes KHR_mesh_
 *  quantization storage to floats; this wrapper only exists to say so, because
 *  dividing again by the integer range is the silent way to collapse a mesh to
 *  a point. */
function readElement(accessor, i, out) {
  return accessor.getElement(i, out);
}

/** Bind-pose positions of one SKINNED primitive, resolved through its skin:
 *  meshopt folds each mesh's dequant scale into the IBMs, so the only frame in
 *  which two meshes agree is the skinned bind pose, J * IBM * v summed by
 *  weight. */
function skinnedBindPositions(prim, skin) {
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const jointMats = joints.map((joint, j) =>
    mat4Multiply(worldMatrixOf(joint), ibm.getElement(j, new Array(16))),
  );
  const pos = prim.getAttribute('POSITION');
  const jnt = prim.getAttribute('JOINTS_0');
  const wgt = prim.getAttribute('WEIGHTS_0');
  if (!pos || !jnt || !wgt) throw new Error('primitive is not skinned');
  const count = pos.getCount();
  const out = new Float64Array(count * 3);
  const v = [0, 0, 0];
  const j4 = [0, 0, 0, 0];
  const w4 = [0, 0, 0, 0];
  for (let i = 0; i < count; i++) {
    readElement(pos, i, v);
    jnt.getElement(i, j4);
    readElement(wgt, i, w4);
    let x = 0;
    let y = 0;
    let z = 0;
    let wsum = 0;
    for (let k = 0; k < 4; k++) {
      const w = w4[k];
      if (w <= 0) continue;
      const p = mat4Point(jointMats[j4[k]], v);
      x += p[0] * w;
      y += p[1] * w;
      z += p[2] * w;
      wsum += w;
    }
    // Quantized weights can sum to slightly under 1; renormalize like a GPU.
    const inv = wsum > 0 ? 1 / wsum : 0;
    out[i * 3] = x * inv;
    out[i * 3 + 1] = y * inv;
    out[i * 3 + 2] = z * inv;
  }
  return out;
}

/** Model-space positions of one RIGID primitive: node TRS carries the dequant. */
function rigidPositions(prim, node) {
  const world = worldMatrixOf(node);
  const pos = prim.getAttribute('POSITION');
  const count = pos.getCount();
  const out = new Float64Array(count * 3);
  const v = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    readElement(pos, i, v);
    const p = mat4Point(world, v);
    out[i * 3] = p[0];
    out[i * 3 + 1] = p[1];
    out[i * 3 + 2] = p[2];
  }
  return out;
}

// --- triangle centroid matching ---------------------------------------------

const GRID = 2e-3; // metres; quantization error is ~1e-4, adjacent centroids ~7e-3

function centroidKeys(positions, indices) {
  const cx =
    (positions[indices[0] * 3] + positions[indices[1] * 3] + positions[indices[2] * 3]) / 3;
  const cy =
    (positions[indices[0] * 3 + 1] +
      positions[indices[1] * 3 + 1] +
      positions[indices[2] * 3 + 1]) /
    3;
  const cz =
    (positions[indices[0] * 3 + 2] +
      positions[indices[1] * 3 + 2] +
      positions[indices[2] * 3 + 2]) /
    3;
  return {
    cx,
    cy,
    cz,
    key: `${Math.round(cx / GRID)},${Math.round(cy / GRID)},${Math.round(cz / GRID)}`,
  };
}

/** All 27 grid keys around a centroid, so a centroid on a cell edge still
 *  matches its twin rounded into the neighbouring cell. */
function neighbourKeys(cx, cy, cz) {
  const keys = [];
  const gx = Math.round(cx / GRID);
  const gy = Math.round(cy / GRID);
  const gz = Math.round(cz / GRID);
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) keys.push(`${gx + dx},${gy + dy},${gz + dz}`);
  return keys;
}

/** Rebuild one primitive over only the triangles `keepTri(i0,i1,i2)` accepts,
 *  optionally dropping attributes by semantic and rewriting others through
 *  `rewrite(semantic, element, vertexIndex)`. Attributes are cloned so the
 *  original accessors (possibly shared) are never written through. */
function rebuildPrimitive(prim, keepTri, { drop = [], rewrite = null } = {}) {
  const indices = prim.getIndices();
  const keptTris = [];
  for (let i = 0; i < indices.getCount(); i += 3) {
    const tri = [indices.getScalar(i), indices.getScalar(i + 1), indices.getScalar(i + 2)];
    if (keepTri(tri)) keptTris.push(tri);
  }
  const remap = new Map();
  const newIndices = [];
  for (const tri of keptTris) {
    for (const v of tri) {
      if (!remap.has(v)) remap.set(v, remap.size);
      newIndices.push(remap.get(v));
    }
  }
  const order = [...remap.keys()];
  for (const semantic of prim.listSemantics()) {
    const src = prim.getAttribute(semantic);
    if (drop.includes(semantic)) {
      prim.setAttribute(semantic, null);
      continue;
    }
    const dst = src.clone();
    const size = src.getElementSize();
    if (rewrite && (semantic === 'POSITION' || semantic === 'NORMAL')) {
      // Rewritten geometry is absolute float data; the quantized storage type
      // it arrived in belongs to the OLD frame (meshopt folded that frame's
      // scale into the skin, which the rewrite just removed).
      const el = new Array(size);
      const out = [];
      for (const v of order) {
        src.getElement(v, el);
        rewrite(semantic, el, v);
        out.push(...el);
      }
      dst.setArray(new Float32Array(out));
      dst.setNormalized(false);
    } else {
      // Copy the RAW storage, never getElement: getElement denormalizes
      // quantized attributes to floats, and stuffing those floats back into the
      // integer array truncates every value to zero. That silent collapse is a
      // neck that never draws and a texture sampled at one corner texel.
      const raw = src.getArray();
      const Ctor = raw.constructor;
      const out = new Ctor(order.length * size);
      for (let i = 0; i < order.length; i++) {
        out.set(raw.subarray(order[i] * size, order[i] * size + size), i * size);
      }
      dst.setArray(out);
    }
    prim.setAttribute(semantic, dst);
  }
  const idx = indices.clone();
  idx.setArray(remap.size <= 65535 ? new Uint16Array(newIndices) : new Uint32Array(newIndices));
  prim.setIndices(idx);
  return keptTris.length;
}

/** The per-vertex skinning matrices of one primitive, for rewriting geometry
 *  out of its quantized frame: matrix i is Sum(w_k * J_k * IBM_k). */
function skinningMatrices(prim, skin) {
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const jointMats = joints.map((joint, j) =>
    mat4Multiply(worldMatrixOf(joint), ibm.getElement(j, new Array(16))),
  );
  const jnt = prim.getAttribute('JOINTS_0');
  const wgt = prim.getAttribute('WEIGHTS_0');
  const count = jnt.getCount();
  const out = [];
  const j4 = [0, 0, 0, 0];
  const w4 = [0, 0, 0, 0];
  for (let i = 0; i < count; i++) {
    jnt.getElement(i, j4);
    readElement(wgt, i, w4);
    const m = new Array(16).fill(0);
    let wsum = 0;
    for (let k = 0; k < 4; k++) wsum += Math.max(w4[k], 0);
    const inv = wsum > 0 ? 1 / wsum : 0;
    for (let k = 0; k < 4; k++) {
      const w = w4[k] * inv;
      if (w <= 0) continue;
      const jm = jointMats[j4[k]];
      for (let c = 0; c < 16; c++) m[c] += jm[c] * w;
    }
    out.push(m);
  }
  return out;
}

function mat4Direction(m, d) {
  return [
    m[0] * d[0] + m[4] * d[1] + m[8] * d[2],
    m[1] * d[0] + m[5] * d[1] + m[9] * d[2],
    m[2] * d[0] + m[6] * d[1] + m[10] * d[2],
  ];
}

/** The normal matrix for a point transform: transpose(inverse(m)). */
function invTranspose(m) {
  const inv = invertMat4(m);
  const t = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) t[c * 4 + r] = inv[r * 4 + c];
  return t;
}

// --- main --------------------------------------------------------------------

const baked = await io.read(bakedPath);
const headless = await io.read(headlessPath);
const headAsset = PLANE_MODE ? null : await io.read(headAssetPath);

// The baked body's own head mesh, by the name the exporter gave it.
const bakedHeadMatches = baked
  .getRoot()
  .listNodes()
  .filter((n) => /^superhero/i.test(n.getName()) && n.getMesh() && n.getSkin());
if (bakedHeadMatches.length !== 1) {
  throw new Error(
    `expected exactly one SuperHero head mesh in the baked body, found ${bakedHeadMatches.length}`,
  );
}
const bakedHead = bakedHeadMatches[0];

// The head ASSET's skull mesh (its eyes and brows sit far above the cut and
// carry no collar triangles, so only the skull participates in the match).
const assetSkullMatches =
  headAsset
    ?.getRoot()
    .listNodes()
    .filter((n) => /^superhero/i.test(n.getName()) && n.getMesh()) ?? [];
if (headAsset && assetSkullMatches.length !== 1) {
  throw new Error(
    `expected exactly one SuperHero skull in the head asset, found ${assetSkullMatches.length}`,
  );
}
const assetSkull = assetSkullMatches[0] ?? null;

// The head asset lives in HEAD-BONE space; carry it into body space through
// the bind-pose world matrix of the Head bone. The headless skeleton is the
// one it will actually ride, and this tool refuses to guess if the two files'
// skeletons have drifted apart.
const headBoneOf = (doc) =>
  doc
    .getRoot()
    .listNodes()
    .find((n) => n.getName() === 'Head');
const bakedHeadBone = headBoneOf(baked);
const headlessHeadBone = headBoneOf(headless);
if (!bakedHeadBone || !headlessHeadBone) throw new Error('Head bone missing');
const wa = worldMatrixOf(bakedHeadBone);
const wb = worldMatrixOf(headlessHeadBone);
for (let k = 0; k < 16; k++) {
  if (Math.abs(wa[k] - wb[k]) > 1e-5) {
    throw new Error('baked and headless skeletons disagree; refusing to weld across the drift');
  }
}

// Head-asset skull triangles, in body space, as a centroid hash.
const assetSet = new Set();
let assetTris = 0;
for (const prim of assetSkull?.getMesh().listPrimitives() ?? []) {
  const local = rigidPositions(prim, assetSkull);
  const positions = new Float64Array(local.length);
  for (let i = 0; i < local.length; i += 3) {
    const p = mat4Point(wb, [local[i], local[i + 1], local[i + 2]]);
    positions[i] = p[0];
    positions[i + 1] = p[1];
    positions[i + 2] = p[2];
  }
  const indices = prim.getIndices();
  for (let i = 0; i < indices.getCount(); i += 3) {
    const tri = [indices.getScalar(i), indices.getScalar(i + 1), indices.getScalar(i + 2)];
    const { cx, cy, cz } = centroidKeys(positions, tri);
    for (const key of neighbourKeys(cx, cy, cz)) assetSet.add(key);
    assetTris++;
  }
}

// Merge the baked document in, then keep only the head mesh (recut to the
// band) and its skin; everything else the merge brought is disposed through
// the map, the same discipline the exporter itself uses (prune will not
// collect an orphaned bone hierarchy).
const headlessNodesBefore = new Set(headless.getRoot().listNodes());
const map = mergeDocuments(headless, baked);
const bandNode = map.get(bakedHead);
const bandSkin = map.get(bakedHead.getSkin());
if (!bandNode || !bandSkin) throw new Error('merge dropped the head mesh');

// Remap the band skin's joints, by name, onto the headless skeleton.
const liveByName = new Map();
const duplicateNames = new Set();
for (const n of headlessNodesBefore) {
  const name = n.getName();
  if (!name) continue;
  if (liveByName.has(name)) duplicateNames.add(name);
  liveByName.set(name, n);
}
const mergedJoints = bandSkin.listJoints();
for (const joint of mergedJoints) {
  const live = liveByName.get(joint.getName());
  if (!live) throw new Error(`headless skeleton has no bone named ${joint.getName()}`);
  // An ambiguous name would remap this joint onto whichever node the map met
  // last; that is a guess, and this tool refuses to guess.
  if (duplicateNames.has(joint.getName())) {
    throw new Error(`headless file has several nodes named ${joint.getName()}`);
  }
}
// listJoints order defines JOINTS_0 indices; rebuild in the same order.
const liveJoints = mergedJoints.map((j) => liveByName.get(j.getName()));
for (const j of [...mergedJoints]) bandSkin.removeJoint(j);
for (const j of liveJoints) bandSkin.addJoint(j);
const skel = bandSkin.getSkeleton();
if (skel) {
  const liveSkel = liveByName.get(skel.getName());
  if (!liveSkel) throw new Error(`headless skeleton has no root named ${skel.getName()}`);
  bandSkin.setSkeleton(liveSkel);
}

// Cut the band. Centroid mode keeps what the head asset did not match; plane
// mode keeps what is not fully above the cut plane. Either way the band and the
// head are complements of the same source triangles, which is what closes the
// gap without a seam.
let kept = 0;
let dropped = 0;
const bandPrims = bandNode.getMesh().listPrimitives();
const bindPositionsOf = new Map();
for (const prim of bandPrims) bindPositionsOf.set(prim, skinnedBindPositions(prim, bandSkin));
for (const prim of bandPrims) {
  const positions = bindPositionsOf.get(prim);
  const inHead = (tri) =>
    PLANE_MODE
      ? tri.every((v) => positions[v * 3 + 1] >= HEAD_ASSET_CUT_Y)
      : assetSet.has(centroidKeys(positions, tri).key);
  const keptHere = rebuildPrimitive(prim, (tri) => {
    if (inHead(tri)) {
      dropped++;
      return false;
    }
    return true;
  });
  kept += keptHere;
}
// Close the seam: the band is SKINNED (it follows neck_01 and Head by weight)
// while the head asset is RIGID on the Head bone, so any pose off the bind
// splits the two by a hair and the crack reads as a dark jagged ring at the
// throat. The top of the band therefore hands itself fully to the Head bone,
// blended in over the last few centimetres: the ring that touches the head
// asset moves rigidly WITH it (no crack, in any pose), and the bottom keeps its
// authored weights so the neck still deforms where it actually bends.
{
  const headIdx = bandSkin.listJoints().findIndex((j) => j.getName() === 'Head');
  if (headIdx < 0) throw new Error('band skin lost its Head joint');
  const BLEND_LO = HEAD_ASSET_CUT_Y - 0.05;
  const BLEND_HI = HEAD_ASSET_CUT_Y - 0.005;
  let locked = 0;
  for (const prim of bandNode.getMesh().listPrimitives()) {
    const positions = skinnedBindPositions(prim, bandSkin);
    const jnt = prim.getAttribute('JOINTS_0');
    const wgt = prim.getAttribute('WEIGHTS_0');
    const j4 = [0, 0, 0, 0];
    const w4 = [0, 0, 0, 0];
    for (let i = 0; i < jnt.getCount(); i++) {
      const y = positions[i * 3 + 1];
      let t = (y - BLEND_LO) / (BLEND_HI - BLEND_LO);
      t = Math.min(1, Math.max(0, t));
      t = t * t * (3 - 2 * t);
      if (t <= 0) continue;
      jnt.getElement(i, j4);
      wgt.getElement(i, w4); // already denormalized floats summing ~1
      let headSlot = j4.indexOf(headIdx);
      if (headSlot < 0) {
        // No Head influence yet: take over the lightest slot.
        headSlot = w4.indexOf(Math.min(...w4));
        j4[headSlot] = headIdx;
        w4[headSlot] = 0;
      }
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += w4[k];
      const inv = sum > 0 ? 1 / sum : 0;
      for (let k = 0; k < 4; k++) {
        const base = w4[k] * inv;
        w4[k] = base * (1 - t) + (k === headSlot ? t : 0);
      }
      // Back to normalized uint8 storage, sum pinned to exactly 255 with the
      // rounding remainder on the head slot (the one this pass grew).
      const q = w4.map((w) => Math.round(w * 255));
      const drift = 255 - q.reduce((a, b) => a + b, 0);
      q[headSlot] += drift;
      jnt.setElement(i, j4);
      wgt.setElement(
        i,
        q.map((v) => v / 255),
      );
      locked++;
    }
  }
  console.log(`seam: blended ${locked} band verts toward the Head bone`);
}

console.log(
  PLANE_MODE
    ? `band: kept ${kept} tris below the plane, ${dropped} go to the head asset`
    : `band: kept ${kept} tris, matched ${dropped} against the head asset's ${assetTris}`,
);
if (kept === 0 || dropped === 0) {
  throw new Error('complement degenerated: either nothing matched or everything did');
}

bandNode.setName('neck_band');
const scene = headless.getRoot().getDefaultScene() ?? headless.getRoot().listScenes()[0];
bandNode.getParentNode()?.removeChild(bandNode);
scene.addChild(bandNode);

// Dispose everything else the merge brought.
const keep = new Set([bandNode, bandSkin]);
for (const prop of [
  ...baked.getRoot().listNodes(),
  ...baked.getRoot().listScenes(),
  ...baked.getRoot().listSkins(),
]) {
  const merged = map.get(prop);
  if (merged && !keep.has(merged)) merged.dispose();
}

// A GLB carries at most one buffer, and a merge brings the other file's along:
// point every accessor at buffer 0 and dispose the rest.
async function finishDocument(doc, path) {
  await doc.transform(prune(), dedup());
  const buffers = doc.getRoot().listBuffers();
  for (const accessor of doc.getRoot().listAccessors()) accessor.setBuffer(buffers[0]);
  for (const buffer of buffers.slice(1)) buffer.dispose();
  await doc.transform(meshopt({ encoder: MeshoptEncoder }));
  await io.write(path, doc);
  console.log(`wrote ${path}`);
}

await finishDocument(headless, outPath);

// Plane mode also emits this body's OWN head asset: the part of the skull the
// band did not keep, plus the eyes and brows, carried into head-bone space so
// the runtime can mount it with no offset (the same contract the male asset
// and the hairpieces follow). This is what puts a female skull on the female
// body, which had been wearing the male asset by omission.
if (EMIT_HEAD_OUT) {
  const headDoc = new Document();
  const hm = mergeDocuments(headDoc, baked);
  const toBone = invertMat4(worldMatrixOf(bakedHeadBone));
  const keepHead = new Set();
  for (const srcNode of baked.getRoot().listNodes()) {
    const isSkull = srcNode === bakedHead;
    if (!isSkull && srcNode.getName() !== 'Eyes' && srcNode.getName() !== 'Eyebrows') continue;
    if (!srcNode.getMesh() || !srcNode.getSkin()) continue;
    const node = hm.get(srcNode);
    const srcPrims = srcNode.getMesh().listPrimitives();
    const dstPrims = node.getMesh().listPrimitives();
    const normalMatrixCache = new Map();
    for (let pi = 0; pi < srcPrims.length; pi++) {
      normalMatrixCache.clear();
      // All measurement runs against the pristine BAKED side, whose skin still
      // carries the quantization frame these vertices are stored in.
      const positions = skinnedBindPositions(srcPrims[pi], srcNode.getSkin());
      const mats = skinningMatrices(srcPrims[pi], srcNode.getSkin());
      rebuildPrimitive(
        dstPrims[pi],
        (tri) => !isSkull || tri.every((v) => positions[v * 3 + 1] >= HEAD_ASSET_CUT_Y),
        {
          drop: ['JOINTS_0', 'WEIGHTS_0'],
          rewrite: (semantic, el, v) => {
            if (semantic === 'POSITION') {
              const b = mat4Point(toBone, [
                positions[v * 3],
                positions[v * 3 + 1],
                positions[v * 3 + 2],
              ]);
              el[0] = b[0];
              el[1] = b[1];
              el[2] = b[2];
            } else if (semantic === 'NORMAL') {
              // Normals transform by the INVERSE-TRANSPOSE of the point
              // transform: these matrices carry the quantization scale meshopt
              // folded into the IBMs, which need not be uniform per axis, and
              // pushing a normal through the forward matrix under non-uniform
              // scale skews its direction (normalizing afterwards fixes only
              // the length).
              const m = normalMatrixCache.get(v) ?? invTranspose(mat4Multiply(toBone, mats[v]));
              normalMatrixCache.set(v, m);
              const n = mat4Direction(m, [el[0], el[1], el[2]]);
              const len = Math.hypot(n[0], n[1], n[2]) || 1;
              el[0] = n[0] / len;
              el[1] = n[1] / len;
              el[2] = n[2] / len;
            }
          },
        },
      );
    }
    node.setSkin(null);
    node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    keepHead.add(node);
  }
  if (keepHead.size !== 3) {
    throw new Error(`expected skull + eyes + brows, found ${keepHead.size}`);
  }
  const headScene = headDoc.getRoot().listScenes()[0] ?? headDoc.createScene('head');
  for (const node of keepHead) {
    node.getParentNode()?.removeChild(node);
    headScene.addChild(node);
  }
  for (const prop of [
    ...baked.getRoot().listNodes(),
    ...baked.getRoot().listScenes(),
    ...baked.getRoot().listSkins(),
  ]) {
    const merged = hm.get(prop);
    if (merged && !keepHead.has(merged) && merged !== headScene) merged.dispose();
  }
  await finishDocument(headDoc, EMIT_HEAD_OUT);
}
