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

/** A coarse humanoid head: a sphere of vertices spanning a unit-ish box. */
function headPoints(): Float32Array {
  const pts: number[] = [];
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      const theta = (i / 23) * Math.PI;
      const phi = (j / 23) * Math.PI * 2;
      pts.push(
        0.4 * Math.sin(theta) * Math.cos(phi),
        0.5 * Math.cos(theta),
        0.42 * Math.sin(theta) * Math.sin(phi),
      );
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
