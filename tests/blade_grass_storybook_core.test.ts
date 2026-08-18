import { describe, expect, it } from 'vitest';
import {
  bladeClumpAt,
  clumpDensityGate,
  clumpScale,
  STORYBOOK_ROOT,
  STORYBOOK_TIP,
  storybookBladeColor,
} from '../src/render/blade_grass_storybook_core';

const luminance = (c: readonly [number, number, number]): number =>
  0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe('storybook blade colour ramp', () => {
  it('runs dark cool roots to bright warm tips with monotonic luminance', () => {
    const out: [number, number, number] = [0, 0, 0];
    let prev = -1;
    for (let i = 0; i <= 10; i++) {
      storybookBladeColor(i / 10, out);
      const l = luminance(out);
      expect(l).toBeGreaterThan(prev);
      prev = l;
    }
    // root reads cool (blue over red), tip reads warm (red over blue)
    expect(STORYBOOK_ROOT[2]).toBeGreaterThan(STORYBOOK_ROOT[0]);
    expect(STORYBOOK_TIP[0]).toBeGreaterThan(STORYBOOK_TIP[2]);
  });

  it('matches the legacy grey ramp endpoints in luminance so the meadow tone holds', () => {
    // Legacy vertex greys were 0.62 at the root and 1.18 at the tip.
    expect(luminance(STORYBOOK_ROOT)).toBeCloseTo(0.62, 1);
    expect(luminance(STORYBOOK_TIP)).toBeCloseTo(1.18, 1);
  });

  it('clamps out-of-range height fractions', () => {
    const lo: [number, number, number] = [0, 0, 0];
    const hi: [number, number, number] = [0, 0, 0];
    storybookBladeColor(-0.5, lo);
    storybookBladeColor(1.5, hi);
    expect(lo).toEqual([...STORYBOOK_ROOT]);
    expect(hi).toEqual([...STORYBOOK_TIP]);
  });
});

describe('storybook clump field', () => {
  it('is deterministic, bounded, and varies at the two-yard tuft scale', () => {
    const seed = 42;
    let min = 1;
    let max = 0;
    let sum = 0;
    const N = 60;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const v = bladeClumpAt(i * 0.8, j * 0.8, seed);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        min = Math.min(min, v);
        max = Math.max(max, v);
        sum += v;
      }
    }
    // hearts and gaps both exist, and the mean sits near the neutral 0.5 so
    // clumpDensityGate keeps the carpet's overall cost unchanged
    expect(min).toBeLessThan(0.1);
    expect(max).toBeGreaterThan(0.9);
    expect(sum / (N * N)).toBeGreaterThan(0.35);
    expect(sum / (N * N)).toBeLessThan(0.65);
    expect(bladeClumpAt(12.3, 45.6, seed)).toBe(bladeClumpAt(12.3, 45.6, seed));
    expect(bladeClumpAt(12.3, 45.6, seed)).not.toBe(bladeClumpAt(12.3, 45.6, seed + 1));
  });

  it('keeps the density gate neutral at the mean clump and bounded around it', () => {
    expect(clumpDensityGate(0.5)).toBeCloseTo(1, 5);
    expect(clumpDensityGate(0)).toBeCloseTo(0.55, 5);
    expect(clumpDensityGate(1)).toBeCloseTo(1.45, 5);
    expect(clumpScale(0.5)).toBeCloseTo(1.075, 3);
  });
});
