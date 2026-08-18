// Storybook grass math (Aphasya W3b, docs/design/aphasya-visual-upgrade.md):
// the pure pieces behind the blade carpet's hand-painted read. Two ideas:
//
// 1. A root-to-tip COLOUR ramp, not just a brightness lift: roots sit dark
//    and cool so blades visually grow out of the ground shadow, tips run
//    bright and warm like sun through thin leaves. The ramp multiplies the
//    per-spot ground tint (instanceColor), so the meadow still reads as one
//    grown surface; luminance at the endpoints matches the legacy grey ramp
//    (0.62 root, 1.18 tip) so the overall meadow tone does not shift.
// 2. Mid-frequency CLUMPING at about a two-yard wavelength, well under the
//    ~22yd lushness patches: blades gather into tufts with bigger blades at
//    the tuft heart and thin gaps between, instead of an even crop.
//
// Deterministic, Three/DOM-free (registered in RENDER_PURE_CORES); the
// carpet, the mid band, and the ground bake all consume the same functions
// so the three layers stay one look by construction.

export const STORYBOOK_ROOT: readonly [number, number, number] = [0.55, 0.63, 0.69];
export const STORYBOOK_TIP: readonly [number, number, number] = [1.26, 1.18, 0.9];

/**
 * Blade colour at height fraction `t` in [0,1], written into `out`. The ease
 * (t^0.8) keeps the lower half grounded and saves the warm shift for the
 * upper third, where the silhouette actually shows it.
 */
export function storybookBladeColor(t: number, out: [number, number, number]): void {
  const k = Math.min(1, Math.max(0, t)) ** 0.8;
  out[0] = STORYBOOK_ROOT[0] + (STORYBOOK_TIP[0] - STORYBOOK_ROOT[0]) * k;
  out[1] = STORYBOOK_ROOT[1] + (STORYBOOK_TIP[1] - STORYBOOK_ROOT[1]) * k;
  out[2] = STORYBOOK_ROOT[2] + (STORYBOOK_TIP[2] - STORYBOOK_ROOT[2]) * k;
}

const hash2 = (i: number, j: number, seed: number): number => {
  let h = (i * 374761393 + j * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** One octave of smooth value noise in [0,1]. */
const valueNoise = (x: number, z: number, seed: number): number => {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = smooth(x - i);
  const fz = smooth(z - j);
  const a = hash2(i, j, seed);
  const b = hash2(i + 1, j, seed);
  const c = hash2(i, j + 1, seed);
  const d = hash2(i + 1, j + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
};

/** Tuft wavelength control: about a 2.2yd clump cell. */
const CLUMP_FREQ = 0.45;

/**
 * Clump factor at a world position, in [0,1]: near 1 at a tuft heart, near 0
 * in the thin gaps between tufts. Two octaves sharpened through a smoothstep
 * band so hearts and gaps both read while the mean stays near 0.5.
 */
export function bladeClumpAt(x: number, z: number, seed: number): number {
  const n =
    valueNoise(x * CLUMP_FREQ, z * CLUMP_FREQ, seed ^ 0x51a7) * 0.72 +
    valueNoise(x * CLUMP_FREQ * 2.7, z * CLUMP_FREQ * 2.7, seed ^ 0x2e9d) * 0.28;
  const t = Math.min(1, Math.max(0, (n - 0.32) / 0.4));
  return smooth(t);
}

/**
 * Density multiplier for the placement gate: thins the gaps and packs the
 * hearts; equals 1 at the mean clump (0.5) so overall carpet cost holds.
 */
export function clumpDensityGate(clump: number): number {
  return 0.55 + 0.9 * clump;
}

/** Cluster scale multiplier: bigger blades at the tuft heart. */
export function clumpScale(clump: number): number {
  return 0.85 + 0.45 * clump;
}
