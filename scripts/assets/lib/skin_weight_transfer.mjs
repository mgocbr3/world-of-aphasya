// Give an unrigged garment the body's own skinning, by nearest-point transfer.
//
// The problem this solves: a generated armour piece bolted to one bone is rigid,
// so the moment the character raises an arm the pauldron passes straight through
// it. Real armour has to deform with the rig like the body does.
//
// The approach is deliberately NOT distance-to-bone weighting (the usual
// automatic rig): that guesses, and it guesses worst exactly at the shoulder and
// the hip, where a garment reads as broken. Instead every armour vertex copies
// the joints and weights of the CLOSEST vertex of the character underneath it.
// Those weights were authored by the artist who rigged the body, so the plate
// bends where the shoulder bends because it is following the same instructions
// the shoulder does. It is the standard cloth-fitting trick and it holds up
// wherever the garment actually hugs the body, which is what a fitted piece is.
//
// Two hard requirements, both easy to get wrong:
//   1. Everything must be in BIND space, not rest space. A skinned glTF stores
//      POSITION in bind space already; a prop authored around the origin does
//      not, so the caller bakes the attach transform (the bone's bind-pose world
//      matrix, which is inverse(inverseBindMatrix)) into it first.
//   2. The nearest search runs over a uniform grid, not a double loop: a plate
//      is thousands of vertices and a body tens of thousands, and the naive form
//      is hundreds of millions of distance tests per build.

/** Invert a 4x4 (column-major, glTF order). Returns null for a singular matrix. */
export function invertMat4(m) {
  const inv = new Float64Array(16);
  inv[0] =
    m[5] * m[10] * m[15] -
    m[5] * m[11] * m[14] -
    m[9] * m[6] * m[15] +
    m[9] * m[7] * m[14] +
    m[13] * m[6] * m[11] -
    m[13] * m[7] * m[10];
  inv[4] =
    -m[4] * m[10] * m[15] +
    m[4] * m[11] * m[14] +
    m[8] * m[6] * m[15] -
    m[8] * m[7] * m[14] -
    m[12] * m[6] * m[11] +
    m[12] * m[7] * m[10];
  inv[8] =
    m[4] * m[9] * m[15] -
    m[4] * m[11] * m[13] -
    m[8] * m[5] * m[15] +
    m[8] * m[7] * m[13] +
    m[12] * m[5] * m[11] -
    m[12] * m[7] * m[9];
  inv[12] =
    -m[4] * m[9] * m[14] +
    m[4] * m[10] * m[13] +
    m[8] * m[5] * m[14] -
    m[8] * m[6] * m[13] -
    m[12] * m[5] * m[10] +
    m[12] * m[6] * m[9];
  inv[1] =
    -m[1] * m[10] * m[15] +
    m[1] * m[11] * m[14] +
    m[9] * m[2] * m[15] -
    m[9] * m[3] * m[14] -
    m[13] * m[2] * m[11] +
    m[13] * m[3] * m[10];
  inv[5] =
    m[0] * m[10] * m[15] -
    m[0] * m[11] * m[14] -
    m[8] * m[2] * m[15] +
    m[8] * m[3] * m[14] +
    m[12] * m[2] * m[11] -
    m[12] * m[3] * m[10];
  inv[9] =
    -m[0] * m[9] * m[15] +
    m[0] * m[11] * m[13] +
    m[8] * m[1] * m[15] -
    m[8] * m[3] * m[13] -
    m[12] * m[1] * m[11] +
    m[12] * m[3] * m[9];
  inv[13] =
    m[0] * m[9] * m[14] -
    m[0] * m[10] * m[13] -
    m[8] * m[1] * m[14] +
    m[8] * m[2] * m[13] +
    m[12] * m[1] * m[10] -
    m[12] * m[2] * m[9];
  inv[2] =
    m[1] * m[6] * m[15] -
    m[1] * m[7] * m[14] -
    m[5] * m[2] * m[15] +
    m[5] * m[3] * m[14] +
    m[13] * m[2] * m[7] -
    m[13] * m[3] * m[6];
  inv[6] =
    -m[0] * m[6] * m[15] +
    m[0] * m[7] * m[14] +
    m[4] * m[2] * m[15] -
    m[4] * m[3] * m[14] -
    m[12] * m[2] * m[7] +
    m[12] * m[3] * m[6];
  inv[10] =
    m[0] * m[5] * m[15] -
    m[0] * m[7] * m[13] -
    m[4] * m[1] * m[15] +
    m[4] * m[3] * m[13] +
    m[12] * m[1] * m[7] -
    m[12] * m[3] * m[5];
  inv[14] =
    -m[0] * m[5] * m[14] +
    m[0] * m[6] * m[13] +
    m[4] * m[1] * m[14] -
    m[4] * m[2] * m[13] -
    m[12] * m[1] * m[6] +
    m[12] * m[2] * m[5];
  inv[3] =
    -m[1] * m[6] * m[11] +
    m[1] * m[7] * m[10] +
    m[5] * m[2] * m[11] -
    m[5] * m[3] * m[10] -
    m[9] * m[2] * m[7] +
    m[9] * m[3] * m[6];
  inv[7] =
    m[0] * m[6] * m[11] -
    m[0] * m[7] * m[10] -
    m[4] * m[2] * m[11] +
    m[4] * m[3] * m[10] +
    m[8] * m[2] * m[7] -
    m[8] * m[3] * m[6];
  inv[11] =
    -m[0] * m[5] * m[11] +
    m[0] * m[7] * m[9] +
    m[4] * m[1] * m[11] -
    m[4] * m[3] * m[9] -
    m[8] * m[1] * m[7] +
    m[8] * m[3] * m[5];
  inv[15] =
    m[0] * m[5] * m[10] -
    m[0] * m[6] * m[9] -
    m[4] * m[1] * m[10] +
    m[4] * m[2] * m[9] +
    m[8] * m[1] * m[6] -
    m[8] * m[2] * m[5];
  const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  if (det === 0) return null;
  const d = 1 / det;
  for (let i = 0; i < 16; i++) inv[i] *= d;
  return inv;
}

