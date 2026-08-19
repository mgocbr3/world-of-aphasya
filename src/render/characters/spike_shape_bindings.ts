// What the creator's existing sliders mean on a rig that has no shape keys.
//
// The character creator already ships seven body sliders and eight face
// sliders, authored against the KayKit modular body's morph targets. The
// Quaternius rig carries neither, so on the spike those controls did nothing at
// all: the player dragged them and watched a character that never changed.
//
// Rather than invent a second set of controls, this maps the ones already on
// screen onto the axes the new rig CAN express (bone scale for the body, region
// displacement for the face). The mapping is by MEANING, not by name: a slider
// labelled "chest" should make a character look stronger, whichever mechanism
// the rig underneath happens to use.
//
// Every slider on screen now reaches a bone, and the two axes the rig offers
// that no region slider covers (overall height and head size) have their own
// rows, so nothing here is a stub.

import type { BodyAxes } from './body_shape_core';
import type { FaceAxes } from './face_shape_core';
import type { ModularAppearance } from './modular';

/** Body sliders to bone axes. */
export function spikeBodyAxes(app: ModularAppearance): BodyAxes {
  const body = app.body;
  return {
    // A heavier chest reads as build; the creator's own label is the closest
    // thing it has to a strength slider.
    build: body?.chest ?? 0,
    shoulders: body?.shoulders ?? 0,
    hips: body?.hips ?? 0,
    // Elbows sit on the forearm, so the slider that thickened them becomes arm
    // thickness; hands keep their own row because a hand is a silhouette a
    // player reads at a glance.
    armWidth: body?.elbows ?? 0,
    armLength: body?.elbows ?? 0,
    hands: body?.hands ?? 0,
    // Knees are the limb-length signal the creator carries; feet are their own
    // leaf, like the head.
    legLength: body?.knees ?? 0,
    feet: body?.feet ?? 0,
    // The two whole-body axes, which have no region slider and their own rows.
    height: app.height ?? 0,
    headSize: app.headSize ?? 0,
  };
}

/** Face sliders to region displacement. */
export function spikeFaceAxes(app: ModularAppearance): FaceAxes {
  const face = app.face;
  return {
    nose: face?.nose ?? 0,
    jaw: face?.jaw ?? 0,
    // Cheeks and chin both widen the lower face; averaging them keeps one
    // region from fighting the other over the same vertices.
    cheeks: ((face?.cheeks ?? 0) + (face?.chin ?? 0)) / 2,
    eyes: face?.eyes ?? 0,
    brow: face?.brow ?? 0,
  };
}
