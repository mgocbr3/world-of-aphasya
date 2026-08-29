// The spike look bindings translate the creator's stored appearance onto the
// Quaternius rig. The skin rule is the one worth pinning: a RACE owns its skin
// (the orc stays green whatever the wheel says, throat included), and only the
// raceless human answers to the player's skin-tone wheel.
import { describe, expect, it } from 'vitest';
import { SPIKE_RACE_SKIN } from '../src/render/characters/manifest';
import { DEFAULT_APPEARANCE, skinColor } from '../src/render/characters/modular';
import { spikeSkinTone } from '../src/render/characters/spike_shape_bindings';

describe('spike skin tone resolution', () => {
  it('gives every race with a fixed skin exactly that skin', () => {
    for (const race of ['orc', 'elf', 'dwarf', 'necromancer'] as const) {
      const fixed = SPIKE_RACE_SKIN[race];
      expect(fixed, race).not.toBeNull();
      expect(spikeSkinTone(DEFAULT_APPEARANCE, race)).toBe(fixed);
      // ...and the wheel cannot move it: race reads through skin everywhere.
      const tanned = { ...DEFAULT_APPEARANCE, skinHue: 120, skinSat: 1, skinLight: 0.2 };
      expect(spikeSkinTone(tanned, race)).toBe(fixed);
    }
  });

  it('lets the human follow the skin-tone wheel', () => {
    expect(SPIKE_RACE_SKIN.human).toBeNull();
    expect(spikeSkinTone(DEFAULT_APPEARANCE, 'human')).toBe(skinColor(DEFAULT_APPEARANCE));
    const dark = { ...DEFAULT_APPEARANCE, skinLight: 0.3 };
    expect(spikeSkinTone(dark, 'human')).toBe(skinColor(dark));
    expect(spikeSkinTone(dark, 'human')).not.toBe(spikeSkinTone(DEFAULT_APPEARANCE, 'human'));
  });
});
