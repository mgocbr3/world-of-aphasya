// Extract the twelve authored earring styles out of the legacy modular
// warrior library and re-express them in the spike head-bone frame, so the
// Quaternius cast wears the same jewelry the KayKit cast does.
//
// Why extraction instead of new art: the E2_* meshes are finished, authored
// pieces (each style mirrors onto both ears, the septum wraps the nose) and
// their materials are flat mod_jewel_* factors with no texture, so they
// survive a frame change losslessly. What has to change is the SPACE: in the
// library they are skinned 100% to the `head` joint of Rig_Medium with the
// meshopt dequantization folded into that skin's inverse bind matrices, so
// the real bind-pose position is sum(w_i * JointWorld_i * IBM_i * v) and the
// head-local position is inv(JointWorld_head) applied on top.
//
// The legacy head is a wider sculpt than the spike one (half-width 0.45 of a
// 0.84 head height, against 0.091 of 0.232), so a single similarity transform
// cannot both keep a hoop round and land it on the ear. The mapping used:
//   - uniform scale S keeps every style's shape (hoops stay hoops),
//   - a smooth odd x-shift walks the side clusters in to the spike ear line
//     while leaving centred geometry (the septum) alone,
//   - a constant y lift seats the lobe line.
// Verified against measured anchors: legacy stud cluster x +-0.494 lands at
// the spike ear x +-0.090; legacy nose front z 0.509*S matches the spike nose
// front 0.131 with no z correction at all.
//
// Usage: node scripts/assets/build_spike_earrings.mjs
//   reads  public/models/chars/modular/warrior_modular.glb
//   writes public/models/chars/players/spike/earrings.glb

import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const SOURCE = 'public/models/chars/modular/warrior_modular.glb';
const OUT = 'public/models/chars/players/spike/earrings.glb';

/** Styles shipped; `none` has no node anywhere. Keep in sync with
 *  EARRING_STYLES in src/render/characters/modular.ts. */
const STYLES = [
  'stud',
  'hoop',
  'bone',
  'bonehoop',
  'moon',
  'moonstar',
  'feather',
  'runic',
  'cuff',
  'chain',
  'septum',
  'warden',
];

/** Uniform similarity scale: spike head height / legacy head height. Slightly
 *  over the raw ratio (0.232/0.84) so the small pieces read at game distance. */
const SCALE = 0.25;
/** Full inward x walk at the ear cluster. Calibrated on the LOBE, not the ear
 *  tip: the stud cluster centre (legacy |x| 0.48) must land just proud of the
 *  spike head's widest point at lobe height (maxX 0.090 at y 0.085, ears
 *  included), so 0.48*SCALE - shift = 0.095. The first cut used the ear TIP
 *  (0.543 -> 0.090) and buried every style inside the skull. */
const X_SHIFT = 0.025;
/** The shift eases in over |x_legacy| 0..0.35 so centred geometry stays put. */
const X_SHIFT_RAMP = 0.35;
/** Lobe line lift: legacy stud centre 0.187*SCALE sits at 0.047, the spike
 *  lobe at ~0.087. */
const Y_LIFT = 0.04;

const mul = (A, B) => {
  const C = new Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += A[k * 4 + r] * B[c * 4 + k];
      C[c * 4 + r] = s;
    }
  return C;
};

const inv = (m) => {
  const te = new Array(16);
  const n11 = m[0], n21 = m[1], n31 = m[2], n41 = m[3];
  const n12 = m[4], n22 = m[5], n32 = m[6], n42 = m[7];
  const n13 = m[8], n23 = m[9], n33 = m[10], n43 = m[11];
  const n14 = m[12], n24 = m[13], n34 = m[14], n44 = m[15];
  const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
  const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
  const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
  const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
  const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
  const d = 1 / det;
  te[0] = t11 * d;
  te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * d;
  te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * d;
  te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * d;
  te[4] = t12 * d;
  te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * d;
  te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * d;
  te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * d;
  te[8] = t13 * d;
  te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * d;
  te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * d;
  te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * d;
  te[12] = t14 * d;
  te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * d;
  te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * d;
  te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * d;
  return te;
};

const xfP = (M, v) => [
  M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12],
  M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13],
  M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14],
];
const xfN = (M, v) => [
  M[0] * v[0] + M[4] * v[1] + M[8] * v[2],
  M[1] * v[0] + M[5] * v[1] + M[9] * v[2],
  M[2] * v[0] + M[6] * v[1] + M[10] * v[2],
];

const worldMatrix = (node) => {
  let M = node.getMatrix();
  let cur = node;
  for (;;) {
    const parents = cur.listParents().filter((p) => p.propertyType === 'Node');
    if (!parents.length) break;
    cur = parents[0];
    M = mul(cur.getMatrix(), M);
  }
  return M;
};

