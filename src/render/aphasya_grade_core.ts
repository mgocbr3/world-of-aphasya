// Aphasya per-biome output grade: the pure targets and easing math behind the
// OutputGradePass uniforms (post_output_grade.ts). Phase V1 of the Aphasya
// visual direction (docs/design/aphasya-visual-upgrade.md): the final grade
// stops being one hardcoded look and follows the biome the camera is in,
// eased with the same feel as the sky/haze environment blends so a zone
// border never pops. Three/DOM-free on purpose (registered in
// RENDER_PURE_CORES); the renderer owns the per-frame push.
//
// NEUTRAL_GRADE is byte-for-byte the pre-Aphasya hardcoded grade, so a biome
// without an authored entry (and the `?agrade=off` kill switch) reproduces the
// legacy output exactly.

import type { BiomeId } from '../sim/types';

export interface BiomeGrade {
  /** Additive shadow lift per channel, applied after tone mapping. */
  readonly lift: readonly [number, number, number];
  /** Multiplicative gain per channel. */
  readonly gain: readonly [number, number, number];
  /** Output gamma (applied as pow(c, gamma)). */
  readonly gamma: number;
  /** Saturation mix past luminance (1 = neutral). */
  readonly sat: number;
}

/** The legacy hardcoded grade (post_output_grade.ts before Aphasya V1). */
export const NEUTRAL_GRADE: BiomeGrade = {
  lift: [0.01, 0.008, 0.01],
  gain: [1.1, 1.035, 0.9],
  gamma: 0.975,
  sat: 1.07,
};

// Authored per-biome targets, from the GDD's biome table (secao 9): the vale
// reads lush and golden with cool shadows, the marsh teal-violet, the peaks
// cold blue. Unauthored biomes stay neutral until their art pass.
export const APHASYA_BIOME_GRADES: Readonly<Record<BiomeId, BiomeGrade>> = {
  vale: {
    lift: [0.008, 0.008, 0.014],
    gain: [1.13, 1.05, 0.88],
    gamma: 0.965,
    sat: 1.16,
  },
  marsh: {
    lift: [0.012, 0.006, 0.016],
    gain: [1.02, 1.06, 0.97],
    gamma: 0.98,
    sat: 1.1,
  },
  peaks: {
    lift: [0.006, 0.008, 0.018],
    gain: [1.04, 1.05, 1.02],
    gamma: 0.975,
    sat: 1.08,
  },
  beach: NEUTRAL_GRADE,
  desert: NEUTRAL_GRADE,
  volcano: NEUTRAL_GRADE,
  cave: NEUTRAL_GRADE,
  dusk: NEUTRAL_GRADE,
  ember: NEUTRAL_GRADE,
  frost: NEUTRAL_GRADE,
  amber: NEUTRAL_GRADE,
  fen: NEUTRAL_GRADE,
  night: NEUTRAL_GRADE,
  haunt: NEUTRAL_GRADE,
  jungle: NEUTRAL_GRADE,
  garden: NEUTRAL_GRADE,
  gale: NEUTRAL_GRADE,
};

/** Mutable eased state the renderer owns; pushed into the pass uniforms. */
export interface GradeState {
  lift: [number, number, number];
  gain: [number, number, number];
  gamma: number;
  sat: number;
}

export function gradeStateFrom(grade: BiomeGrade): GradeState {
  return {
    lift: [grade.lift[0], grade.lift[1], grade.lift[2]],
    gain: [grade.gain[0], grade.gain[1], grade.gain[2]],
    gamma: grade.gamma,
    sat: grade.sat,
  };
}

/**
 * Per-second exponential response toward the target grade; matches the feel
 * of the sky/haze environment blends (a border crossing settles in about two
 * seconds, imperceptible against the fog cross-fade).
 */
export const GRADE_RESPONSE = 1.6;

/**
 * The `?tonemap=` A/B switch for the Aphasya direction: `agx` preserves
 * midtone saturation with a softer shoulder and is the SHIPPED DEFAULT
 * (direction approval 2026-08-18, dusk-vale A/B); `aces` is the legacy
 * comparison arm. Pure string parse so the decision is testable; the
 * renderer feeds it `location.search`.
 */
export function toneMappingChoice(search: string | undefined): 'aces' | 'agx' {
  if (!search) return 'agx';
  const m = /[?&]tonemap=(aces|agx)\b/.exec(search);
  return m ? (m[1] as 'aces' | 'agx') : 'agx';
}

/** Ease `state` toward `target` in place; alloc-free for the per-frame path. */
export function stepGradeState(
  state: GradeState,
  target: BiomeGrade,
  dt: number,
  response: number = GRADE_RESPONSE,
): void {
  const k = dt >= 1000 ? 1 : 1 - Math.exp(-response * Math.max(0, dt));
  for (let i = 0; i < 3; i++) {
    state.lift[i] += (target.lift[i] - state.lift[i]) * k;
    state.gain[i] += (target.gain[i] - state.gain[i]) * k;
  }
  state.gamma += (target.gamma - state.gamma) * k;
  state.sat += (target.sat - state.sat) * k;
}
