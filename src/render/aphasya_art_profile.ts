// AphasyaArtProfile (GDD 8.1): the single home of the per-biome look tables.
//
// The rebrand's visual-upgrade plan (docs/design/aphasya-visual-upgrade.md, W1)
// calls for one central module declaring, per biome, the values that used to
// live scattered as renderer privates and sky locals. This is the MECHANICAL
// move: every table below was lifted verbatim (comments included) from where
// it lived, values byte-identical, so the diff of this change is pure
// relocation and the per-biome Aphasya retune that follows has one file to
// edit and one test pinning its coverage.
//
// The terrain colour arm of the profile stays physically in terrain_palette.ts
// (it was already a clean standalone table with its own consumers); it is
// re-exported here so the profile remains the one import point for "how does
// this biome look".
//
// Data only: no three.js, no DOM, colours are plain numbers.

import type { BiomeId } from '../sim/types';

export { BIOME_PALETTE } from './terrain_palette';

// Two skies are keyed by PLACE rather than biome: the Farshore isle's own
// day sky over the vale band, and the Vale Cup stadium's practice sky over
// the Sowfield. They ride the same tables under widened keys.
export type SkyKey = BiomeId | 'farshore' | 'vale_cup';

// Outdoor fog presets per biome (high tier eases between them as the player
// crosses zone bands; low keeps one preset everywhere). Distances are the
// pre-residency-clamp table opened back up (roughly x1.5): with the
// visible-zone streaming lane keeping neighbours resident before they can
// be seen, the fog no longer has to hide unloaded regions itself, so the
// sky and real vistas read again. fogFarForPreparedZones stays as the
// safety clamp for the brief window a build is still catching up. No far
// exceeds MAX_OUTDOOR_FOG_FAR (the rendering/culling envelope).
//
// The MURKY realms (marsh, haunt, frost, ember, dusk, amber and the two
// paint-only caves) then got a readability pass: their `near` was where the
// "cannot see anything in front of me" reports came from, since the chase
// camera sits ~12 yd behind the player and a near of 45 puts the fog barely
// 30 yd ahead of the character. `near` moves out further than `far` here,
// which does steepen those gradients slightly, but it is the plane the
// complaint is actually about and it costs nothing to draw. `far` moves only
// enough to keep each realm's silhouette depth (fog far drives terrain,
// prop and foliage culling, so it is the expensive half). The clear realms
// (vale, peaks, fen, jungle, garden, gale and friends) were already open and
// are untouched.
export const BIOME_FOG: Record<BiomeId, { color: number; near: number; far: number }> = {
  // The blue-sky biomes carry a deeper sky-blue haze (the old paler values
  // tonemapped to near white, so fully fogged distant trees and zones read
  // as white cutouts against the HDRI sky instead of far-off silhouettes).
  // 700 (not the 850 cap) on the open blue-sky realms: at 850 the last
  // visible hills sat almost fully outside the haze and the horizon read
  // cutout-crisp, with the same saturation at 400 yd as at 40. 700 puts real
  // aerial perspective on the far third while costing nothing near (and
  // fog-far drives culling, so the trim is a small draw-count win too).
  vale: { color: 0x7095bd, near: 55, far: 700 },
  // pale sage matched to the marsh horizon sky: the dome renders fog-free,
  // so a darker murk left every fully fogged silhouette as a cutout band
  marsh: { color: 0xc2cbb6, near: 75, far: 165 },
  peaks: { color: 0x8bb0d4, near: 55, far: 700 },
  beach: { color: 0x7ea6c9, near: 50, far: 700 },
  desert: { color: 0xd8c9a8, near: 50, far: 700 },
  volcano: { color: 0x8a7468, near: 60, far: 145 },
  cave: { color: 0x76807c, near: 48, far: 125 },
  // permanent dusk: rose-mauve murk, the realm's signature
  dusk: { color: 0xc9a3bd, near: 115, far: 400 },
  // scorched haze south, thicker toward the volcanic north (looks pass)
  ember: { color: 0x9a5844, near: 115, far: 385 },
  // the Frostveil: icy mist, the coldest sightlines in the world
  frost: { color: 0xa9bed2, near: 95, far: 325 },
  // the Amberfall: warm golden haze under an endless afternoon
  amber: { color: 0xdec18e, near: 130, far: 430 },
  // the Willowfen: clear airy morning, the lightest fog in the world
  // (deepened from 0xcfe2dc: the near-white haze tonemapped to a white
  // cutout band on the horizon instead of reading as distance, with the same
  // lesson as the blue-sky biomes above)
  fen: { color: 0xb7d0c6, near: 140, far: 510 },
  // the Nightbloom: a lavender dream-haze over the violet downs, deepened
  // to twilight with the realm's new dimmed light level
  night: { color: 0x8d7fc0, near: 110, far: 460 },
  // the Wraithwood: dead-grey murk, the tightest sightlines outdoors
  haunt: { color: 0x454c46, near: 85, far: 265 },
  // the Palmreach: bright humid haze, the clearest air in the world
  jungle: { color: 0xc2e0d0, near: 165, far: 600 },
  // the Evergarden: crystal parkland air with the faintest green cast
  garden: { color: 0xc6ddc6, near: 175, far: 630 },
  // the Galecrest: scrubbed salt air, dawn-lit haze off the sea
  gale: { color: 0xccc9d8, near: 170, far: 645 },
};

