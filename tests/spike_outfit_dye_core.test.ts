// The spike kits' dye bands are MEASURED numbers (hue histograms over the
// packs' own BaseColor PNGs), so what this pins is the contract those
// measurements bought: classic touches nothing, every colorway builds exactly
// one rule per kit inside the shader's limits, and the windows keep the
// leather and trousers out of the cloth zone.
import { describe, expect, it } from 'vitest';
import { OUTFIT_COLORWAYS } from '../src/render/characters/modular';
import { SPIKE_KIT_DYE_BANDS, spikeDyeSpec } from '../src/render/characters/spike_outfit_dye_core';

describe('spike outfit dye', () => {
  it('classic and non-kit materials dye nothing', () => {
    expect(spikeDyeSpec('MI_Ranger', 'classic')).toBeNull();
    expect(spikeDyeSpec('MI_Superhero_Male', 'crimson')).toBeNull();
    expect(spikeDyeSpec('racial_skin', 'crimson')).toBeNull();
  });

  it('every hue colorway builds one in-limits rule for every kit', () => {
    // The multi-zone MATERIAL colorways (gilded and friends) are authored per
    // KayKit set and have no measured zones on these kits yet; they resolve
    // null here, which the runtime treats as classic.
    expect(spikeDyeSpec('MI_Ranger', 'gilded' as never)).toBeNull();
    for (const kit of Object.keys(SPIKE_KIT_DYE_BANDS)) {
      for (const { id: outfit } of OUTFIT_COLORWAYS) {
        if (outfit === 'classic') continue;
        const spec = spikeDyeSpec(kit, outfit);
        expect(spec, `${kit} ${outfit}`).not.toBeNull();
        expect(spec?.rules.length).toBe(1);
        const rule = spec?.rules[0];
        expect(rule?.band).toBeGreaterThan(0);
        expect(rule?.satMul).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the peasant trousers and ranger leather outside the cloth window', () => {
    // Measured off the atlases: trousers hue ~25 sat 0.71 val 0.16..0.23,
    // ranger leather hue ~25 sat 0.64. Both must fall outside their kit's
    // selector: the trousers by the sat ceiling and val floor, the leather by
    // the hue band.
    const peasant = SPIKE_KIT_DYE_BANDS.MI_Peasant;
    expect(0.71).toBeGreaterThan(peasant.sat[3]);
    expect(0.23).toBeLessThan(peasant.val[1]);
    const ranger = SPIKE_KIT_DYE_BANDS.MI_Ranger;
    expect(Math.abs(25 - ranger.ref)).toBeGreaterThan(ranger.band);
  });
});
