// Face proportions on a head that ships no shape keys.
//
// The body reshapes by scaling bones, but a face has no bones to scale: the
// skull is one joint. A pack head also carries no morph targets, so the usual
// answer (author a blend shape per feature) is not available without going back
// to a modelling tool for every head.
//
// So the features are found in the geometry instead: a FIELD over the head's
// own normalized frame (its bounding box mapped to a unit cube), sampled per
// vertex, that returns a displacement falling off smoothly to nothing at each
// feature's edge.
//
// A field rather than a per-mesh pass, and that is the load-bearing part. A
// head is several meshes (skull, eyes, brows, and whatever a generated race
// adds), each with its own transform and, because the shipped GLBs are meshopt
// quantized, its own coordinate range. Deriving the frame per mesh put the
// "nose" of the EYE mesh somewhere behind the eyeball and slid the eyes out of
// their sockets. One frame measured over the WHOLE head, sampled in that shared
// space, moves every piece by the same amount at the same place, so the parts
// stay welded to the face they sit in.
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

export type FaceAxis = 'nose' | 'jaw' | 'cheeks' | 'eyes' | 'brow' | 'chin' | 'ears' | 'smirk';

export const FACE_AXES: readonly FaceAxis[] = [
  'nose',
  'jaw',
  'cheeks',
  'eyes',
  'brow',
  'chin',
  'ears',
  'smirk',
];

export type FaceAxes = Partial<Record<FaceAxis, number>>;

/**
 * The head's own frame: the centre and half-extents of its bounding box, in
 * whatever units the caller measured. Regions are expressed against it, so one
 * table serves heads of different sizes and sculpts.
 */
export interface FaceFrame {
  centre: readonly [number, number, number];
  half: readonly [number, number, number];
}

/**
 * A feature's home in the head's normalized box: x is right, y is up and z is
 * forward, each in -1..1 with 0 at the head's centre. `radius` is how far the
 * influence reaches before it is gone.
 *
 * The centres are MEASURED off the shipped head rather than guessed: the eye
 * mesh's own bounds put the eyes, the brow mesh puts the brow, the most forward
 * vertex puts the nose tip and the widest one puts the ears. That is also why
 * one table serves every race: a generated skull is fitted to this same head,
 * so a feature sits where this table says it does.
 *
 * A region moves geometry two ways, and most features want both:
 *   `push`  translates along a direction (a chin juts, a brow overhangs).
 *   `grow`  scales about the region's own centre (a nose gets BIGGER, which a
 *           translation cannot express: pushing a nose forward past a certain
 *           point reads as a beak rather than a bigger nose).
 */
interface Region {
  centre: [number, number, number];
  radius: number;
  /** Displacement direction in the same frame, normalized by the caller. */
  push?: [number, number, number];
  /** Push distance at full slider, as a fraction of head height. */
  pushRange?: number;
  /** Scale about the centre at full slider (0.2 is a fifth bigger). */
  grow?: number;
  /** Mirror the region onto the other side of the face (eyes, cheeks, ears). */
  mirrored?: boolean;
}

// Radii are deliberately TIGHT. The first cut of this table used generous
// radii (0.34 to 0.5) and the result read as a melted face: the nose slider
// dragged the eyes and mouth with it, and "bigger nose" became "different
// person" (direction: "o rosto esta ficando deformado"). A feature slider
// should move its feature and leave the face around it recognizable.
const REGIONS: Record<FaceAxis, Region> = {
  // The nose tip is the most forward vertex on the head, at y -0.29. Mostly a
  // GROW so the whole nose changes size, with a little forward push behind it.
  nose: {
    centre: [0, -0.25, 0.88],
    radius: 0.22,
    push: [0, 0, 1],
    pushRange: 0.018,
    grow: 0.16,
  },
  // The jaw is WIDTH here, not length: the chin has its own slider, and a jaw
  // that got longer was doing the chin's job twice.
  jaw: {
    centre: [0.6, -0.62, 0.3],
    radius: 0.34,
    push: [1, 0, 0],
    pushRange: 0.03,
    mirrored: true,
  },
  // The cheekbones: out and slightly up, which is the line that reads across a
  // face at nameplate distance.
  cheeks: {
    centre: [0.72, -0.12, 0.45],
    radius: 0.3,
    push: [1, 0.25, 0.1],
    pushRange: 0.028,
    mirrored: true,
  },
  // Eye SIZE, so a grow about each eye's own centre (measured from the eye
  // mesh's bounds). The socket around it takes the same field, so the eyelid
  // opens with the eyeball instead of clipping through it.
  eyes: { centre: [0.37, 0.06, 0.55], radius: 0.24, grow: 0.15, mirrored: true },
  // The brow ridge, pushed forward and up: the difference between a heavy brow
  // and a smooth one, and the single most racial line on a face.
  brow: { centre: [0, 0.22, 0.66], radius: 0.28, push: [0, 0.35, 1], pushRange: 0.026 },
  // The chin: forward and down, which is what a strong chin does.
  chin: { centre: [0, -0.82, 0.55], radius: 0.26, push: [0, -0.55, 0.85], pushRange: 0.035 },
  // Ears sit at the widest point of the skull, behind the eye line. Grow, for
  // the same reason as the nose: an ear pushed sideways detaches from the head.
  ears: { centre: [0.95, 0.05, -0.25], radius: 0.26, grow: 0.2, mirrored: true },
  // The smirk is deliberately ONE-SIDED: a lift of the left mouth corner, which
  // is the whole difference between a smirk and a smile. The mouth sits between
  // the nose tip and the chin.
  smirk: { centre: [-0.28, -0.56, 0.74], radius: 0.2, push: [0, 1, 0.2], pushRange: 0.024 },
};

const clamp = (v: number): number => Math.min(1, Math.max(-1, v));