/** Transform a point by a column-major 4x4, writing into `out`. */
export function transformPoint(m, p, out) {
  const [x, y, z] = p;
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return out;
}

/** Rotate a direction by a column-major 4x4 (no translation), writing to `out`. */
export function transformDirection(m, v, out) {
  const [x, y, z] = v;
  out[0] = m[0] * x + m[4] * y + m[8] * z;
  out[1] = m[1] * x + m[5] * y + m[9] * z;
  out[2] = m[2] * x + m[6] * y + m[10] * z;
  const len = Math.hypot(out[0], out[1], out[2]) || 1;
  out[0] /= len;
  out[1] /= len;
  out[2] /= len;
  return out;
}

/**
 * A uniform-grid nearest-point index over the donor's vertices. Cell size is
 * derived from the point count so occupancy stays near constant whatever the
 * body's density is, and the query widens ring by ring until it can prove no
 * closer point exists outside the rings already searched.
 */
export function buildNearestIndex(points) {
  const count = points.length / 3;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let a = 0; a < 3; a++) {
      const v = points[i * 3 + a];
      if (v < lo[a]) lo[a] = v;
      if (v > hi[a]) hi[a] = v;
    }
  }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
  const cells = Math.max(1, Math.round(Math.cbrt(count / 4)));
  const size = span / cells;
  const key = (ix, iy, iz) => `${ix},${iy},${iz}`;
  const cellOf = (x, y, z) => [
    Math.floor((x - lo[0]) / size),
    Math.floor((y - lo[1]) / size),
    Math.floor((z - lo[2]) / size),
  ];
  const grid = new Map();
  for (let i = 0; i < count; i++) {
    const [ix, iy, iz] = cellOf(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
    const k = key(ix, iy, iz);
    const bucket = grid.get(k);
    if (bucket) bucket.push(i);
    else grid.set(k, [i]);
  }

  return function nearest(x, y, z) {
    const [cx, cy, cz] = cellOf(x, y, z);
    let best = -1;
    let bestSq = Infinity;
    for (let ring = 0; ring < cells + 2; ring++) {
      // Once a hit is closer than the ring's inner edge, no later ring can beat
      // it: rings only get further away.
      if (best >= 0 && Math.sqrt(bestSq) <= (ring - 1) * size) break;
      for (let ix = cx - ring; ix <= cx + ring; ix++) {
        for (let iy = cy - ring; iy <= cy + ring; iy++) {
          for (let iz = cz - ring; iz <= cz + ring; iz++) {
            const onShell =
              Math.abs(ix - cx) === ring ||
              Math.abs(iy - cy) === ring ||
              Math.abs(iz - cz) === ring;
            if (ring > 0 && !onShell) continue;
            const bucket = grid.get(key(ix, iy, iz));
            if (!bucket) continue;
            for (const i of bucket) {
              const dx = points[i * 3] - x;
              const dy = points[i * 3 + 1] - y;
              const dz = points[i * 3 + 2] - z;
              const sq = dx * dx + dy * dy + dz * dz;
              if (sq < bestSq) {
                bestSq = sq;
                best = i;
              }
            }
          }
        }
      }
    }
    return best;
  };
}
