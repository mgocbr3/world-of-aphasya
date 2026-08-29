// Fit a Meshy-generated racial skull onto the spike head-bone seat.
//
// A generated head arrives as ONE raw primitive (positions only, no normals,
// no UVs, no materials) of a bald bust: head, neck and the top of the chest.
// The game wants the piece the human head asset is: a rigid attachment in the
// HEAD BONE's frame, cut at the neck so the body's welded neck band meets it
// under the collar, matte, and quantized like everything else shipped.
//
// Steps, all measured rather than eyeballed:
//   1. CUT the bust at the neck: the width profile by height has a skull bulge,
//      a neck valley and a shoulder flare; the cut is the valley.
//   2. SCALE so chin-to-crown height matches the human reference head. Height,
//      not width, on purpose: an orc is WIDER than a human at the same height,
//      and width-matching would shrink exactly what makes him an orc.
//   3. SEAT: the CHIN lands at the reference's bottom (the stump below it just
//      rides down inside the collar), x centred, skull z-centre to the
//      reference skull's, so a big nose leans out of the face instead of
//      dragging the whole head forward.
//   4. NORMALS computed smooth (area-weighted accumulation).
//   5. One matte material carrying the race's skin colour: these meshes ship
//      untextured by decision (direction: "gerar sem texturas e aplicar as
//      cores do pack"), so the paint is a factor, not a map.
//
// Usage:
//   node scripts/assets/build_spike_racial_head.mjs <rawGlb> <refHeadGlb> <outGlb> --skin ffcc99 [--flipz]

import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const [rawPath, refPath, outPath] = process.argv.slice(2);
const skinAt = process.argv.indexOf('--skin');
const SKIN = skinAt >= 0 ? parseInt(process.argv[skinAt + 1], 16) : 0xd9a077;
const FLIPZ = process.argv.includes('--flipz');
// Where this bust's CHIN and neck cut sit, as fractions of its own height from
// the bottom. Read off each mesh's silhouette by hand: the generated busts do
// not share an anatomy (the orc is nearly all head on a pedestal, the elf is a
// classic head-and-shoulders bust), so no single valley heuristic survives
// contact with all four, and four hand-read numbers beat a clever guess.
function numFlag(name, fallback) {
  const at = process.argv.indexOf(name);
  if (at < 0) return fallback;
  const value = Number(process.argv[at + 1]);
  if (!Number.isFinite(value)) {
    console.error(`${name} needs a numeric value, got ${process.argv[at + 1]}`);
    process.exit(1);
  }
  return value;
}
const CHIN_FRAC = numFlag('--chin-frac', 0.5);
const CUT_FRAC = numFlag('--cut-frac', 0.3);
// Art-direction trim on top of the measured chin-to-crown match: some sculpts
// read oversized against the shared body even at equal height (an elf whose
// face is broad, a lich whose ears double his silhouette), and a few percent
// off is what seats them back into the hood.
const SCALE_MUL = numFlag('--scale-mul', 1);
// Straighten a bust sculpted looking down or up: degrees of backward pitch
// applied about the cloud's centre before anything is measured, because every
// fraction below assumes "up" runs chin to crown.
const PITCH = (numFlag('--pitch', 0) * Math.PI) / 180;
if (!rawPath || !refPath || !outPath) {
  console.error(
    'usage: build_spike_racial_head.mjs <rawGlb> <refHeadGlb> <outGlb> --skin RRGGBB [--flipz]',
  );
  process.exit(1);
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// --- reference seat: the human head asset's skull bounds in head-bone space --
function mat4Multiply(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}
function worldOf(n) {
  let m = n.getMatrix();
  for (let p = n.getParentNode(); p; p = p.getParentNode()) m = mat4Multiply(p.getMatrix(), m);
  return m;
}
const ref = await io.read(refPath);
const refLo = [9, 9, 9];
const refHi = [-9, -9, -9];
for (const node of ref.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh || !/^superhero/i.test(node.getName())) continue;
  const w = worldOf(node);
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const v = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      const p = [
        w[0] * v[0] + w[4] * v[1] + w[8] * v[2] + w[12],
        w[1] * v[0] + w[5] * v[1] + w[9] * v[2] + w[13],
        w[2] * v[0] + w[6] * v[1] + w[10] * v[2] + w[14],
      ];
      for (let a = 0; a < 3; a++) {
        if (p[a] < refLo[a]) refLo[a] = p[a];
        if (p[a] > refHi[a]) refHi[a] = p[a];
      }
    }
  }
}
if (refLo[0] > refHi[0]) {
  throw new Error('reference head has no SuperHero-named skull mesh; wrong file?');
}
const refHeight = refHi[1] - refLo[1];
const refZCentre = (refLo[2] + refHi[2]) / 2;
console.log(
  `reference skull: height ${refHeight.toFixed(3)}, bottom ${refLo[1].toFixed(3)}, z centre ${refZCentre.toFixed(3)}`,
);

