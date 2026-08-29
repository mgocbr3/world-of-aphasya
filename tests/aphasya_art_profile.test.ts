// The AphasyaArtProfile (GDD 8.1) is the single home of the per-biome look
// tables. Two things are pinned here. COVERAGE: every biome the sim can name
// has a fog row, a light row and a sky tune row, and the place-keyed skies
// exist, so a new biome cannot ship half-looked. VALUES: a spot row per table
// is pinned exactly, because the profile was created by MOVING tables out of
// the renderer and the sky module verbatim, and a silent value drift during
// that kind of relocation is precisely the bug a reader will not catch by eye.
import { describe, expect, it } from 'vitest';
import {
  BATTLEGROUND_FOG,
  BIOME_FOG,
  BIOME_GOD_RAYS,
  BIOME_LIGHT,
  BIOME_PALETTE,
  HDRI_TUNE,
  LOW_FOG,
} from '../src/render/aphasya_art_profile';
import type { BiomeId } from '../src/sim/types';

// The full biome union, spelled out: a type cannot be iterated at runtime, and
// this list going stale fails loudly the moment a table gains the new biome.
const BIOMES: readonly BiomeId[] = [
  'vale',
  'marsh',
  'peaks',
  'beach',
  'desert',
  'volcano',
  'cave',
  'dusk',
  'ember',
  'frost',
  'amber',
  'fen',
  'night',
  'haunt',
  'jungle',
  'garden',
  'gale',
];

describe('AphasyaArtProfile coverage', () => {
  it('carries fog, light, sky tune and terrain palette for every biome', () => {
    for (const biome of BIOMES) {
      expect(BIOME_FOG[biome], `fog ${biome}`).toBeDefined();
      expect(BIOME_LIGHT[biome], `light ${biome}`).toBeDefined();
      expect(HDRI_TUNE[biome], `sky ${biome}`).toBeDefined();
      expect(BIOME_PALETTE[biome], `palette ${biome}`).toBeDefined();
    }
    expect(Object.keys(BIOME_FOG).sort()).toEqual([...BIOMES].sort());
  });

  it('keys the place skies and keeps god rays a subset of real biomes', () => {
    expect(HDRI_TUNE.farshore).toBeDefined();
    expect(HDRI_TUNE.vale_cup).toBeDefined();
    for (const key of Object.keys(BIOME_GOD_RAYS)) {
      expect(BIOMES).toContain(key as BiomeId);
    }
  });

  it('fog distances stay ordered and positive on every row', () => {
    for (const [biome, fog] of Object.entries(BIOME_FOG)) {
      expect(fog.near, biome).toBeGreaterThan(0);
      expect(fog.far, biome).toBeGreaterThan(fog.near);
    }
    expect(LOW_FOG.far).toBeGreaterThan(LOW_FOG.near);
    expect(BATTLEGROUND_FOG.far).toBeGreaterThan(BATTLEGROUND_FOG.near);
  });

  it('pins one spot row per table against the values the move carried over', () => {
    expect(BIOME_FOG.vale).toEqual({ color: 0x7095bd, near: 55, far: 700 });
    expect(BIOME_LIGHT.vale).toEqual({
      hemiSky: 0xaec6ff,
      hemiGround: 0x587347,
      sun: 0xffedd0,
      hemiScale: 1.12,
    });
    expect(HDRI_TUNE.vale).toEqual({ gain: 0.6, clamp: 2.0, contrast: 1.25 });
    expect(BIOME_GOD_RAYS.night).toBe(0);
    expect(LOW_FOG).toEqual({ color: 0xa6c6e0, near: 115, far: 340 });
    expect(BATTLEGROUND_FOG).toEqual({ color: 0xaecbe0, near: 70, far: 210 });
  });
});
