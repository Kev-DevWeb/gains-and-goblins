// Shared 16-bit palette and helpers to draw the pixel maps in sprites.js.

export const PALETTE = {
  k: '#1a1424',
  K: '#3b2f52',
  w: '#f7f3e8',
  s: '#f3c39b',
  S: '#c98a64',
  h: '#7a4a2a',
  H: '#4b2c1a',
  g: '#4fae5a',
  G: '#2d7a45',
  l: '#9edb7a',
  y: '#f2c94c',
  Y: '#b8862b',
  b: '#4366a8',
  B: '#2a4170',
  r: '#d94a4a',
  R: '#8f2a2a',
  o: '#ec8c3a',
  O: '#a85a22',
  p: '#8f5fd0',
  P: '#5a3690',
  n: '#8a5a36',
  N: '#583820',
  e: '#a7b0c2',
  E: '#636c80',
  c: '#6fd3e6',
  C: '#2f8fa6',
  m: '#f29ac0',
  M: '#c0567f',
  z: '#ece4cc',
  Z: '#b3a888',
  t: '#6aa84f',
  T: '#3f6e2c',
  u: '#bfe58a',
  f: '#cfa36b',
  F: '#9c7445',
  d: '#6b6f86',
  D: '#454a60',
  v: '#3a3550',
  V: '#26223a',
  i: '#e9e6f5',
  x: '#ffef9a',
};

/**
 * Draws a pixel map onto a canvas context at (ox, oy).
 * colorSwap optionally replaces palette letters (e.g. { g: 'r' }) for recolored variants.
 */
export function drawPixelMap(ctx, rows, ox = 0, oy = 0, colorSwap = null) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const letter = colorSwap?.[row[x]] ?? row[x];
      if (letter === '.') continue;
      ctx.fillStyle = PALETTE[letter];
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  });
}

export function mirror(rows) {
  return rows.map(row => [...row].reverse().join(''));
}

/** Walking frame: lifts one foot by shifting that half of the legs up 1 px. */
export function liftFoot(rows, side, legsTop = 20) {
  const width = rows[0].length;
  const half = width / 2;
  const inHalf = side === 'left' ? (x) => x < half : (x) => x >= half;
  return rows.map((row, y) => {
    if (y < legsTop) return row;
    const below = rows[y + 1];
    return [...row].map((pixel, x) => (inHalf(x) ? (below ? below[x] : '.') : pixel)).join('');
  });
}

/** Breathing frame: everything above the feet drops 1 px. */
export function breathe(rows) {
  const blank = '.'.repeat(rows[0].length);
  return [blank, ...rows.slice(0, -2), rows[rows.length - 1]];
}
