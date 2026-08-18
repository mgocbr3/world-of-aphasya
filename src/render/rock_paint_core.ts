// Storybook rock paint (Aphasya W3b, docs/design/aphasya-visual-upgrade.md):
// the pure vertex-colour math behind the boulder colourways. Three layers
// multiply the rock texture and the per-instance biome tint:
//
// 1. the top-facing blend toward the colourway tint (moss or snow dust) and
//    the underside AO the bake always had;
// 2. NEW: a painted vertical ramp, cool dark base into warm lit top, the
//    "AO pintado + gradiente" recipe from the Lusion storybook reference, so
//    a boulder reads as one painted form seated in the meadow instead of a
//    photographic grey egg.
//
// Deterministic and Three/DOM-free (registered in RENDER_PURE_CORES);
// foliage.ts's bakeTopTint feeds it the raw attribute arrays.

export interface RockPaintTint {
  r: number;
  g: number;
  b: number;
}

/** Cool shadowed base of the painted ramp. */
export const ROCK_BASE_MUL: readonly [number, number, number] = [0.64, 0.68, 0.78];
/** Warm lit top of the painted ramp. */
export const ROCK_TOP_MUL: readonly [number, number, number] = [1.1, 1.07, 0.98];

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Write the painted rock vertex colours for `count` vertices into `out`
 * (length count*3). `positions`/`normals` are the raw xyz attribute arrays.
 */
export function paintRockVertexColors(
  positions: ArrayLike<number>,
  normals: ArrayLike<number>,
  count: number,
  tint: RockPaintTint,
  out: Float32Array,
): void {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    const y = positions[i * 3 + 1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(1e-5, maxY - minY);
  for (let i = 0; i < count; i++) {
    const upness = normals[i * 3 + 1];
    const t = smoothstep(0.25, 0.85, upness);
    const ao = 1 + Math.min(0, upness) * 0.25;
    const hs = smoothstep(0, 1, (positions[i * 3 + 1] - minY) / span);
    const rampR = ROCK_BASE_MUL[0] + (ROCK_TOP_MUL[0] - ROCK_BASE_MUL[0]) * hs;
    const rampG = ROCK_BASE_MUL[1] + (ROCK_TOP_MUL[1] - ROCK_BASE_MUL[1]) * hs;
    const rampB = ROCK_BASE_MUL[2] + (ROCK_TOP_MUL[2] - ROCK_BASE_MUL[2]) * hs;
    out[i * 3] = (1 + (tint.r - 1) * t) * ao * rampR;
    out[i * 3 + 1] = (1 + (tint.g - 1) * t) * ao * rampG;
    out[i * 3 + 2] = (1 + (tint.b - 1) * t) * ao * rampB;
  }
}
