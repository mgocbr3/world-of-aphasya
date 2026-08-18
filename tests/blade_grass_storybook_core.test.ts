import { describe, expect, it } from 'vitest';
import {
  bladeClumpAt,
  clumpDensityGate,
  clumpScale,
  meadowClusterScale,
  meadowCoverGate,
  STORYBOOK_ROOT,
  STORYBOOK_TIP,
  storybookBladeColor,
  tallGrassHeightScale,
  tallMeadowAt,
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

  it('carpets solid on lush soil: the cover gate fades the thinning out', () => {
    // dry ground keeps the pure clump gate (gaps read as intent)
    expect(meadowCoverGate(0, 0)).toBeCloseTo(clumpDensityGate(0), 5);
    expect(meadowCoverGate(1, 0)).toBeCloseTo(clumpDensityGate(1), 5);
    // fully lush ground over-saturates acceptance regardless of clump
    expect(meadowCoverGate(0, 1)).toBeCloseTo(1.15, 5);
    expect(meadowCoverGate(1, 1)).toBeCloseTo(1.15, 5);
    // mid-lush sits between and never dips below the dry gate
    expect(meadowCoverGate(0, 0.5)).toBeGreaterThan(clumpDensityGate(0));
    expect(meadowCoverGate(0.5, 0.5)).toBeGreaterThan(1);
  });

  it('carves coherent tall-meadow bands covering a minority of the field', () => {
    const seed = 42;
    let covered = 0;
    let max = 0;
    const N = 70;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const t = tallMeadowAt(i * 1.1, j * 1.1, seed);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(1);
        if (t > 0.1) covered++;
        max = Math.max(max, t);
      }
    }
    const frac = covered / (N * N);
    // bands exist (hearts reach full) but stay a minority of the field
    expect(max).toBeGreaterThan(0.9);
    expect(frac).toBeGreaterThan(0.05);
    expect(frac).toBeLessThan(0.45);
    expect(tallMeadowAt(3.7, 9.1, seed)).toBe(tallMeadowAt(3.7, 9.1, seed));
  });

  it('stretches tall clusters up to about three times and clamps the input', () => {
    expect(tallGrassHeightScale(0)).toBeCloseTo(1, 5);
    expect(tallGrassHeightScale(1)).toBeCloseTo(3, 5);
    expect(tallGrassHeightScale(2)).toBeCloseTo(3, 5);
    expect(tallGrassHeightScale(-1)).toBeCloseTo(1, 5);
  });

  it('grows clusters with lushness so blades overlap and hide the soil', () => {
    expect(meadowClusterScale(0)).toBeCloseTo(0.55, 5);
    expect(meadowClusterScale(1)).toBeCloseTo(1.33, 5);
    // clamped outside [0,1]
    expect(meadowClusterScale(2)).toBeCloseTo(1.33, 5);
    // always at least as large as the legacy 0.5 + lush * 0.6 curve
    for (const l of [0, 0.25, 0.5, 0.75, 1]) {
      expect(meadowClusterScale(l)).toBeGreaterThanOrEqual(0.5 + l * 0.6 - 1e-9);
    }
  });
});
