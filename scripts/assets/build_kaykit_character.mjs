// Bring a KayKit Adventurers 2.0 body into the shipping character set.
//
// The purchased pack ships BODIES with no animation (0 clips) plus a small
// standalone animation library that is a SUBSET of what this game drives: it
// has no Walking_Backwards, no Spellcasting, no Sit_Floor_*, no Lie_Idle and
// no 1H_Melee_Attack_Chop, all of which the `kaykit()` ClipMap in
// characters/manifest.ts names. The full library is already in the tree, baked
// into every shipped character GLB, so the clips come from a DONOR that
// already ships rather than from the pack.
//
// That works because the rigs are identical: a 2.0 body and a shipped 1.0 body
// carry the same 23-bone Rig_Medium (Barbarian_Large and skeleton_golem carry
// the same Rig_Large), verified bone-name by bone-name before any merge, so
// the donor's channels re-point onto the new skeleton by NAME with no
// retargeting. The same trick built the Bestiary creatures
// (build_bestiary_mob.mjs); this is its Adventurers-pack twin.
//
// Usage:
//   node scripts/assets/build_kaykit_character.mjs <body.glb> <donor.glb> <out.glb>
//
// Example:
//   node scripts/assets/build_kaykit_character.mjs \
//     ~/Downloads/KayKit_Adventurers_2.0_EXTRA/Characters/gltf/Engineer.glb \
//     public/models/chars/players/knight.glb \
//     public/models/chars/npc/engineer.glb

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const [bodyPath, donorPath, outPath] = process.argv.slice(2);
if (!bodyPath || !donorPath || !outPath) {
  console.error('usage: build_kaykit_character.mjs <body.glb> <donor.glb> <out.glb>');
  process.exit(1);
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const body = await io.read(bodyPath);
const donor = await io.read(donorPath);

/** Every joint the body's skins actually drive, by name. */
const bodyBones = new Map();
for (const skin of body.getRoot().listSkins()) {
  for (const joint of skin.listJoints()) bodyBones.set(joint.getName(), joint);
}
if (bodyBones.size === 0) throw new Error(`${bodyPath} has no skinned joints`);

const donorBones = new Set();
for (const skin of donor.getRoot().listSkins()) {
  for (const joint of skin.listJoints()) donorBones.add(joint.getName());
}
// A donor missing bones the body drives would animate a partial skeleton and
// leave the rest frozen in bind pose, which reads as a broken limb rather than
// as a missing clip. Refuse instead of shipping that.
const orphaned = [...bodyBones.keys()].filter((name) => !donorBones.has(name));
if (orphaned.length > 0) {
  throw new Error(
    `donor ${donorPath} cannot drive ${orphaned.length} of the body's bones: ${orphaned.join(', ')}`,
  );
}

if (body.getRoot().listAnimations().length > 0) {
  throw new Error(`${bodyPath} already carries animations; expected a bare pack body`);
}

mergeDocuments(body, donor);
const merged = body;

// merge() brings the donor's whole scene across. Keep the body's scene as the
// document's one scene and drop the donor's, so the output has a single root
// and prune() can reap the donor geometry the clips no longer need.
const root = merged.getRoot();
const scenes = root.listScenes();
const keep = scenes[0];
root.setDefaultScene(keep);
for (const scene of scenes.slice(1)) scene.dispose();

// Re-point every animation channel from the donor's joints onto the body's,
// matched by bone name. A channel whose target has no counterpart is dropped
// rather than left dangling.
let repointed = 0;
let dropped = 0;
for (const anim of root.listAnimations()) {
  for (const channel of anim.listChannels()) {
    const target = channel.getTargetNode();
    if (!target) continue;
    const mine = bodyBones.get(target.getName());
    if (mine) {
      channel.setTargetNode(mine);
      repointed++;
    } else {
      channel.dispose();
      dropped++;
    }
  }
  if (anim.listChannels().length === 0) anim.dispose();
}

// Drop the donor's BODY. Its scene is gone, but its meshes hang off joints its
// own skin still references, so prune() sees them as live and the output would
// ship (and draw) two characters. Reachability from the kept scene is the test.
const reachable = new Set();
const walk = (node) => {
  if (reachable.has(node)) return;
  reachable.add(node);
  for (const child of node.listChildren()) walk(child);
};
for (const node of keep.listChildren()) walk(node);
let donorNodes = 0;
for (const node of root.listNodes()) {
  if (reachable.has(node)) continue;
  node.dispose();
  donorNodes++;
}
for (const skin of root.listSkins()) {
  if (skin.listJoints().some((joint) => reachable.has(joint))) continue;
  skin.dispose();
}

// mergeDocuments brings the donor's buffer across, and a GLB may hold only
// one, so collapse every accessor onto the body's buffer before writing.
const buffer = root.listBuffers()[0];
for (const accessor of root.listAccessors()) accessor.setBuffer(buffer);
for (const spare of root.listBuffers().slice(1)) spare.dispose();

await merged.transform(prune(), dedup());
await merged.transform(meshopt({ encoder: MeshoptEncoder }));
await io.write(outPath, merged);

const clips = root.listAnimations().map((a) => a.getName());
console.log(
  `wrote ${outPath}: ${clips.length} clips, ${repointed} channels re-pointed, ` +
    `${donorNodes} donor nodes dropped` +
    (dropped ? `, ${dropped} dropped` : ''),
);
console.log(`  clips: ${clips.join(', ')}`);