/** Smooth falloff to zero at the region edge, flat at its centre. */
function influence(dx: number, dy: number, dz: number, radius: number): number {
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;
  if (d >= 1) return 0;
  // Smoothstep on the remaining distance, then squared: zero slope at both
  // ends (the seam where the region runs out cannot show as a crease), and the
  // square concentrates the weight near the centre so a feature moves as a
  // feature instead of towing the whole neighbourhood along.
  const t = 1 - d;
  const smooth = t * t * (3 - 2 * t);
  return smooth * smooth;
}

/** The frame of a set of points: pass every mesh of the head, not just one. */
export function faceFrameOf(positions: Iterable<Float32Array>): FaceFrame {
  const lo: [number, number, number] = [Infinity, Infinity, Infinity];
  const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const buf of positions) {
    for (let i = 0; i + 2 < buf.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        const v = buf[i + a];
        if (v < lo[a]) lo[a] = v;
        if (v > hi[a]) hi[a] = v;
      }
    }
  }
  if (!Number.isFinite(lo[0])) return { centre: [0, 0, 0], half: [1, 1, 1] };
  return {
    centre: [(hi[0] + lo[0]) / 2, (hi[1] + lo[1]) / 2, (hi[2] + lo[2]) / 2],
    half: [
      Math.max(1e-6, (hi[0] - lo[0]) / 2),
      Math.max(1e-6, (hi[1] - lo[1]) / 2),
      Math.max(1e-6, (hi[2] - lo[2]) / 2),
    ],
  };
}

/**
 * The displacement at one point, in the frame's own units. Written into `out`;
 * returns true when anything moved, so a caller can skip the write.
 *
 * This is the whole deformation: every consumer (every mesh of the head, every
 * head of every race) samples this one function in one shared frame.
 */
export function faceDisplacementAt(
  x: number,
  y: number,
  z: number,
  axes: FaceAxes,
  frame: FaceFrame,
  out: [number, number, number],
): boolean {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  // Everything is expressed against head HEIGHT, so a wide head and a narrow
  // one move their noses by the same visible amount.
  const unit = frame.half[1];
  const nx = (x - frame.centre[0]) / frame.half[0];
  const ny = (y - frame.centre[1]) / frame.half[1];
  const nz = (z - frame.centre[2]) / frame.half[2];
  // Displacement dies out at the BOTTOM EDGE of the head's box: that edge is
  // the seam against the neck (the head is a rigid attachment; the neck is
  // skinned body geometry no face slider reaches), and a chin or jaw pushed at
  // full slider would otherwise open the seam into a visible crack. The fade
  // band sits below every region centre, so the sliders keep their reach and
  // only their last tail flattens.
  const seamFade =
    ny <= -1 ? 0 : ny >= -0.86 ? 1 : ((ny + 1) / 0.14) ** 2 * (3 - 2 * ((ny + 1) / 0.14));
  if (seamFade <= 0) return false;
  let moved = false;
  for (const axis of FACE_AXES) {
    const amount = clamp(axes[axis] ?? 0);
    if (amount === 0) continue;
    const region = REGIONS[axis];
    for (const side of region.mirrored ? [1, -1] : [1]) {
      const cx = region.centre[0] * side;
      const w =
        seamFade * influence(nx - cx, ny - region.centre[1], nz - region.centre[2], region.radius);
      if (w <= 0) continue;
      moved = true;
      const push = region.push;
      if (push) {
        const len = Math.hypot(push[0], push[1], push[2]) || 1;
        const step = amount * (region.pushRange ?? 0) * unit * w;
        // A mirrored region pushes each side outward, away from the midline, so
        // the sideways component follows the SIDE rather than the table. Keying
        // it on the side (not on the vertex's own x) also keeps the two halves
        // of a vertex near the midline from fighting each other.
        out[0] += (push[0] / len) * step * side;
        out[1] += (push[1] / len) * step;
        out[2] += (push[2] / len) * step;
      }
      if (region.grow) {
        // Scale about the region's centre, measured in the frame's own units so
        // the growth is isotropic rather than stretched by the box's aspect.
        const g = amount * region.grow * w;
        out[0] += (x - (frame.centre[0] + cx * frame.half[0])) * g;
        out[1] += (y - (frame.centre[1] + region.centre[1] * frame.half[1])) * g;
        out[2] += (z - (frame.centre[2] + region.centre[2] * frame.half[2])) * g;
      }
    }
  }
  return moved;
}

/**
 * Displace one mesh's vertices in place. `positions` is a flat xyz array; the
 * frame defaults to this array's own bounds, which is right only when the head
 * is a SINGLE mesh: a multi-mesh head measures the frame once over all of them
 * (faceFrameOf) and passes it here for each.
 *
 * Returns the number of vertices actually moved, which is what a test asserts
 * on: a region that reaches nothing means the table has drifted from the
 * geometry, and that is a silent failure otherwise.
 */
export function applyFaceAxes(
  positions: Float32Array,
  axes: FaceAxes,
  frame: FaceFrame = faceFrameOf([positions]),
): number {
  const count = positions.length / 3;
  if (count === 0 || faceAxesAreNeutral(axes)) return 0;
  const d: [number, number, number] = [0, 0, 0];
  let moved = 0;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (!faceDisplacementAt(x, y, z, axes, frame, d)) continue;
    positions[i * 3] = x + d[0];
    positions[i * 3 + 1] = y + d[1];
    positions[i * 3 + 2] = z + d[2];
    moved++;
  }
  return moved;
}

/** True when no axis asks for anything, so a caller can skip cloning entirely. */
export function faceAxesAreNeutral(axes: FaceAxes): boolean {
  return FACE_AXES.every((axis) => (axes[axis] ?? 0) === 0);
}
