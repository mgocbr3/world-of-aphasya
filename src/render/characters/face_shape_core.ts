// Face proportions on a head that ships no shape keys.
//
// The body reshapes by scaling bones, but a face has no bones to scale: the
// skull is one joint. A pack head also carries no morph targets, so the usual
// answer (author a blend shape per feature) is not available without going back
// to a modelling tool for every head.
//
// So the features are found in the geometry instead. Each vertex is scored
// against a region defined in the head's OWN normalized frame (its bounding box
// mapped to a unit cube, which is the only frame two differently-sculpted heads
// share), and displaced by a weight that falls off smoothly to nothing at the
// region's edge. Nose, jaw, cheeks and eyes are all reachable this way because
// each sits in a distinct part of that box.
//
// Two properties this buys, both load-bearing:
//
//   * It works on ANY head. A generated orc, elf or dwarf skull needs no
//     authoring pass to gain the same sliders, which is the whole reason the
//     racial heads can be dropped in and immediately be customizable.
//   * The falloff means a slider can never tear the mesh: every displacement is
//     continuous, and neighbouring vertices move by nearly the same amount.
//
// Deliberately narrow ranges. These read as "this is a different person", not
// "this is a different species", which is the line a shared-rig MMO holds.

export type FaceAxis = 'nose' | 'jaw' | 'cheeks' | 'eyes' | 'brow';

export const FACE_AXES: readonly FaceAxis[] = ['nose', 'jaw', 'cheeks', 'eyes', 'brow'];

export type FaceAxes = Partial<Record<FaceAxis, number>>;

/** Displacement at full slider, as a fraction of head height. */
export const FACE_RANGE: Record<FaceAxis, number> = {
  nose: 0.05,
  jaw: 0.045,
  cheeks: 0.04,
  eyes: 0.035,
  brow: 0.03,
};

/**
 * A feature's home in the head's normalized box: x is right, y is up and z is
 * forward, each in -1..1 with 0 at the head's centre. `radius` is how far the
 * influence reaches before it is gone.
 *
 * These sit where a human face puts them and hold for any humanoid skull, which
 * is what lets one table serve every race: an orc's nose is bigger and flatter
 * than an elf's, but both are forward of centre and below the eyes.
 */
interface Region {
  centre: [number, number, number];
  radius: number;
  /** Displacement direction in the same frame, normalized by the caller. */
  push: [number, number, number];
  /** Mirror the region onto the other side of the face (eyes, cheeks). */
  mirrored?: boolean;
}

const REGIONS: Record<FaceAxis, Region> = {
  // Forward and slightly below centre, pushed along the view direction: a
  // bigger nose is a nose that comes further out of the face.
  nose: { centre: [0, -0.05, 0.85], radius: 0.42, push: [0, 0, 1] },
  // The bottom of the head, pushed DOWN and forward: a strong jaw is longer and
  // more prominent, not merely wider, which reads as swelling.
  jaw: { centre: [0, -0.75, 0.5], radius: 0.6, push: [0, -0.7, 0.7] },
  // The sides at mid height, pushed outward. Mirrored, so one slider moves both.
  cheeks: { centre: [0.8, -0.15, 0.35], radius: 0.55, push: [1, 0, 0], mirrored: true },
  // The eye sockets, pushed outward and forward so the eye reads larger rather
  // than merely further apart.
  eyes: { centre: [0.35, 0.15, 0.7], radius: 0.3, push: [0.4, 0, 1], mirrored: true },
  // The brow ridge, pushed forward and up: the difference between a heavy brow
  // and a smooth one, and the single most racial line on a face.
  brow: { centre: [0, 0.35, 0.7], radius: 0.4, push: [0, 0.3, 1] },
};

const clamp = (v: number): number => Math.min(1, Math.max(-1, v));

/** Smooth falloff to zero at the region edge, flat at its centre. */
function influence(dx: number, dy: number, dz: number, radius: number): number {
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
  if (d >= 1) return 0;
  // Smoothstep on the remaining distance: zero slope at both ends, so the seam
  // where the region runs out cannot show as a crease.
  const t = 1 - d;
  return t * t * (3 - 2 * t);
}

/**
 * Displace a head's vertices in place. `positions` is a flat xyz array in the
 * head's own coordinates; the bounding box is derived from it, so no caller has
 * to agree with this module about scale, origin or which way is up.
 *
 * Returns the number of vertices actually moved, which is what a test asserts
 * on: a region that reaches nothing means the table has drifted from the
 * geometry, and that is a silent failure otherwise.
 */
export function applyFaceAxes(positions: Float32Array, axes: FaceAxes): number {
  const count = positions.length / 3;
  if (count === 0) return 0;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let a = 0; a < 3; a++) {
      const v = positions[i * 3 + a];
      if (v < lo[a]) lo[a] = v;
      if (v > hi[a]) hi[a] = v;
    }
  }
  const centre = [0, 1, 2].map((a) => (hi[a] + lo[a]) / 2);
  const half = [0, 1, 2].map((a) => Math.max(1e-6, (hi[a] - lo[a]) / 2));
  // Everything is expressed against head HEIGHT, so a wide head and a narrow
  // one move their noses by the same visible amount.
  const unit = half[1];

  let moved = 0;
  for (const axis of FACE_AXES) {
    const amount = clamp(axes[axis] ?? 0);
    if (amount === 0) continue;
    const region = REGIONS[axis];
    const push = region.push;
    const pushLen = Math.hypot(push[0], push[1], push[2]) || 1;
    const step = amount * FACE_RANGE[axis] * unit;
    const sides = region.mirrored ? [1, -1] : [1];
    for (let i = 0; i < count; i++) {
      const nx = (positions[i * 3] - centre[0]) / half[0];
      const ny = (positions[i * 3 + 1] - centre[1]) / half[1];
      const nz = (positions[i * 3 + 2] - centre[2]) / half[2];
      let w = 0;
      for (const side of sides) {
        w += influence(
          nx - region.centre[0] * side,
          ny - region.centre[1],
          nz - region.centre[2],
          region.radius,
        );
      }
      if (w <= 0) continue;
      // A mirrored region pushes each side outward, away from the midline, so
      // the sign follows the vertex rather than the table.
      const dir = region.mirrored && nx < 0 ? -1 : 1;
      positions[i * 3] += (push[0] / pushLen) * step * w * dir;
      positions[i * 3 + 1] += (push[1] / pushLen) * step * w;
      positions[i * 3 + 2] += (push[2] / pushLen) * step * w;
      moved++;
    }
  }
  return moved;
}

/** True when no axis asks for anything, so a caller can skip cloning entirely. */
export function faceAxesAreNeutral(axes: FaceAxes): boolean {
  return FACE_AXES.every((axis) => (axes[axis] ?? 0) === 0);
}
