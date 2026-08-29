import { describe, expect, it } from 'vitest';
import {
  AXIS_RANGE,
  BODY_AXES,
  bodyHeightScale,
  bodyScalePlan,
} from '../src/render/characters/body_shape_core';
import {
  applyFaceAxes,
  FACE_AXES,
  faceAxesAreNeutral,
  faceDisplacementAt,
  faceFrameOf,
} from '../src/render/characters/face_shape_core';

const byBone = (axes: Parameters<typeof bodyScalePlan>[0]) =>
  new Map(bodyScalePlan(axes).map((s) => [s.bone, s]));

describe('body proportions by bone scale', () => {
  it('describes the whole body even at neutral, so re-applying restores a rig', () => {
    // The plan is a complete description rather than a diff: that is what lets
    // a creator drag a slider back to zero and get the sculpted body back
    // without rebuilding the character.
    const plan = bodyScalePlan({});
    expect(plan.length).toBeGreaterThan(8);
    for (const step of plan) expect(step.scale).toEqual([1, 1, 1]);
  });

  it('thickens the torso without making it taller', () => {
    const spine = byBone({ build: 1 }).get('spine_02');
    expect(spine?.scale[0]).toBeCloseTo(1 + AXIS_RANGE.build, 6);
    expect(spine?.scale[2]).toBeCloseTo(1 + AXIS_RANGE.build, 6);
    expect(spine?.scale[1]).toBe(1);
  });

  it('undoes torso scale on the neck and both arms, or a broad chest swells the head', () => {
    const spine = byBone({ build: 1 }).get('spine_03');
    expect(spine?.compensate).toContain('neck_01');
    expect(spine?.compensate).toEqual(expect.arrayContaining(['clavicle_l', 'clavicle_r']));
  });

  it('grows a limb along its own +Y and thickens it on the other two', () => {
    const arm = byBone({ armLength: 1, armWidth: -1 }).get('upperarm_l');
    expect(arm?.scale[1]).toBeCloseTo(1 + AXIS_RANGE.armLength, 6);
    expect(arm?.scale[0]).toBeCloseTo(1 - AXIS_RANGE.armWidth, 6);
    expect(arm?.scale[0]).toBe(arm?.scale[2]);
  });

  it('keeps hands and feet out of the limb scale, so held weapons stay put', () => {
    const plan = byBone({ armLength: 1, legLength: 1 });
    expect(plan.get('lowerarm_l')?.compensate).toContain('hand_l');
    expect(plan.get('lowerarm_r')?.compensate).toContain('hand_r');
    expect(plan.get('calf_l')?.compensate).toContain('foot_l');
  });

  it('scales the head uniformly with nothing to undo beneath it', () => {
    const head = byBone({ headSize: 1 }).get('Head');
    expect(head?.scale[0]).toBeCloseTo(1 + AXIS_RANGE.headSize, 6);
    expect(new Set(head?.scale).size).toBe(1);
    expect(head?.compensate).toEqual([]);
  });

  it('clamps a slider past its ends rather than trusting the caller', () => {
    expect(bodyHeightScale({ height: 99 })).toBeCloseTo(1 + AXIS_RANGE.height, 6);
    expect(bodyHeightScale({ height: -99 })).toBeCloseTo(1 - AXIS_RANGE.height, 6);
  });

  it('holds every range under a fifth, the line between a person and a monster', () => {
    for (const axis of BODY_AXES) expect(AXIS_RANGE[axis]).toBeLessThanOrEqual(0.2);
  });
});

/** A humanoid head stand-in: a sphere of vertices spanning a unit-ish box.
 *  Dense enough (48 x 48) that even the tightest region in the table lands on
 *  several vertices; a real head is an order of magnitude denser still. */
