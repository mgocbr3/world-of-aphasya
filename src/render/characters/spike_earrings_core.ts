// Which node of the extracted earring set a chosen piercing style mounts.
//
// The twelve authored E2_* styles from the legacy modular library are shipped
// re-based into the spike head-bone frame as ONE GLB with a named node per
// style (scripts/assets/build_spike_earrings.mjs is the exporter and carries
// the space math). Unlike hair there is no coarse mapping here: every legacy
// style survived extraction, so the picker's choice mounts one to one.
//
// The material story mirrors the legacy path: `default` wears the authored
// mod_jewel_* factors baked into the GLB, and a picked jewel material repaints
// every surface of the worn set (modular.earringMaterialSpec answers which).

import type { EarringStyle, Gender } from './modular';
import type { SpikeRace } from './manifest';

/** The one shipped file; the manifest, the preload and the mount agree. */
export const SPIKE_EARRINGS_URL = 'models/chars/players/spike/earrings.glb';

/** The node inside SPIKE_EARRINGS_URL to mount, or null for bare ears. */
export function spikeEarringNode(style: EarringStyle): string | null {
  return style === 'none' ? null : `earring_${style}`;
}

/** How a mounted set adapts to the worn head. The shipped geometry is fitted
 *  to the human male head; every other head differs at the ear line, so the
 *  mount widens the whole set (scale x, both ears at once, the one transform
 *  that can) and rides the racial seat offset the head itself mounts with.
 *  Widths come from each head file's measured lobe band (|x| at y 0.05..0.12,
 *  human male 0.091), pulled part-way back because the band max is the ear
 *  TIP and jewelry hangs from the lobe, nearer the skull. */
export interface SpikeEarringFit {
  xScale: number;
  position: readonly [number, number, number];
}

const EARRING_FIT: Partial<Record<SpikeRace, SpikeEarringFit>> = {
  orc: { xScale: 1.4, position: [0, 0.024, 0.004] },
  elf: { xScale: 1.15, position: [0, 0.016, 0.002] },
  dwarf: { xScale: 1.15, position: [0, 0.012, 0] },
  // The necromancer's long ears anchor high and droop to the jaw: the ear
  // mass sits at y 0.02..0.08 with its widest bulge at x 0.111 (measured band
  // profile of head_necromancer.glb), far below and outside the human lobe
  // line the set ships at, so the set drops to the droop and widens to pierce
  // the bulge instead of floating at temple height.
  necromancer: { xScale: 1.38, position: [0, -0.065, -0.005] },
};

/** The fit for a head, or null for the human male baseline the file ships. */
export function spikeEarringFit(race: SpikeRace, gender: Gender): SpikeEarringFit | null {
  const raceFit = EARRING_FIT[race];
  if (raceFit) return raceFit;
  // The female head is a hair narrower at the ear (0.089 vs 0.091) and its
  // own sculpt: tuck the set in slightly so the hoops read as worn, not hung.
  if (gender === 'female') return { xScale: 0.96, position: [0, 0, -0.004] };
  return null;
}
