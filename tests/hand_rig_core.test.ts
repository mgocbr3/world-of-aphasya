import { describe, expect, it } from 'vitest';
import {
  gripScaleFor,
  handRigOf,
  handSideOf,
  isHandBone,
  QUATERNIUS_BODY_NORMALIZE,
  stowBoneFor,
  QUATERNIUS_FALLBACK_FIT,
  QUATERNIUS_SHIELD_FIT,
  QUATERNIUS_VARIANT_FIT,
} from '../src/render/characters/hand_rig_core';

describe('hand rig identification', () => {
  it('names the rig a hand bone belongs to, through GLTFLoader sanitizing', () => {
    expect(handRigOf('handslot.r')).toBe('kaykit');
    expect(handRigOf('handslotr')).toBe('kaykit');
    expect(handRigOf('handslot.l')).toBe('kaykit');
    expect(handRigOf('hand_r')).toBe('quaternius');
    expect(handRigOf('hand_l')).toBe('quaternius');
  });

  it('rejects bones that are not hands, including near misses', () => {
    for (const bone of ['chest', 'spine_03', 'Head', 'hand_ik_r', 'lowerarm_r', '']) {
      expect(handRigOf(bone), bone).toBeNull();
      expect(isHandBone(bone), bone).toBe(false);
    }
  });

  it('treats every known rig as a hand, which is what the old test conflated', () => {
    expect(isHandBone('handslot.r')).toBe(true);
    expect(isHandBone('hand_l')).toBe(true);
  });

  it('reads the side off the suffix and defaults to the right', () => {
    expect(handSideOf('hand_l')).toBe('l');
    expect(handSideOf('handslot.l')).toBe('l');
    expect(handSideOf('hand_r')).toBe('r');
    expect(handSideOf('handslot.r')).toBe('r');
  });
});

describe('per-rig grip corrections', () => {
  it('leaves KayKit alone: the shared grip table is authored in its units', () => {
    expect(gripScaleFor('kaykit')).toBe(1);
  });

  it('shrinks the Quaternius grip by the body normalize, so a weapon matches', () => {
    // The bodies are authored short and scaled UP to the class rigs' height, so
    // anything on their bones inherits that factor; without the reciprocal a
    // sword rides about 40% oversized.
    expect(gripScaleFor('quaternius')).toBeCloseTo(1 / QUATERNIUS_BODY_NORMALIZE, 6);
    expect(gripScaleFor('quaternius')).toBeLessThan(1);
  });

  it('sheathes onto a bone each rig actually has', () => {
    expect(stowBoneFor('kaykit')).toBe('chest');
    expect(stowBoneFor('quaternius')).toBe('spine_03');
  });
});

describe('quaternius weapon fits', () => {
  it('covers every variant family the kaykit table names, at this rig scale', () => {
    for (const family of [
      'VAR_SWORD',
      'VAR_DAGGER',
      'VAR_STAFF',
      'VAR_AXE',
      'VAR_HAMMER',
      'VAR_MACE',
      'VAR_POLEARM',
      'VAR_WAND',
      'VAR_BOOK',
      'VAR_CROSSBOW',
      'VAR_BOW',
    ]) {
      const fit = QUATERNIUS_VARIANT_FIT[family];
      expect(fit, family).toBeDefined();
      expect(fit.scale, family).toBeGreaterThan(0.3);
      expect(fit.scale, family).toBeLessThan(0.8);
      expect(fit.lift, family).toBeGreaterThanOrEqual(0);
    }
    expect(QUATERNIUS_FALLBACK_FIT.scale).toBeGreaterThan(0.3);
    expect(QUATERNIUS_SHIELD_FIT.scale).toBeLessThan(0.5);
  });
});