// --- raw bust in, positions out ---------------------------------------------
const raw = await io.read(rawPath);
const rawMeshes = raw.getRoot().listMeshes();
if (rawMeshes.length !== 1 || rawMeshes[0].listPrimitives().length !== 1) {
  throw new Error(
    `expected one mesh with one primitive, found ${rawMeshes.length} meshes; refusing to silently drop geometry`,
  );
}
const rawPrim = rawMeshes[0].listPrimitives()[0];
const rawPos = rawPrim.getAttribute('POSITION');
const rawIdx = rawPrim.getIndices();
const count = rawPos.getCount();
const P = new Float64Array(count * 3);
{
  const v = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    rawPos.getElement(i, v);
    P[i * 3] = v[0];
    P[i * 3 + 1] = v[1];
    P[i * 3 + 2] = FLIPZ ? -v[2] : v[2];
    if (FLIPZ) P[i * 3] = -v[0]; // 180 about Y keeps the mesh right-handed
  }
}
const lo = [9, 9, 9];
const hi = [-9, -9, -9];
for (let i = 0; i < count; i++)
  for (let a = 0; a < 3; a++) {
    const v = P[i * 3 + a];
    if (v < lo[a]) lo[a] = v;
    if (v > hi[a]) hi[a] = v;
  }
if (PITCH !== 0) {
  const cy = (lo[1] + hi[1]) / 2;
  const cz = (lo[2] + hi[2]) / 2;
  const c = Math.cos(PITCH);
  const sn = Math.sin(PITCH);
  for (let i = 0; i < count; i++) {
    const y = P[i * 3 + 1] - cy;
    const z = P[i * 3 + 2] - cz;
    P[i * 3 + 1] = y * c - z * sn + cy;
    P[i * 3 + 2] = y * sn + z * c + cz;
  }
  for (let a = 0; a < 3; a++) {
    lo[a] = 9;
    hi[a] = -9;
  }
  for (let i = 0; i < count; i++)
    for (let a = 0; a < 3; a++) {
      const v = P[i * 3 + a];
      if (v < lo[a]) lo[a] = v;
      if (v > hi[a]) hi[a] = v;
    }
}

const chinY = lo[1] + CHIN_FRAC * (hi[1] - lo[1]);
const cutY = lo[1] + CUT_FRAC * (hi[1] - lo[1]);
// The neck radius: what the bust measures just under the chin, TIGHTENED by
// a fifth, because the widest thing in that band is often the trapezius
// flare rather than the neck proper. Below the chin only this cylinder
// survives, which is what strips shoulders and display pedestals while
// keeping the neck that slides down inside the collar (its slightly ragged
// cut edge is hidden there too).
let neckR = 0;
for (let i = 0; i < count; i++) {
  const y = P[i * 3 + 1];
  if (y < chinY - 0.06 * (hi[1] - lo[1]) || y > chinY) continue;
  const r = Math.hypot(P[i * 3], P[i * 3 + 2] - (lo[2] + hi[2]) / 2);
  if (r > neckR) neckR = r;
}
neckR *= 0.8;
console.log(
  `chin y ${chinY.toFixed(3)}, cut y ${cutY.toFixed(3)}, neck radius ${neckR.toFixed(3)}`,
);

// Keep: everything above the chin (ears included, whatever they do), plus the
// neck cylinder from chin down to the cut.
const zMid0 = (lo[2] + hi[2]) / 2;
const keepVert = (v) => {
  const y = P[v * 3 + 1];
  if (y >= chinY) return true;
  if (y < cutY) return false;
  return Math.hypot(P[v * 3], P[v * 3 + 2] - zMid0) <= neckR;
};
const keptTris = [];
for (let i = 0; i < rawIdx.getCount(); i += 3) {
  const tri = [rawIdx.getScalar(i), rawIdx.getScalar(i + 1), rawIdx.getScalar(i + 2)];
  if (tri.every(keepVert)) keptTris.push(tri);
}

