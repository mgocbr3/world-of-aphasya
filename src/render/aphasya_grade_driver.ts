// The renderer-side driver for the eased per-biome ambience responses:
// the Aphasya output grade (aphasya_grade_core.ts pushed into
// OutputGradePass) and the god-ray zone strength, both stepped once per
// ambience update so a border crossing settles with the fog cross-fade
// instead of popping. Extracted from renderer.ts per the monolith ratchet;
// the pure math stays in the registered core, this module owns the state,
// the dev flags, and the uniform push.

import { ACESFilmicToneMapping, AgXToneMapping, type ToneMapping } from 'three';
import type { BiomeId } from '../sim/types';
import {
  APHASYA_BIOME_GRADES,
  gradeStateFrom,
  NEUTRAL_GRADE,
  nightNeutralizedGrade,
  stepGradeState,
  toneMappingChoice,
} from './aphasya_grade_core';
import type { OutputGradePass } from './post_output_grade';
import { renderLayerDisabled } from './render_dev_flags';

/**
 * Resolve the renderer's tone mapping from the `?tonemap=` A/B flag
 * (aphasya_grade_core.ts toneMappingChoice); AgX is the shipped default
 * since the direction approval, with `?tonemap=aces` as the legacy arm.
 */
export function aphasyaToneMapping(): ToneMapping {
  const search = typeof location === 'undefined' ? undefined : location.search;
  return toneMappingChoice(search) === 'agx' ? AgXToneMapping : ACESFilmicToneMapping;
}

export class AphasyaGradeDriver {
  private readonly state = gradeStateFrom(NEUTRAL_GRADE);
  private readonly target = gradeStateFrom(NEUTRAL_GRADE);
  // `?agrade=off` freezes the pass on its neutral legacy defaults.
  private readonly gradeOn = !renderLayerDisabled('agrade');
  // Eased per-biome god-ray strength: the shafts are "sun through bright air"
  // and read as detached glowing streaks over the twilight and gloom realms,
  // so those fade them out entirely (renderer BIOME_GOD_RAYS is the target).
  godRayScale = 1;

  /** Step both ambience eases and push the grade uniforms; alloc-free. */
  update(
    biome: BiomeId,
    dt: number,
    grade: OutputGradePass | null,
    godRayTarget: number | undefined,
    nightAmt = 0,
  ): void {
    const shaft = godRayTarget ?? 1;
    this.godRayScale += (shaft - this.godRayScale) * (1 - Math.exp(-2 * Math.max(0, dt)));
    if (!this.gradeOn || grade === null) return;
    nightNeutralizedGrade(APHASYA_BIOME_GRADES[biome], nightAmt, this.target);
    stepGradeState(this.state, this.target, dt);
    grade.setGrade(this.state.lift, this.state.gain, this.state.gamma, this.state.sat);
  }
}
