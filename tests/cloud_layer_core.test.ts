import { describe, expect, it } from 'vitest';
import {
  CLOUD_BASE,
  CLOUD_DAY_OPACITY,
  CLOUD_DUSK,
  CLOUD_NIGHT_OPACITY_FLOOR,
  cloudTint,
} from '../src/render/cloud_layer_core';

const FULL_DAY: readonly [number, number, number] = [1, 1, 1];

describe('cloud layer tint', () => {
  it('is the soft warm white at full day with no dusk', () => {
    const out = { r: 0, g: 0, b: 0, opacity: 0 };
    cloudTint(FULL_DAY, 0, 0, out);
    expect(out.r).toBeCloseTo(CLOUD_BASE[0], 5);
    expect(out.g).toBeCloseTo(CLOUD_BASE[1], 5);
    expect(out.b).toBeCloseTo(CLOUD_BASE[2], 5);
    expect(out.opacity).toBeCloseTo(CLOUD_DAY_OPACITY, 5);
  });

  it('blushes warm at dusk: red rises over blue', () => {
    const out = { r: 0, g: 0, b: 0, opacity: 0 };
    cloudTint(FULL_DAY, 1, 0, out);
    expect(out.r).toBeCloseTo(CLOUD_DUSK[0], 5);
    expect(out.b).toBeCloseTo(CLOUD_DUSK[2], 5);
    expect(out.r).toBeGreaterThan(out.b);
  });

  it('darkens with the night multiplier and thins toward the star floor', () => {
    const out = { r: 0, g: 0, b: 0, opacity: 0 };
    cloudTint([0.2, 0.22, 0.3], 0, 1, out);
    expect(out.r).toBeCloseTo(CLOUD_BASE[0] * 0.2, 5);
    expect(out.b).toBeCloseTo(CLOUD_BASE[2] * 0.3, 5);
    expect(out.opacity).toBeCloseTo(CLOUD_NIGHT_OPACITY_FLOOR, 5);
  });

  it('clamps out-of-range dusk and star inputs', () => {
    const out = { r: 0, g: 0, b: 0, opacity: 0 };
    cloudTint(FULL_DAY, 2.5, -1, out);
    expect(out.r).toBeCloseTo(CLOUD_DUSK[0], 5);
    expect(out.opacity).toBeCloseTo(CLOUD_DAY_OPACITY, 5);
  });
});
