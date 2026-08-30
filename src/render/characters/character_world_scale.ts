// The Aphasya character-to-world proportion knob (direction call,
// 2026-08-18): the chibi rigs read too large against the building kit, near
// door height beside the town houses, so every character-manifest visual
// (players, NPCs, mobs, mounts) renders at a uniform fraction of its
// manifest height. RENDER-ONLY on purpose: sim collision, combat reach, and
// interact ranges keep the original dimensions, so nothing deterministic
// moves; the click proxy, nameplate anchor, and far-mesh offsets all derive
// from the scaled height and follow. Uniform across the whole cast so
// relative combat scale (wolf vs player vs boss) is untouched.

// 0.7 is a flat THIRTY PERCENT off the upstream size. Upstream applies no
// factor at all (`normScale = def.height / rawHeight`), so its humanoid is
// the manifest's 2.6 units and ours is 1.82. Stated against upstream rather
// than against the previous 0.74 on purpose: the baseline anyone can check
// out and compare is the unmodified game, not an earlier tuning of ours.
export const CHARACTER_VISUAL_WORLD_SCALE = 0.7;

/** A manifest def height brought into world proportion. */
export function scaledVisualHeight(defHeight: number): number {
  return defHeight * CHARACTER_VISUAL_WORLD_SCALE;
}
