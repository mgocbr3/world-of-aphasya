import { describe, expect, it } from 'vitest';
import { CHARACTER_VISUAL_WORLD_SCALE as S } from '../src/render/characters/character_world_scale';
import { PREVIEW_FRAMING } from '../src/render/characters/preview_framing';

// The character turntable camera framing lives in a pure constants module so a
// Node test can pin the two framings without a WebGL context. The self character
// sheet frames close and face-on; the inspect window pulls the camera back so a
// tall silhouette (a pointed hat, a staff) stays inside the frame. The base
// numbers were tuned at manifest height and ride the world-proportion knob, so
// the pins express base times scale.

describe('PREVIEW_FRAMING', () => {
  it('pins the self-sheet framing (the classic close, face-on camera)', () => {
    expect(PREVIEW_FRAMING.sheet).toEqual({ y: 1.45 * S, z: 5.1 * S, lookY: 1.3 * S });
  });

  it('pins the pulled-back inspect framing', () => {
    expect(PREVIEW_FRAMING.inspect).toEqual({ y: 1.5 * S, z: 6.6 * S, lookY: 1.3 * S });
  });

  it('inspect sits farther back and slightly higher than the self sheet', () => {
    expect(PREVIEW_FRAMING.inspect.z).toBeGreaterThan(PREVIEW_FRAMING.sheet.z);
    expect(PREVIEW_FRAMING.inspect.y).toBeGreaterThan(PREVIEW_FRAMING.sheet.y);
  });
});