export const BATTLEGROUND_FOG = { color: 0xaecbe0, near: 70, far: 210 };

// Low tier trades view distance for draw count (its own perf knob, never a
// gameplay one: entities draw within their own much shorter ranges on every
// tier, so fog distance sheds only cosmetic scenery). Takes the same
// readability pass on `near`, with `far` held nearly still so the tier keeps
// paying for itself.
export const LOW_FOG = { color: 0xa6c6e0, near: 115, far: 340 };

// Per-biome outdoor light grade, eased alongside fog in updateAmbience.
// The three original biomes keep the exact constants the lights were
// created with; the dusk realm warms the sun to late-evening orange and
// turns the sky bounce rose over violet ground. The optional sun/hemi/env
// scales multiply the rig intensities, so a realm's mood can finally live
// in light LEVEL as well as hue (gloom via color luminance alone left the
// Nightbloom's canopies rendering in full daylight green).
export const BIOME_LIGHT: Record<
  BiomeId,
  {
    hemiSky: number;
    hemiGround: number;
    sun: number;
    sunScale?: number;
    hemiScale?: number;
    envScale?: number;
  }
> = {
  // GDD 4.1 colored shadows: periwinkle fill over live grass bounce, boosted
  vale: { hemiSky: 0xaec6ff, hemiGround: 0x587347, sun: 0xffedd0, hemiScale: 1.12 },
  marsh: { hemiSky: 0xdcefff, hemiGround: 0x465f39, sun: 0xffedd0 },
  peaks: { hemiSky: 0xdcefff, hemiGround: 0x465f39, sun: 0xffedd0 },
  dusk: { hemiSky: 0xffc9dd, hemiGround: 0x4d3f63, sun: 0xffb072 },
  ember: { hemiSky: 0xe89070, hemiGround: 0x422424, sun: 0xff7440 },
  frost: { hemiSky: 0x9cb6d6, hemiGround: 0x66748a, sun: 0xccdaea },
  amber: { hemiSky: 0xffe2b0, hemiGround: 0x5a4a30, sun: 0xffc86a },
  fen: { hemiSky: 0xdceeff, hemiGround: 0x51704e, sun: 0xfff0d2 },
  // the Nightbloom: dreamlight. A cool rose sun over lavender sky bounce
  // and deep violet ground: luminous, but at a twilight level. At full
  // day strength its canopies and downs rendered in ordinary daylight
  // green under the starfield sky
  night: {
    hemiSky: 0xc0b2f0,
    hemiGround: 0x463a6e,
    sun: 0xe6d4ff,
    sunScale: 0.6,
    hemiScale: 0.95,
    envScale: 0.7,
  },
  // the Wraithwood: sickly grey light strangled by the canopy, dim as
  // well as grey now that the rig has an intensity knob
  haunt: { hemiSky: 0x4d564c, hemiGround: 0x0e120e, sun: 0x6e7a66, sunScale: 0.8, envScale: 0.8 },
  // the Palmreach: hard tropical daylight over deep green bounce
  jungle: { hemiSky: 0xeafcff, hemiGround: 0x3a6a42, sun: 0xfff4d8 },
  // the Evergarden: soft perfect afternoon over clipped lawns
  garden: { hemiSky: 0xe8f8ff, hemiGround: 0x4a7a44, sun: 0xfff2d0 },
  // the Galecrest: cool dawn light, sea-grey bounce off the downs
  gale: { hemiSky: 0xe4e8f2, hemiGround: 0x4e6a52, sun: 0xffe8c8 },
  // paint-only biomes (map editor, never a built-in realm): beach reuses the
  // neutral vale grade, desert the amber warmth, volcano the ember glow, cave
  // the wraithwood gloom.
  beach: { hemiSky: 0xdcefff, hemiGround: 0x465f39, sun: 0xffedd0 },
  desert: { hemiSky: 0xffe2b0, hemiGround: 0x5a4a30, sun: 0xffc86a },
  volcano: { hemiSky: 0xe89070, hemiGround: 0x422424, sun: 0xff7440 },
  cave: { hemiSky: 0x4d564c, hemiGround: 0x0e120e, sun: 0x6e7a66, sunScale: 0.8, envScale: 0.8 },
};

