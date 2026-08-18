import { describe, expect, it } from 'vitest';
import {
  paintRockVertexColors,
  ROCK_BASE_MUL,
  ROCK_TOP_MUL,
} from '../src/render/rock_paint_core';

// A four-vertex probe rock: a bottom vertex facing down, a bottom side vertex,
// a top side vertex, and a top vertex facing straight up.
const positions = [0, 0, 0, 1, 0, 0, 1, 2, 0, 0, 2, 0];
const normals = [0, -1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0];
const NEUTRAL = { r: 1, g: 1, b: 1 };
const MOSS = { r: 0.62, g: 0.82, b: 0.45 };

describe('storybook rock paint', () => {
  it('ramps from the cool dark base to the warm lit top', () => {
    const out = new Float32Array(12);
    paintRockVertexColors(positions, normals, 4, NEUTRAL, out);
    // bottom side vertex carries the pure base multiplier, top side the top one
    expect(out[3]).toBeCloseTo(ROCK_BASE_MUL[0], 5);
    expect(out[5]).toBeCloseTo(ROCK_BASE_MUL[2], 5);
    expect(out[6]).toBeCloseTo(ROCK_TOP_MUL[0], 5);
    expect(out[8]).toBeCloseTo(ROCK_TOP_MUL[2], 5);
    // base reads cooler than it is red, top warmer than it is blue
    expect(out[5]).toBeGreaterThan(out[3]);
    expect(out[6]).toBeGreaterThan(out[8]);
  });

  it('keeps the underside AO and applies the colourway tint only on top faces', () => {
    const out = new Float32Array(12);
    paintRockVertexColors(positions, normals, 4, MOSS, out);
    // down-facing bottom vertex: AO x base ramp, no moss
    expect(out[0]).toBeCloseTo(0.75 * ROCK_BASE_MUL[0], 5);
    // up-facing top vertex: full moss tint times the top ramp
    expect(out[9]).toBeCloseTo(MOSS.r * ROCK_TOP_MUL[0], 5);
    expect(out[10]).toBeCloseTo(MOSS.g * ROCK_TOP_MUL[1], 5);
    // side vertices never take the moss (their green stays ramp-only)
    expect(out[4]).toBeCloseTo(ROCK_BASE_MUL[1], 5);
  });

  it('is deterministic and safe on a degenerate flat geometry', () => {
    const flatPos = [0, 1, 0, 2, 1, 0];
    const flatNrm = [0, 1, 0, 0, 1, 0];
    const a = new Float32Array(6);
    const b = new Float32Array(6);
    paintRockVertexColors(flatPos, flatNrm, 2, NEUTRAL, a);
    paintRockVertexColors(flatPos, flatNrm, 2, NEUTRAL, b);
    expect([...a]).toEqual([...b]);
    for (const v of a) expect(Number.isFinite(v)).toBe(true);
  });
});