// Remap + transform into the reference seat.
const remap = new Map();
for (const tri of keptTris) for (const v of tri) if (!remap.has(v)) remap.set(v, remap.size);
const order = [...remap.keys()];
// Height is measured chin to crown, matching what the reference spans (its
// stump barely drops below the chin); the neck below the chin just rides
// along, down inside the collar, so a long stump costs nothing.
const scale = (refHeight / (hi[1] - chinY)) * SCALE_MUL;
// Skull z-centre measured over the kept region only.
let kzLo = 9;
let kzHi = -9;
let kxLo = 9;
let kxHi = -9;
for (const v of order) {
  if (P[v * 3 + 1] < chinY) continue; // centre on the skull, not the stump
  const z = P[v * 3 + 2];
  const x = P[v * 3];
  if (z < kzLo) kzLo = z;
  if (z > kzHi) kzHi = z;
  if (x < kxLo) kxLo = x;
  if (x > kxHi) kxHi = x;
}
const xMid = (kxLo + kxHi) / 2;
const zMid = (kzLo + kzHi) / 2;
const positions = new Float32Array(order.length * 3);
for (let k = 0; k < order.length; k++) {
  const v = order[k];
  positions[k * 3] = (P[v * 3] - xMid) * scale;
  // A trimmed head seats HIGHER by a bit over half of what the trim removed
  // (0.55, tuned on the necromancer): chin glued to the reference bottom
  // would sink a smaller face into the collar.
  positions[k * 3 + 1] =
    (P[v * 3 + 1] - chinY) * scale + refLo[1] + (1 - SCALE_MUL) * refHeight * 0.55;
  positions[k * 3 + 2] = (P[v * 3 + 2] - zMid) * scale + refZCentre;
}
const IndexArray = order.length <= 65535 ? Uint16Array : Uint32Array;
const indices = new IndexArray(keptTris.length * 3);
keptTris.forEach((tri, t) => {
  for (let k = 0; k < 3; k++) indices[t * 3 + k] = remap.get(tri[k]);
});

// Smooth normals: area-weighted face accumulation.
const normals = new Float32Array(order.length * 3);
for (let t = 0; t < indices.length; t += 3) {
  const a = indices[t];
  const b = indices[t + 1];
  const c = indices[t + 2];
  const ux = positions[b * 3] - positions[a * 3];
  const uy = positions[b * 3 + 1] - positions[a * 3 + 1];
  const uz = positions[b * 3 + 2] - positions[a * 3 + 2];
  const vx = positions[c * 3] - positions[a * 3];
  const vy = positions[c * 3 + 1] - positions[a * 3 + 1];
  const vz = positions[c * 3 + 2] - positions[a * 3 + 2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  for (const v of [a, b, c]) {
    normals[v * 3] += nx;
    normals[v * 3 + 1] += ny;
    normals[v * 3 + 2] += nz;
  }
}
for (let v = 0; v < order.length; v++) {
  const l = Math.hypot(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]) || 1;
  normals[v * 3] /= l;
  normals[v * 3 + 1] /= l;
  normals[v * 3 + 2] /= l;
}

// --- emit --------------------------------------------------------------------
const doc = new Document();
const buffer = doc.createBuffer();
const mat = doc
  .createMaterial('racial_skin')
  .setBaseColorFactor([
    ((SKIN >> 16) & 255) / 255,
    ((SKIN >> 8) & 255) / 255,
    (SKIN & 255) / 255,
    1,
  ])
  .setMetallicFactor(0)
  .setRoughnessFactor(0.9);
const prim = doc
  .createPrimitive()
  .setMaterial(mat)
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
  .setAttribute(
    'POSITION',
    doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer),
  )
  .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer));
const mesh = doc.createMesh('racial_head').addPrimitive(prim);
const node = doc.createNode('racial_head').setMesh(mesh);
doc.createScene('head').addChild(node);
await doc.transform(prune(), dedup());
await doc.transform(meshopt({ encoder: MeshoptEncoder }));
await io.write(outPath, doc);
console.log(`wrote ${outPath}: ${keptTris.length} tris at scale ${scale.toFixed(3)}`);