const smoothstep = (lo, hi, x) => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

/** legacy head-local -> spike head-local. */
const place = (p) => {
  const shift = X_SHIFT * smoothstep(0, X_SHIFT_RAMP, Math.abs(p[0]));
  return [
    SCALE * p[0] - Math.sign(p[0]) * shift,
    SCALE * p[1] + Y_LIFT,
    SCALE * p[2],
  ];
};

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const src = await io.read(SOURCE);
const srcRoot = src.getRoot();

const out = new Document();
const buffer = out.createBuffer();
const scene = out.createScene('earrings');
const outMaterials = new Map();

const outMaterial = (mat) => {
  const name = mat?.getName() ?? 'mod_jewel';
  const cached = outMaterials.get(name);
  if (cached) return cached;
  const m = out
    .createMaterial(name)
    .setBaseColorFactor(mat?.getBaseColorFactor() ?? [1, 1, 1, 1])
    .setMetallicFactor(mat?.getMetallicFactor() ?? 0)
    .setRoughnessFactor(mat?.getRoughnessFactor() ?? 0.5)
    .setDoubleSided(mat?.getDoubleSided() ?? false);
  outMaterials.set(name, m);
  return m;
};

let totalTris = 0;
for (const style of STYLES) {
  const node = srcRoot.listNodes().find((n) => n.getName() === `E2_${style}`);
  if (!node || !node.getMesh() || !node.getSkin()) {
    throw new Error(`E2_${style} missing from ${SOURCE}`);
  }
  const skin = node.getSkin();
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const skinMats = joints.map((j, k) => {
    const e = new Array(16);
    ibm.getElement(k, e);
    return mul(worldMatrix(j), e);
  });
  const headIdx = joints.findIndex((j) => j.getName() === 'head');
  if (headIdx < 0) throw new Error(`E2_${style}: no head joint`);
  const invHead = inv(worldMatrix(joints[headIdx]));

  const mesh = out.createMesh(`earring_${style}`);
  for (const prim of node.getMesh().listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const nrm = prim.getAttribute('NORMAL');
    const jA = prim.getAttribute('JOINTS_0');
    const wA = prim.getAttribute('WEIGHTS_0');
    const count = pos.getCount();
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const v = [0, 0, 0];
    const nv = [0, 0, 0];
    const jv = [0, 0, 0, 0];
    const wv = [0, 0, 0, 0];
    for (let i = 0; i < count; i++) {
      pos.getElement(i, v);
      jA.getElement(i, jv);
      wA.getElement(i, wv);
      let p = [0, 0, 0];
      let n = [0, 0, 0];
      let wsum = 0;
      for (let k = 0; k < 4; k++) {
        if (wv[k] <= 0) continue;
        wsum += wv[k];
        const M = skinMats[jv[k]];
        const q = xfP(M, v);
        p[0] += q[0] * wv[k];
        p[1] += q[1] * wv[k];
        p[2] += q[2] * wv[k];
        if (nrm) {
          nrm.getElement(i, nv);
          const r = xfN(M, nv);
          n[0] += r[0] * wv[k];
          n[1] += r[1] * wv[k];
          n[2] += r[2] * wv[k];
        }
      }
      if (wsum > 0) {
        p = p.map((x) => x / wsum);
      }
      const h = place(xfP(invHead, p));
      positions[i * 3] = h[0];
      positions[i * 3 + 1] = h[1];
      positions[i * 3 + 2] = h[2];
      const hn = xfN(invHead, n);
      const l = Math.hypot(hn[0], hn[1], hn[2]) || 1;
      normals[i * 3] = hn[0] / l;
      normals[i * 3 + 1] = hn[1] / l;
      normals[i * 3 + 2] = hn[2] / l;
    }
    const srcIdx = prim.getIndices();
    const indices = new (count > 0xffff ? Uint32Array : Uint16Array)(srcIdx.getCount());
    for (let i = 0; i < srcIdx.getCount(); i++) indices[i] = srcIdx.getScalar(i);
    totalTris += indices.length / 3;
    mesh.addPrimitive(
      out
        .createPrimitive()
        .setMaterial(outMaterial(prim.getMaterial()))
        .setIndices(out.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
        .setAttribute(
          'POSITION',
          out.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer),
        )
        .setAttribute(
          'NORMAL',
          out.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer),
        ),
    );
  }
  scene.addChild(out.createNode(`earring_${style}`).setMesh(mesh));
}

await out.transform(prune(), dedup());
await out.transform(meshopt({ encoder: MeshoptEncoder }));
await io.write(OUT, out);
console.log(`wrote ${OUT}: ${STYLES.length} styles, ${totalTris} tris, ${outMaterials.size} materials`);
