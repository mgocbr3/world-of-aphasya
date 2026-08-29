// Compose a Bestiary - Dungeon Monsters Kit body (QAL, quaternius.com) with
// animation clips donated by a shipped Quaternius spike body, into one
// game-ready creature GLB.
//
// The kit ships UNANIMATED bodies on the same humanoid rig the Universal
// Animation Library targets (verified: every Imp bone name exists on the
// shipped spike bodies), and three binds animation tracks to nodes BY NAME.
// So retargeting is a channel re-point: merge a shipped body in, walk the
// animations we want, aim each channel at the monster's own bone of the same
// name, and dispose everything else the merge brought.
//
// Usage:
//   node scripts/assets/build_bestiary_mob.mjs <monsterGlb> <donorGlb> <outGlb> --clips Idle_Loop,Walk_Loop,...

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const [monsterPath, donorPath, outPath] = process.argv.slice(2);
const clipsAt = process.argv.indexOf('--clips');
const CLIPS = clipsAt >= 0 ? process.argv[clipsAt + 1].split(',') : [];
if (!monsterPath || !donorPath || !outPath || CLIPS.length === 0) {
  console.error('usage: build_bestiary_mob.mjs <monsterGlb> <donorGlb> <outGlb> --clips A,B,C');
  process.exit(1);
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const { mergeDocuments } = await import('@gltf-transform/functions');
const monster = await io.read(monsterPath);
const donor = await io.read(donorPath);

// Monster bones by name, the retarget targets.
const monsterBone = new Map();
for (const n of monster.getRoot().listNodes()) if (n.getName()) monsterBone.set(n.getName(), n);

const map = mergeDocuments(monster, donor);
const wanted = new Set(CLIPS);
const kept = [];
for (const anim of donor.getRoot().listAnimations()) {
  const merged = map.get(anim);
  if (!merged) continue;
  if (!wanted.has(anim.getName())) {
    merged.dispose();
    continue;
  }
  for (const channel of merged.listChannels()) {
    const target = channel.getTargetNode();
    const own = target ? monsterBone.get(target.getName()) : null;
    if (own) {
      channel.setTargetNode(own);
    } else {
      // A track for a bone this monster does not have (an IK helper, a prop
      // bone) is dropped rather than left aimed at the merged skeleton.
      channel.dispose();
    }
  }
  kept.push(merged.getName());
}
if (kept.length !== CLIPS.length) {
  const missing = CLIPS.filter((c) => !kept.includes(c));
  throw new Error(`donor is missing clips: ${missing.join(',')}`);
}

// Dispose the merged donor scene, nodes and skins; prune cannot collect an
// orphaned bone hierarchy on its own (the exporter family's shared lesson).
for (const prop of [
  ...donor.getRoot().listNodes(),
  ...donor.getRoot().listScenes(),
  ...donor.getRoot().listSkins(),
  ...donor.getRoot().listMeshes(),
]) {
  const merged = map.get(prop);
  if (merged) merged.dispose();
}

// The kit's materials delegate to packed maps KTX2 mangles; flatten to the
// matte band every other character surface in this game lives in.
for (const mat of monster.getRoot().listMaterials()) {
  mat.setMetallicFactor(0);
  mat.setRoughnessFactor(Math.max(mat.getRoughnessFactor(), 0.85));
}

await monster.transform(prune(), dedup());
const buffers = monster.getRoot().listBuffers();
for (const accessor of monster.getRoot().listAccessors()) accessor.setBuffer(buffers[0]);
for (const buffer of buffers.slice(1)) buffer.dispose();
await monster.transform(meshopt({ encoder: MeshoptEncoder }));
await io.write(outPath, monster);

// Height readout for the VisualDef author.
let lo = Infinity;
let hi = -Infinity;
for (const mesh of monster.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const mn = pos.getMin([])[1];
    const mx = pos.getMax([])[1];
    if (mn < lo) lo = mn;
    if (mx > hi) hi = mx;
  }
}
console.log(
  `wrote ${outPath}: clips [${kept.join(', ')}], raw y ${lo.toFixed(2)}..${hi.toFixed(2)}`,
);
