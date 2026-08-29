// Cloud layer tint math (Aphasya W7, docs/design/aphasya-visual-upgrade.md):
// the pure colour/opacity decisions behind the scrolling procedural cloud
// band that rides over the HDRI sky dome. The clouds take the same live
// grading the dome takes: the day/night multiplier darkens them into the
// night, the dusk warmth blushes them at the horizon hours, and deep night
// thins them so the star field stays the hero. Three/DOM-free (registered in
// RENDER_PURE_CORES); cloud_layer.ts pushes the result into its uniforms.

export interface CloudTint {
  r: number;
  g: number;
  b: number;
  opacity: number;
}

/** Base daylight cloud colour (soft warm white, painterly not pure white). */
export const CLOUD_BASE: readonly [number, number, number] = [0.94, 0.95, 0.97];
/** Dusk blush the warm hours mix toward. */
export const CLOUD_DUSK: readonly [number, number, number] = [1.08, 0.82, 0.62];
/** Full-day cloud opacity; night fades toward the floor below. */
export const CLOUD_DAY_OPACITY = 0.62;
/**
 * Deep-night opacity: a bare veil. Anything stronger reads as a dark blotch
 * blocking the star field (the darkened cloud colour sits OVER the stars),
 * with the disk's own rim showing as an arc across the night sky.
 */
export const CLOUD_NIGHT_OPACITY_FLOOR = 0.05;

/**
 * Resolve the cloud band's tint and opacity from the sky's live grading:
 * `dayMul` is the dome's per-channel day/night multiplier (1,1,1 full day),
 * `duskWarm` the warm horizon lobe strength in [0,1], `starAmt` the star
 * field strength (0 day, 1 deep night). Writes into `out` (alloc-free).
 */
export function cloudTint(
  dayMul: readonly [number, number, number],
  duskWarm: number,
  starAmt: number,
  out: CloudTint,
): void {
  const warm = Math.min(1, Math.max(0, duskWarm));
  const night = Math.min(1, Math.max(0, starAmt));
  const r = CLOUD_BASE[0] + (CLOUD_DUSK[0] - CLOUD_BASE[0]) * warm;
  const g = CLOUD_BASE[1] + (CLOUD_DUSK[1] - CLOUD_BASE[1]) * warm;
  const b = CLOUD_BASE[2] + (CLOUD_DUSK[2] - CLOUD_BASE[2]) * warm;
  out.r = r * dayMul[0];
  out.g = g * dayMul[1];
  out.b = b * dayMul[2];
  out.opacity = CLOUD_DAY_OPACITY + (CLOUD_NIGHT_OPACITY_FLOOR - CLOUD_DAY_OPACITY) * night;
}