function headPoints(): Float32Array {
  const pts: number[] = [];
  for (let i = 0; i < 48; i++) {
    for (let j = 0; j < 48; j++) {
      const theta = (i / 47) * Math.PI;
      const phi = (j / 47) * Math.PI * 2;
      pts.push(
        0.4 * Math.sin(theta) * Math.cos(phi),
        0.5 * Math.cos(theta),
        0.42 * Math.sin(theta) * Math.sin(phi),
      );
    }
  }
  // A bare sphere has no eyes and no brow ridge: those regions are measured
  // off the real head's own eye and brow meshes, which sit INSIDE the skull's
  // bounding sphere where no spherical shell passes. Give the fixture a small
  // cluster at each (in normalized-box coordinates scaled by the half extents
  // 0.4, 0.5, 0.42), the way the real head puts geometry there.
  const features: Array<[number, number, number]> = [
    [0.37, 0.06, 0.55],
    [-0.37, 0.06, 0.55],
    [0, 0.22, 0.66],
  ];
  for (const [nx, ny, nz] of features) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      pts.push((nx + 0.04 * Math.cos(a)) * 0.4, (ny + 0.04 * Math.sin(a)) * 0.5, nz * 0.42);
    }
  }
  return new Float32Array(pts);
}

describe('face proportions by region displacement', () => {
  it('does nothing at neutral, so a caller can skip cloning the head', () => {
    expect(faceAxesAreNeutral({})).toBe(true);
    expect(faceAxesAreNeutral({ nose: 0, jaw: 0 })).toBe(true);
    expect(faceAxesAreNeutral({ nose: 0.2 })).toBe(false);
    const points = headPoints();
    const before = Float32Array.from(points);
    expect(applyFaceAxes(points, {})).toBe(0);
    expect(points).toEqual(before);
  });

  it('reaches real geometry for every axis, which is what catches a drifted table', () => {
    for (const axis of FACE_AXES) {
      expect(applyFaceAxes(headPoints(), { [axis]: 1 }), axis).toBeGreaterThan(0);
    }
  });

  it('pushes the nose forward and leaves the back of the head alone', () => {
    const points = headPoints();
    const before = Float32Array.from(points);
    applyFaceAxes(points, { nose: 1 });
    let front = 0;
    let back = 0;
    for (let i = 0; i < points.length / 3; i++) {
      const dz = points[i * 3 + 2] - before[i * 3 + 2];
      if (before[i * 3 + 2] > 0.3) front += dz;
      if (before[i * 3 + 2] < -0.3) back += Math.abs(dz);
    }
    expect(front).toBeGreaterThan(0);
    expect(back).toBe(0);
  });

  it('mirrors the cheeks outward on both sides rather than shifting the face', () => {
    const points = headPoints();
    const before = Float32Array.from(points);
    applyFaceAxes(points, { cheeks: 1 });
    let left = 0;
    let right = 0;
    for (let i = 0; i < points.length / 3; i++) {
      const dx = points[i * 3] - before[i * 3];
      if (before[i * 3] > 0.2) right += dx;
      if (before[i * 3] < -0.2) left += dx;
    }
    expect(right).toBeGreaterThan(0);
    expect(left).toBeLessThan(0);
    // Magnitudes, not a sum: the sampled sphere in this fixture is not exactly
    // symmetric, so an exact cancellation would be testing the fixture.
    expect(Math.abs(right + left)).toBeLessThan(Math.abs(right) * 0.1);
  });

  it('displaces a separate face patch with the head around it, not with its own bounds', () => {
    // The bug this pins: a head is several meshes (skull, eyes, brows), and
    // measuring the frame per MESH puts the nose region of a small eye patch
    // somewhere behind the eyeball, so the eyes slid out of their sockets. A
    // patch cut from the head's own surface must move exactly as the surface
    // around it moves, which is only true against the WHOLE head's frame.
    const skull = headPoints();
    const frame = faceFrameOf([skull]);
    const moved = Float32Array.from(skull);
    applyFaceAxes(moved, { nose: 1 }, frame);
    // Pick the ten vertices the nose actually reaches: those are the ones a
    // separate mesh sitting in the same place would have to follow.
    const picks: number[] = [];
    for (let i = 0; i < skull.length / 3; i++) {
      const d = Math.hypot(
        moved[i * 3] - skull[i * 3],
        moved[i * 3 + 1] - skull[i * 3 + 1],
        moved[i * 3 + 2] - skull[i * 3 + 2],
      );
      if (d > 1e-4) picks.push(i);
      if (picks.length === 10) break;
    }
    expect(picks.length).toBeGreaterThan(3);
    const patch = new Float32Array(picks.length * 3);
    for (let i = 0; i < picks.length; i++) {
      patch[i * 3] = skull[picks[i] * 3];
      patch[i * 3 + 1] = skull[picks[i] * 3 + 1];
      patch[i * 3 + 2] = skull[picks[i] * 3 + 2];
    }
    const shared = Float32Array.from(patch);
    const perMesh = Float32Array.from(patch);
    applyFaceAxes(shared, { nose: 1 }, frame);
    applyFaceAxes(perMesh, { nose: 1 });
    for (let i = 0; i < picks.length; i++) {
      for (let a = 0; a < 3; a++) {
        expect(shared[i * 3 + a] - patch[i * 3 + a]).toBeCloseTo(
          moved[picks[i] * 3 + a] - skull[picks[i] * 3 + a],
          6,
        );
      }
    }
    expect(Array.from(perMesh)).not.toEqual(Array.from(shared));
  });

  it('samples one field, so every mesh of a head asks the same question', () => {
    const frame = faceFrameOf([headPoints()]);
    const out: [number, number, number] = [0, 0, 0];
    // A point outside every region moves nothing at all, which is what lets a
    // caller skip the write per vertex.
    expect(faceDisplacementAt(0, 0, -0.42, { nose: 1 }, frame, out)).toBe(false);
    expect(out).toEqual([0, 0, 0]);
    // ...and the nose tip moves forward.
    expect(faceDisplacementAt(0, -0.15, 0.4, { nose: 1 }, frame, out)).toBe(true);
    expect(out[2]).toBeGreaterThan(0);
  });

  it('gives every creator slider its own region rather than sharing one', () => {
    // Two sliders folded onto one region fight over the same vertices, which is
    // what read as a deformed face: chin and cheeks each move their own.
    const chin = headPoints();
    const cheeks = headPoints();
    applyFaceAxes(chin, { chin: 1 });
    applyFaceAxes(cheeks, { cheeks: 1 });
    let differs = 0;
    for (let i = 0; i < chin.length; i++) if (Math.abs(chin[i] - cheeks[i]) > 1e-4) differs++;
    expect(differs).toBeGreaterThan(0);
  });

  it('holds the bottom edge still, because that edge is the seam against the neck', () => {
    // The head is a rigid attachment and the neck under it is skinned body
    // geometry no face slider reaches: a chin pushed at full slider must not
    // open that seam. The lowest ring of the head therefore never moves.
    const points = headPoints();
    const before = Float32Array.from(points);
    applyFaceAxes(points, { chin: 1, jaw: 1, smirk: 1 });
    let seamMoved = 0;
    let above = 0;
    for (let i = 0; i < points.length / 3; i++) {
      const ny = before[i * 3 + 1] / 0.5; // fixture half-height is 0.5
      const d = Math.hypot(
        points[i * 3] - before[i * 3],
        points[i * 3 + 1] - before[i * 3 + 1],
        points[i * 3 + 2] - before[i * 3 + 2],
      );
      if (ny <= -0.995 && d > 1e-6) seamMoved++;
      if (ny > -0.8 && d > 1e-4) above++;
    }
    expect(seamMoved).toBe(0);
    expect(above).toBeGreaterThan(0);
  });

  it('moves nothing further than its range allows, so no slider can tear a face', () => {
    const points = headPoints();
    const before = Float32Array.from(points);
    for (const axis of FACE_AXES) applyFaceAxes(points, { [axis]: 1 });
    let worst = 0;
    for (let i = 0; i < points.length; i++) {
      worst = Math.max(worst, Math.abs(points[i] - before[i]));
    }
    // Head half-height is 0.5 here, and the ranges are fractions of it.
    expect(worst).toBeLessThan(0.5 * 0.2);
  });
});
