import { describe, expect, it } from 'vitest';
import {
  APHASYA_BIOME_GRADES,
  GRADE_RESPONSE,
  gradeStateFrom,
  NEUTRAL_GRADE,
  stepGradeState,
  toneMappingChoice,
} from '../src/render/aphasya_grade_core';
import { OUTPUT_GRADE_FRAGMENT_SHADER } from '../src/render/post_output_grade';

describe('Aphasya biome grade core', () => {
  it('keeps the neutral grade byte-identical to the legacy hardcoded grade', () => {
    // These values were the shader constants before the grade became uniforms
    // (post_output_grade.ts LIFT/GAIN/GAMMA plus the 1.07 saturation mix). A
    // biome without an authored entry must reproduce the legacy frame exactly.
    expect(NEUTRAL_GRADE).toEqual({
      lift: [0.01, 0.008, 0.01],
      gain: [1.1, 1.035, 0.9],
      gamma: 0.975,
      sat: 1.07,
    });
  });

  it('covers every biome id with a grade entry', () => {
    const biomes = Object.keys(APHASYA_BIOME_GRADES);
    expect(biomes.length).toBeGreaterThanOrEqual(17);
    for (const biome of biomes) {
      const grade = APHASYA_BIOME_GRADES[biome as keyof typeof APHASYA_BIOME_GRADES];
      for (const v of [...grade.lift, ...grade.gain, grade.gamma, grade.sat]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(grade.sat).toBeGreaterThan(0.5);
      expect(grade.sat).toBeLessThan(1.5);
      expect(grade.gamma).toBeGreaterThan(0.8);
      expect(grade.gamma).toBeLessThan(1.2);
    }
  });

  it('authors the vale as the V1 showcase: warmer, more saturated, cooler shadows', () => {
    const vale = APHASYA_BIOME_GRADES.vale;
    expect(vale.sat).toBeGreaterThan(NEUTRAL_GRADE.sat);
    expect(vale.gain[0]).toBeGreaterThan(NEUTRAL_GRADE.gain[0]);
    expect(vale.lift[2]).toBeGreaterThan(vale.lift[0]);
  });

  it('eases toward the target and converges without overshoot', () => {
    const state = gradeStateFrom(NEUTRAL_GRADE);
    const target = APHASYA_BIOME_GRADES.vale;
    let prevDelta = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 200; i++) {
      stepGradeState(state, target, 1 / 60, GRADE_RESPONSE);
      const delta = Math.abs(state.sat - target.sat);
      expect(delta).toBeLessThanOrEqual(prevDelta + 1e-9);
      prevDelta = delta;
    }
    expect(state.sat).toBeCloseTo(target.sat, 3);
    expect(state.gain[0]).toBeCloseTo(target.gain[0], 3);
    expect(state.lift[2]).toBeCloseTo(target.lift[2], 3);
    expect(state.gamma).toBeCloseTo(target.gamma, 3);
  });

  it('lands exactly on the target for a degenerate huge dt', () => {
    const state = gradeStateFrom(NEUTRAL_GRADE);
    stepGradeState(state, APHASYA_BIOME_GRADES.vale, 1000);
    expect(state.sat).toBe(APHASYA_BIOME_GRADES.vale.sat);
  });

  it('parses the tonemap A/B flag with AgX as the shipped default', () => {
    expect(toneMappingChoice(undefined)).toBe('agx');
    expect(toneMappingChoice('')).toBe('agx');
    expect(toneMappingChoice('?gfx=high')).toBe('agx');
    expect(toneMappingChoice('?tonemap=agx')).toBe('agx');
    expect(toneMappingChoice('?gfx=high&tonemap=aces')).toBe('aces');
    expect(toneMappingChoice('?tonemap=aces')).toBe('aces');
    expect(toneMappingChoice('?tonemap=filmic')).toBe('agx');
  });

  it('keeps the output grade shader on uniforms, not baked constants', () => {
    for (const name of ['uLift', 'uGain', 'uGamma', 'uSat']) {
      expect(OUTPUT_GRADE_FRAGMENT_SHADER).toContain(name);
    }
    expect(OUTPUT_GRADE_FRAGMENT_SHADER).not.toContain('const vec3 LIFT');
    expect(OUTPUT_GRADE_FRAGMENT_SHADER).not.toContain('const vec3 GAIN');
  });
});
