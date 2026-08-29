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

import type { EarringStyle } from './modular';

/** The one shipped file; the manifest, the preload and the mount agree. */
export const SPIKE_EARRINGS_URL = 'models/chars/players/spike/earrings.glb';

/** The node inside SPIKE_EARRINGS_URL to mount, or null for bare ears. */
export function spikeEarringNode(style: EarringStyle): string | null {
  return style === 'none' ? null : `earring_${style}`;
}
