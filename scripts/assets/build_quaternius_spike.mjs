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

import { existsSync, readdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
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
