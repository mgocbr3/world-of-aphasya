// Meshy intake: turn one raw Meshy export into a prop this renderer can afford.
//
// Meshy ships what a photogrammetry pipeline ships: a single dense mesh (600k
// to 1.6M triangles here) wrapped in 2048px JPEG maps, with no rig, no scale
// convention and no orientation convention. None of that is wrong, it is just
// not a game asset yet. This script is the missing half: weld, decimate to a
// budget, resize and recompress the maps, then normalize the model so a caller
// can say "put this on the head bone" and have it land.
//
// Deliberately a PROP pipeline, not a garment one. A garment has to deform with
// the body, which means skinning weights and the rig-manual lane; a helmet, a
// shield or a held weapon rides a single bone and needs none of that. Props are
// where Meshy pays off soonest, so this is the lane the spike proves out first.
//
// Usage:
//   node scripts/assets/build_meshy_prop.mjs <raw.glb> <out.glb> [--tris 8000]
//     [--height 0.42] [--yaw 0] [--pitch 0]
// --height normalizes the model's longest axis to that many world units, which
// is what makes an arbitrary export land at a believable size on a character.

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2);
const [rawPath, outPath] = args;
if (!rawPath || !outPath) {
  console.error('usage: build_meshy_prop.mjs <raw.glb> <out.glb> [--tris N] [--height U]');
  process.exit(1);
}
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] !== undefined ? Number(args[at + 1]) : fallback;
};
const TARGET_TRIS = flag('tris', 8000);
const TARGET_HEIGHT = flag('height', 0);
// Where the pivot lands. A helmet or a held weapon hangs off its base, so the
// bone sits at the bottom of the model; a breastplate wraps a bone that runs
// through its MIDDLE, so it centres instead. Getting this wrong is what put an
// armour piece in a fist like a shield.
const CENTERED = args.includes('--center');
// Meshy authors metal as metal. Only pass --matte for cloth and leather, where
// a live metalness map plus our sun reads wet (the character-kit problem).
const MATTE = args.includes('--matte');

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptSimplifier,
});

const doc = await io.read(rawPath);
const root = doc.getRoot();

const countTris = () =>
  root
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((sum, prim) => {
      const indices = prim.getIndices();
      const count = indices ? indices.getCount() : (prim.getAttribute('POSITION')?.getCount() ?? 0);
      return sum + count / 3;
    }, 0);

const before = countTris();
// Meshy meshes arrive unwelded (every triangle its own three vertices), so weld
// first or the simplifier has no edges to collapse and the ratio does nothing.
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: TARGET_TRIS / before, error: 0.01 }),
);

// Normalize scale on the model's own bounds. A Meshy export lands at whatever
// size the generator felt like, so a caller asking for "0.4 units tall" is the
// only sane contract; without it every prop needs a hand-tuned magic number.
if (TARGET_HEIGHT > 0) {
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      if (!position) continue;
      const min = position.getMin([]);
      const max = position.getMax([]);
      lo = lo.map((v, i) => Math.min(v, min[i]));
      hi = hi.map((v, i) => Math.max(v, max[i]));
    }
  }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const scale = span > 0 ? TARGET_HEIGHT / span : 1;
  const centerX = (hi[0] + lo[0]) / 2;
  const centerZ = (hi[2] + lo[2]) / 2;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      if (!position) continue;
      const vertex = [0, 0, 0];
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, vertex);
        position.setElement(i, [
          (vertex[0] - centerX) * scale,
          (vertex[1] - (CENTERED ? (hi[1] + lo[1]) / 2 : lo[1])) * scale,
          (vertex[2] - centerZ) * scale,
        ]);
      }
      // Re-seat the accessor's own array so its cached min/max are recomputed
      // from the rewritten vertices rather than describing the raw export.
      position.setArray(position.getArray());
    }
  }
}

if (MATTE) {
  for (const material of root.listMaterials()) {
    material.setMetallicFactor(0);
    material.setRoughnessFactor(Math.max(material.getRoughnessFactor(), 0.8));
  }
}

await doc.transform(
  dedup(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512] }),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);

await mkdir(dirname(outPath), { recursive: true });
await io.write(outPath, doc);

console.log(
  JSON.stringify({
    out: outPath,
    trianglesBefore: Math.round(before),
    trianglesAfter: Math.round(countTris()),
    textures: root.listTextures().map((t) => t.getSize()?.join('x')),
  }),
);
