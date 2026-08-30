// The frame axis is the one appearance field that changes how big a character
// is drawn, so the pins here are the ones that keep it from changing anything
// else: 0 is exactly the sculpted body, the ends stay inside the range the
// town kit was authored for, and untrusted input clamps instead of throwing.
import { describe, expect, it } from 'vitest';
import {
  FRAME_MAX,
  FRAME_MIN,
  FRAME_SCALE_MAX,
  FRAME_SCALE_MIN,
  frameScale,
} from '../src/render/characters/character_frame_core';
import { DEFAULT_APPEARANCE, normalizeAppearance } from '../src/render/characters/modular';

describe('character frame', () => {
  it('leaves the sculpted body untouched at zero', () => {
    // Load-bearing: every character that existed before this axis stores no
    // frame at all, normalizes to 0, and must draw pixel-identically.
    expect(frameScale(0)).toBe(1);
    expect(DEFAULT_APPEARANCE.frame).toBe(0);
    expect(normalizeAppearance({}).frame).toBe(0);
    expect(frameScale(normalizeAppearance({}).frame)).toBe(1);
  });

  it('reaches its documented ends and nothing beyond them', () => {
    expect(frameScale(FRAME_MAX)).toBeCloseTo(FRAME_SCALE_MAX, 6);
    expect(frameScale(FRAME_MIN)).toBeCloseTo(FRAME_SCALE_MIN, 6);
    // Past the ends it clamps rather than extrapolating: the ceiling is where a
    // body still fits the town kit's doorways.
    expect(frameScale(99)).toBeCloseTo(FRAME_SCALE_MAX, 6);
    expect(frameScale(-99)).toBeCloseTo(FRAME_SCALE_MIN, 6);
  });

  it('is monotone across the axis', () => {
    let prev = 0;
    for (let t = FRAME_MIN; t <= FRAME_MAX + 1e-9; t += 0.1) {
      const s = frameScale(t);
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });

  it('treats a hostile stored value as a valid body, never as a failure', () => {
    // This rides the untrusted `app` wire field, so the whole contract is that
    // a bad value degrades to something drawable.
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
      expect(frameScale(bad as number)).toBe(1);
    }
    expect(normalizeAppearance({ frame: 12 } as never).frame).toBe(FRAME_MAX);
    expect(normalizeAppearance({ frame: -12 } as never).frame).toBe(FRAME_MIN);
    expect(normalizeAppearance({ frame: 'big' } as never).frame).toBe(0);
  });
});
