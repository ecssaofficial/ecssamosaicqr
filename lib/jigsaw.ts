import { PUZZLE_IMAGE, siteUrl } from "./config";

/* ------------------------------------------------------------------ *
 * Jigsaw geometry.
 *
 * The board is a 3x3 grid in "cell units": cell (row, col) covers
 * [col, col + 1] x [row, row + 1]. Every piece outline is generated in
 * those absolute cell units, so a piece path never depends on the size
 * it is rendered at — the SVG viewBox does the scaling. That means the
 * tray thumbnail and the board slot are guaranteed to show the exact
 * same shape.
 * ------------------------------------------------------------------ */

export const GRID = 3;
export const PIECE_COUNT = GRID * GRID;

/** How far a knob sticks out of its own cell, in cell units. */
export const PIECE_TAB = 0.295;
/** Padding around the cell so knobs are not clipped, in cell units. */
export const PIECE_PAD = 0.32;
/** Full drawing box of a piece, in cell units. */
export const PIECE_BOX = 1 + PIECE_PAD * 2;

/* knob bulb geometry (cell units) */
const NECK_HALF = 0.1; // half width of the neck
const BULB_R = 0.135; // radius of the bulb
const BULB_CY = 0.16; // bulb centre distance from the edge line

export type Point = readonly [number, number];

/** Tiny deterministic PRNG — same output on server and client. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function coin(seed: number): number {
  // 1 or -1, stable for a given seed
  return mulberry32(seed * 2654435761 + 40503)() > 0.5 ? 1 : -1;
}

/** Vertical edge between (r,c) and (r,c+1). +1 bulges to the right (+x). */
function verticalEdge(r: number, c: number): number {
  return coin(r * 131 + c * 17 + 5);
}

/** Horizontal edge between (r,c) and (r+1,c). +1 bulges downwards (+y). */
function horizontalEdge(r: number, c: number): number {
  return coin(r * 53 + c * 97 + 991);
}

export function pieceRowCol(index: number): { row: number; col: number } {
  return { row: Math.floor(index / GRID), col: index % GRID };
}

function fmt(n: number): string {
  const v = Math.round(n * 100000) / 100000;
  return String(v);
}

/**
 * One edge of an outline, from p to q, with an optional knob.
 * knob: +1 = bulge outward (away from the piece), -1 = hole, 0 = flat.
 *
 * The outline is walked clockwise in screen coordinates (y down), which
 * makes the outward normal of every edge (dy, -dx).
 */
function edgePoints(p: Point, q: Point, knob: number): Point[] {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  if (knob === 0) return [[q[0], q[1]]];

  const nx = dy; // outward normal (unit, because cells are unit squares)
  const ny = -dx;

  const h = Math.sqrt(BULB_R * BULB_R - NECK_HALF * NECK_HALF);

  // Bulb sits on the far side of the edge; the neck is narrower than the
  // bulb, which gives the classic undercut. The arc runs from the left
  // attach point, around the far side, to the right attach point.
  const thetaStart = Math.atan2(-h, -NECK_HALF);
  const thetaEnd = Math.atan2(-h, NECK_HALF) - 2 * Math.PI;
  const steps = 22;

  /** t: distance along p->q (0..1), v: distance along the outward normal. */
  const at = (t: number, v: number): Point => [
    p[0] + dx * t + nx * v * knob,
    p[1] + dy * t + ny * v * knob,
  ];

  const out: Point[] = [
    at(0.5 - NECK_HALF, 0),
    at(0.5 - NECK_HALF, BULB_CY - h),
  ];
  for (let i = 1; i <= steps; i += 1) {
    const th = thetaStart + (thetaEnd - thetaStart) * (i / steps);
    out.push(at(0.5 + BULB_R * Math.cos(th), BULB_CY + BULB_R * Math.sin(th)));
  }
  out.push(at(0.5 + NECK_HALF, BULB_CY - h));
  out.push(at(0.5 + NECK_HALF, 0));
  out.push(at(1, 0));
  return out;
}

/** SVG path `d` for a single piece, in absolute cell units. */
export function getPiecePath(index: number): string {
  const { row, col } = pieceRowCol(index);

  const tl: Point = [col, row];
  const tr: Point = [col + 1, row];
  const br: Point = [col + 1, row + 1];
  const bl: Point = [col, row + 1];

  // outer edges are flat; shared edges bulge out of one piece and into the other
  const topKnob = row === 0 ? 0 : -horizontalEdge(row - 1, col);
  const rightKnob = col === GRID - 1 ? 0 : verticalEdge(row, col);
  const bottomKnob = row === GRID - 1 ? 0 : horizontalEdge(row, col);
  const leftKnob = col === 0 ? 0 : -verticalEdge(row, col - 1);

  const pts: Point[] = [
    [tl[0], tl[1]],
    ...edgePoints(tl, tr, topKnob),
    ...edgePoints(tr, br, rightKnob),
    ...edgePoints(br, bl, bottomKnob),
    ...edgePoints(bl, tl, leftKnob),
  ];

  return `M${pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join("L")}Z`;
}

export function getPieceViewBox(index: number): string {
  const { row, col } = pieceRowCol(index);
  return `${fmt(col - PIECE_PAD)} ${fmt(row - PIECE_PAD)} ${fmt(PIECE_BOX)} ${fmt(PIECE_BOX)}`;
}

/** Rendered pixel size of the full drawing box for a given cell size. */
export function pieceBoxPx(cellPx: number): number {
  return cellPx * PIECE_BOX;
}

/** Offset to subtract from a slot position so the box lines up with the cell. */
export function pieceBoxOffset(cellPx: number): number {
  return cellPx * PIECE_PAD;
}

/**
 * Complete inline SVG markup for one piece. Used by the tray thumbnails,
 * the drag ghost and the board slots, so every rendering of piece n is
 * pixel-identical.
 *
 * `uid` keeps the clipPath ids unique when the same piece is on screen twice.
 */
export function getPieceSVG(index: number, size: number, uid = ""): string {
  const { row, col } = pieceRowCol(index);
  const d = getPiecePath(index);
  const clipId = `orbit-clip-${index}-${uid || "x"}`;
  const box = fmt(pieceBoxPx(size));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="${getPieceViewBox(
      index,
    )}" shape-rendering="geometricPrecision">`,
    `<defs><clipPath id="${clipId}"><path d="${d}"/></clipPath></defs>`,
    `<g clip-path="url(#${clipId})">`,
    `<image href="${siteUrl(PUZZLE_IMAGE)}" x="${fmt(-col)}" y="${fmt(-row)}" width="${GRID}" height="${GRID}" preserveAspectRatio="none"/>`,
    `</g>`,
    // flat hairline outline (currentColor): white/40 at rest, solid white
    // while dragging, red for one beat on a wrong drop — and it covers
    // the clip seams.
    `<path d="${d}" fill="none" stroke="currentColor" stroke-width="0.01"/>`,
    `</svg>`,
  ].join("");
}
