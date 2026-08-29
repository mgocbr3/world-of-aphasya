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
import type { SpikeRace } from './manifest';
import { SPIKE_RACE_SKIN } from './manifest';
import {
  earringMaterialSpec,
  hairColor,
  type JewelMaterialSpec,
  type ModularAppearance,
  type OutfitColorway,
  skinColor,
} from './modular';
import { spikeEarringNode } from './spike_earrings_core';
import { spikeBeardPiece, spikeHairPiece, spikeHairUrl } from './spike_hair_core';

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

/** Face sliders to region displacement, one region per slider. */
export function spikeFaceAxes(app: ModularAppearance): FaceAxes {
  const face = app.face;
  // Every creator slider has its own region now. The earlier mapping folded
  // chin into cheeks (two sliders fighting over the same vertices, which is
  // exactly what read as a deformed face) and dropped ears and smirk entirely.
  return {
    nose: face?.nose ?? 0,
    jaw: face?.jaw ?? 0,
    cheeks: face?.cheeks ?? 0,
    chin: face?.chin ?? 0,
    eyes: face?.eyes ?? 0,
    ears: face?.ears ?? 0,
    brow: face?.brow ?? 0,
    smirk: face?.smirk ?? 0,
  };
}

/** The hairpiece URLs and paint for a look; nulls are bald and clean-shaven. */
export function spikeHairLook(app: ModularAppearance): {
  hair: string | null;
  beard: string | null;
  color: number;
} {
  const hair = spikeHairPiece(app.hair);
  const beard = spikeBeardPiece(app.beard);
  return {
    hair: hair ? spikeHairUrl(hair) : null,
    beard: beard ? spikeHairUrl(beard) : null,
    // The same wheel the modular body paints its hair parts with: one colour
    // for hair and beard, because the creator only offers one.
    color: hairColor(app),
  };
}

/**
 * What a spike body does with an authored look. Deliberately one function
 * rather than three calls at each site: the creator's turntable and the world's
 * entity path have to answer the same question, and the bug this prevents is
 * the one that shipped for a while (a player customized a character the town
 * then drew with a default body, face and head).
 *
 * Typed structurally so this module stays free of the renderer's own imports;
 * CharacterVisual satisfies it.
 */
export interface SpikeLookTarget {
  applyBodyAxes(axes: BodyAxes): void;
  applyFaceShape(axes: FaceAxes): void;
  setSpikeHair(hairUrl: string | null, beardUrl: string | null, color: number): void;
  setSpikeEarrings(node: string | null, spec: JewelMaterialSpec | null): void;
  setSpikeSkinTone(color: number): void;
  setSpikeOutfitDye(outfit: OutfitColorway): void;
}

/** The skin a spike body wears: the race's own fixed colour, or the player's
 *  tone wheel on the raceless human. One resolution rule for both call sites,
 *  so an orc is green down into his shirt everywhere he is drawn. */
export function spikeSkinTone(app: ModularAppearance, race: SpikeRace): number {
  return SPIKE_RACE_SKIN[race] ?? skinColor(app);
}

export function applySpikeLook(
  visual: SpikeLookTarget,
  app: ModularAppearance,
  race: SpikeRace,
): void {
  visual.applyBodyAxes(spikeBodyAxes(app));
  visual.applyFaceShape(spikeFaceAxes(app));
  // Dye FIRST: it re-runs the whole material sweep, and the skin and hair
  // passes below must land on top of that sweep, not under it.
  visual.setSpikeOutfitDye(app.outfit ?? 'classic');
  const hair = spikeHairLook(app);
  visual.setSpikeHair(hair.hair, hair.beard, hair.color);
  visual.setSpikeEarrings(spikeEarringNode(app.earrings), earringMaterialSpec(app));
  visual.setSpikeSkinTone(spikeSkinTone(app, race));
}
