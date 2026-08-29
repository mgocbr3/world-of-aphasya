// Outfit colorways on the Quaternius kits: which HSV zone of each kit's
// painted atlas is CLOTH, and how a colorway dyes it.
//
// The KayKit sets carry hand-measured dye bands per set (modular.ts
// ARMOR_DYE_BANDS); these are the same thing for the two spike kits, measured
// from the packs' own BaseColor PNGs (hue histogram over the saturated
// texels, 2026-08-29):
//
//   Ranger: the tunic and hood greens live in hue 85..147 at sat 0.5..0.75;
//   the leather straps and wood sit at hue 20..40 and stay out of the band.
//   Peasant: the dyeable cloth is the cream SHIRT, hue ~40..50 at sat
//   0.15..0.45 and val 0.4+; the brown trousers share nearby hues but at
//   sat ~0.7 and val under 0.25, so the sat and val windows cut them out.
//
// The rules ride the same ArmorDyeSpec shader the KayKit dye uses, so one
// uniform-driven program serves both casts and picking swatches never
// compiles a second program.

import type { ArmorDyeSpec } from './armor_dye';
import { OUTFIT_COLORWAYS, type OutfitColorway } from './modular';

interface KitBand {
  ref: number;
  band: number;
  sat: readonly [number, number, number, number];
  val: readonly [number, number, number, number];
  /** Extra saturation a vivid colorway injects: the peasant's cream needs it
   *  (sat 0.3 times any multiplier stays pastel), the ranger's green does not. */
  satAdd: number;
}

/** Keyed by the kit material NAME as the GLBs ship it. */
export const SPIKE_KIT_DYE_BANDS: Record<string, KitBand> = {
  MI_Ranger: {
    ref: 115,
    band: 32,
    sat: [0.3, 0.45, 1, 1.1],
    val: [0, 0, 1, 1.1],
    satAdd: 0,
  },
  MI_Peasant: {
    ref: 44,
    band: 12,
    sat: [0.08, 0.18, 0.45, 0.6],
    val: [0.3, 0.42, 1, 1.1],
    satAdd: 0.22,
  },
};

/** The dye spec one kit material wears for one colorway, or null for the
 *  untouched atlas (classic, unknown colorway, or a non-kit material). */
export function spikeDyeSpec(materialName: string, outfit: OutfitColorway): ArmorDyeSpec | null {
  if (outfit === 'classic') return null;
  const kit = SPIKE_KIT_DYE_BANDS[materialName];
  if (!kit) return null;
  const def = OUTFIT_COLORWAYS.find((c) => c.id === outfit);
  if (!def) return null;
  return {
    rules: [
      {
        ref: kit.ref,
        band: kit.band,
        sat: kit.sat,
        val: kit.val,
        // 'rel' keeps the atlas's in-band shading variation alive; the hueless
        // colorways (onyx, ivory) keep the native hue and move only sat/val.
        hueMode: def.hue === null ? 'keep' : 'rel',
        hue: def.hue ?? 0,
        satMul: def.sat,
        satAdd: def.hue === null ? 0 : kit.satAdd,
        valMul: def.light,
        valAdd: 0,
      },
    ],
  };
}
