/* Ground-truth check of the QR id -> piece id -> slot -> image slice chain.
   Transpiles the real lib/jigsaw.ts (sucrase) and measures which region of
   the source image each piece index actually samples. */
import fs from "node:fs";
import { transform } from "sucrase";

function loadTs(path, stubs = {}) {
  const { code } = transform(fs.readFileSync(path, "utf8"), {
    transforms: ["typescript", "imports"],
  });
  const mod = { exports: {} };
  const fn = new Function("require", "module", "exports", code);
  fn(
    (id) => {
      if (id in stubs) return stubs[id];
      throw new Error(`unexpected import "${id}" in ${path}`);
    },
    mod,
    mod.exports,
  );
  return mod.exports;
}

const config = loadTs("lib/config.ts");
const jigsaw = loadTs("lib/jigsaw.ts", { "./config": config });

const GRID = jigsaw.GRID;

console.log("index id  row col | sampled x-frac     y-frac     | expected x       y       | visible");
let bad = 0;
for (let index = 0; index < GRID * GRID; index += 1) {
  const { row, col } = jigsaw.pieceRowCol(index);
  const svg = jigsaw.getPieceSVG(index, 100, "t");
  const img = svg.match(
    /<image [^>]*x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/,
  );
  const vb = svg.match(/viewBox="([^"]+)"/);
  if (!img || !vb) throw new Error("could not parse svg for index " + index);
  const [ix, iy, iw, ih] = img.slice(1).map(Number);
  const [vx, vy, vw, vh] = vb[1].split(" ").map(Number);

  // image fraction sampled by this piece's own cell [col,col+1] x [row,row+1]
  const fx0 = (col - ix) / iw;
  const fx1 = (col + 1 - ix) / iw;
  const fy0 = (row - iy) / ih;
  const fy1 = (row + 1 - iy) / ih;

  const ex0 = col / GRID;
  const ey0 = row / GRID;
  const visible =
    col >= vx && col + 1 <= vx + vw && row >= vy && row + 1 <= vy + vh;

  const ok =
    Math.abs(fx0 - ex0) < 1e-6 &&
    Math.abs(fy0 - ey0) < 1e-6 &&
    Math.abs(fx1 - (ex0 + 1 / GRID)) < 1e-6 &&
    Math.abs(fy1 - (ey0 + 1 / GRID)) < 1e-6 &&
    visible;
  if (!ok) bad += 1;

  console.log(
    ` ${index}  ${index + 1}   ${row}   ${col}  | ` +
      `${fx0.toFixed(3)}..${fx1.toFixed(3)}   ${fy0.toFixed(3)}..${fy1.toFixed(3)} | ` +
      `${ex0.toFixed(3)}..${(ex0 + 1 / GRID).toFixed(3)}   ${ey0.toFixed(3)}..${(ey0 + 1 / GRID).toFixed(3)} | ` +
      `${visible ? "yes" : "NO (outside viewBox)"} ${ok ? "OK" : "WRONG"}`,
  );
}
console.log(bad === 0 ? "\nALL 9 SLICES CORRECT" : `\n${bad}/9 SLICES WRONG`);
