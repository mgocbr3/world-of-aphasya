// Pure camera-framing constants for the shared CharacterPreview turntable.
//
// Kept out of preview.ts (which imports three) so a Node test can pin the exact
// framings without a WebGL context. The self character sheet frames the model
// close and face-on (the classic character-screen pose); the inspect window pulls
// the camera back and a touch higher so a tall silhouette (a pointed hat, a
// staff) stays inside the frame. CharacterPreview.setFraming() applies one of
// these; the numbers here are the single source of truth for both.

import { CHARACTER_VISUAL_WORLD_SCALE } from './character_world_scale';

/** One camera framing: the eye height (y) and distance (z) on the view axis, and
 *  the height the camera aims at (lookY). x is fixed (the model is centered). */
export interface PreviewFraming {
  y: number;
  z: number;
  lookY: number;
}

// The base numbers were tuned when characters rendered at manifest height;
// they scale with the world-proportion knob so the smaller model keeps the
// same placement and apparent size in the frame (an unscaled camera aimed a
// head above the shrunken rig and parked it at the bottom of the preview).
const S = CHARACTER_VISUAL_WORLD_SCALE;

export const PREVIEW_FRAMING = {
  // Self character sheet: the classic close, face-on framing.
  sheet: { y: 1.45 * S, z: 5.1 * S, lookY: 1.3 * S },
  // Inspect another player: pulled back / raised so tall silhouettes stay framed.
  inspect: { y: 1.5 * S, z: 6.6 * S, lookY: 1.3 * S },
} as const satisfies Record<string, PreviewFraming>;

export type PreviewFramingName = keyof typeof PREVIEW_FRAMING;
