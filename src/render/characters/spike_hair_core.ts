// Which of the five shipped hairpieces a chosen hairstyle resolves to.
//
// The creator offers 37 hairstyles, authored as parts of the KayKit library.
// This rig has no part library, so hair arrives as standalone pieces mounted on
// the head bone, and the free tier ships five of them. Rather than cut the
// picker down to five entries (which would make the shipped game's creator
// depend on which pack the spike happens to use), every one of the 37 resolves
// to the nearest piece by SILHOUETTE: a player who picks a long style gets long
// hair, and one who picks anything cropped gets the buzz.
//
// The mapping is coarse and says so. That is the honest cost of five pieces
// standing in for 37, and it is also why the resolution lives in one small
// table: when more pieces are generated, entries move here and nothing else
// changes.

import type { BeardStyle, HairStyle } from './modular';

/** The pieces on disk, by the file suffix each is exported under. */
export type SpikeHairPiece = 'long' | 'buns' | 'parted' | 'buzzed' | 'beard';

/** Long hair: anything that falls past the jaw. */
const LONG: ReadonlySet<string> = new Set([
  'longwavy',
  'longcenterpart',
  'longpart',
  'curtains',
  'layered',
  'curls',
  'mullet',
  'warriorbraid',
  'braidcrown',
  'fantasybraid',
  'twinbraids',
  'afro',
  'curlyafro',
]);

/** Gathered: anything tied up, which reads as a knot from any angle. */
const GATHERED: ReadonlySet<string> = new Set([
  'topknot',
  'highbun',
  'lowbun',
  'halfbun',
  'highpony',
  'sidepony',
  'lowpony',
]);

/** Cropped: short enough that the skull shape still reads through it. */
const CROPPED: ReadonlySet<string> = new Set([
  'buzz',
  'crew',
  'crewcut',
  'pixie',
  'sweptpixie',
  'fauxhawk',
  'mohawk',
]);

/**
 * The piece to mount, or null for a bald head. Everything not in the three sets
 * above is a mid-length parted style, which is the middle of the range and the
 * safest default for anything new the creator grows.
 */
export function spikeHairPiece(style: HairStyle): SpikeHairPiece | null {
  if (style === 'bald') return null;
  if (LONG.has(style)) return 'long';
  if (GATHERED.has(style)) return 'buns';
  if (CROPPED.has(style)) return 'buzzed';
  return 'parted';
}

/**
 * Beards are one piece or none. The pack ships a single beard, so every style
 * with actual volume maps to it; the two that are stubble are a painted decal
 * on the shipped body and have no geometry to stand in for, so they read as
 * clean-shaven here rather than as a full beard, which would be the louder lie.
 */
export function spikeBeardPiece(style: BeardStyle): SpikeHairPiece | null {
  if (style === 'none' || style === 'stubble' || style === 'scruff') return null;
  return 'beard';
}

/** Every piece a build must ship, so the preload list cannot drift from this. */
export const SPIKE_HAIR_PIECES: readonly SpikeHairPiece[] = [
  'long',
  'buns',
  'parted',
  'buzzed',
  'beard',
];

/** Where a piece lives, so the manifest, the preload and the mount agree. */
export function spikeHairUrl(piece: SpikeHairPiece): string {
  return `models/chars/players/spike/hair_${piece}.glb`;
}