// God-ray shaft strength per biome (default 1). The shafts sell a bright
// sun hanging in clear or golden air; under the Nightbloom's starfield
// twilight or the Wraithwood's grey murk the same additive streaks read as
// artifacts (a playtested report over the Nightbloom's lake), and the
// overcast/rain realms keep only a hint. Eased in updateAmbience so a
// border crossing fades the shafts instead of popping them.
export const BIOME_GOD_RAYS: Partial<Record<BiomeId, number>> = {
  night: 0,
  haunt: 0,
  cave: 0,
  dusk: 0.35,
  frost: 0.45,
  ember: 0.55,
  volcano: 0.3,
  marsh: 0.3,
};

// contrast (optional, default 1) is a pivot curve applied after the gain and
// before the clamp: values below the 0.8 pivot deepen and cloud shading above
// it spreads back out, recovering the texture detail the ACES highlight
// shoulder otherwise flattens to a white wash. Raise it per biome by eye.

export const HDRI_TUNE: Record<SkyKey, { gain: number; clamp: number; contrast?: number }> = {
  // clamp reined in from 2.6 with the contrast pass, so the re-expanded cloud
  // tops do not just feed the bloom smear instead
  vale: { gain: 0.6, clamp: 2.0, contrast: 1.25 },
  marsh: { gain: 0.6, clamp: 2.2 },
  peaks: { gain: 0.48, clamp: 1.7, contrast: 1.15 },
  // Paint-only biomes reuse the closest shipped sky (no new HDRI downloads).
  beach: { gain: 0.6, clamp: 2.6, contrast: 1.15 },
  desert: { gain: 0.55, clamp: 2.2 },
  volcano: { gain: 0.5, clamp: 2.0 },
  cave: { gain: 0.55, clamp: 2.0 },
  // the five realm skies are project-generated with their moods baked in
  // (storm-dark ember, dim frost twilight), so their gains sit close to the
  // vale's day instead of re-dimming an already-graded image.
  // The day skies take the vale's contrast treatment (pivot 0.8 in the dome
  // shader): it deepens the zenith against the horizon so the sky reads as a
  // gradient with a sun in it rather than one flat blue; the mood-dark skies
  // (ember, haunt, frost) are left alone so their murk stays lifted.
  dusk: { gain: 0.55, clamp: 2.2 },
  ember: { gain: 0.5, clamp: 2.0 },
  frost: { gain: 0.5, clamp: 2.0 },
  amber: { gain: 0.55, clamp: 2.2, contrast: 1.1 },
  fen: { gain: 0.6, clamp: 2.6, contrast: 1.15 },
  // the Nightbloom's dream sky is project-generated like its siblings
  night: { gain: 0.55, clamp: 2.2 },
  // the Wraithwood's storm gloom is project-generated with the darkness
  // baked in; the clamp still reins in the dying sun's water lane
  haunt: { gain: 0.6, clamp: 1.8 },
  // the Palmreach's own tropical day sky (skies_in/palmreach.png), graded
  // like the fen's bright day
  jungle: { gain: 0.62, clamp: 2.6, contrast: 1.15 },
  // the Evergarden's own day sky (skies_in/evergarden.png)
  garden: { gain: 0.6, clamp: 2.6, contrast: 1.15 },
  // the Galecrest's own storm-light sky (skies_in/galecrest.png)
  gale: { gain: 0.6, clamp: 2.6, contrast: 1.1 },
  // the Farshore's own day sky and the Vale Cup practice sky, graded bright
  farshore: { gain: 0.6, clamp: 2.6, contrast: 1.15 },
  vale_cup: { gain: 0.6, clamp: 2.6 },
};
