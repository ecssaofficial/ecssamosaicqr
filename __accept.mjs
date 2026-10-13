/* Acceptance test for the QR id -> piece id -> board slot -> image slice chain. */
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:4599";
const OUT = "C:\\VS_Code\\mosaicqrcode\\shots";
const VP = { width: 1440, height: 900, deviceScaleFactor: 1 };

const seed = (ids) =>
  JSON.stringify(
    ids.map((id) => ({ id, earned: true, earned_at: new Date().toISOString() })),
  );

async function newPage(browser, stored) {
  const page = await browser.newPage();
  await page.setViewport(VP);
  await page.evaluateOnNewDocument((rows) => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if (rows) localStorage.setItem("orbit_pieces_local", rows);
    } catch {
      /* ignore */
    }
  }, stored);
  page.on("pageerror", (e) => console.log("  PAGEERROR:", e.message));
  return page;
}

/** Read every rendered piece: which slot it claims to be + its source rect. */
function inspect() {
  return [...document.querySelectorAll(".piece-art svg")].map((svg) => {
    const clip = svg.querySelector("clipPath")?.getAttribute("id") ?? "";
    const index = Number(clip.match(/^orbit-clip-(\d+)-/)?.[1]);
    const [vx, vy, vw, vh] = (svg.getAttribute("viewBox") ?? "")
      .split(" ")
      .map(Number);
    const row = Math.round(vy + 0.32);
    const col = Math.round(vx + 0.32);
    const img = svg.querySelector("image");
    return {
      index,
      row,
      col,
      imgXY: `${img?.getAttribute("x")},${img?.getAttribute("y")}`,
      vb: `${vx} ${vy} ${vw} ${vh}`,
    };
  });
}

function expectPiece(p, index, label) {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const ok =
    p.index === index && p.row === row && p.col === col && p.imgXY === "0,0";
  console.log(
    `    ${ok ? "OK  " : "FAIL"} ${label}: index=${p.index} slot=(r${p.row},c${p.col}) ` +
      `expected index=${index} slot=(r${row},c${col}) image@${p.imgXY}`,
  );
  return ok;
}

let failures = 0;
const check = (cond, label) => {
  if (!cond) failures += 1;
  console.log(`  ${cond ? "OK  " : "FAIL"} ${label}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

try {
  /* 0. earn flow: scanning QR 7 must write id 7, never a sequence number */
  console.log("\n[0] earn flow — /qr/7 awards id 7");
  {
    const page = await newPage(browser, null);
    await page.goto(`${BASE}/qr/7/`, { waitUntil: "networkidle0" });
    await page.waitForFunction(
      () => document.body.innerText.includes("PIECE TRANSMITTED"),
      { timeout: 8000 },
    );
    const rows = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("orbit_pieces_local") ?? "[]"),
    );
    const e7 = rows.find((r) => r.id === 7);
    check(
      Boolean(e7?.earned) && rows.filter((r) => r.earned).length === 1,
      `earned ids = [${rows.filter((r) => r.earned).map((r) => r.id)}] (want [7])`,
    );
    await page.close();
  }

  /* 1. scan ONLY QR 7 -> one tray piece = bottom-left slice (r2,c0) */
  console.log("\n[1] tray with only QR 7 earned");
  {
    const page = await newPage(browser, seed([7]));
    await page.goto(`${BASE}/stage/`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.body.innerText.includes("1 HELD"));
    await new Promise((r) => setTimeout(r, 400));
    const tray = await page.evaluate(
      () =>
        [...document.querySelectorAll(".piece-art svg")].map((svg) => {
          const clip = svg.querySelector("clipPath")?.getAttribute("id") ?? "";
          const index = Number(clip.match(/^orbit-clip-(\d+)-/)?.[1]);
          const [vx, vy] = svg.getAttribute("viewBox").split(" ").map(Number);
          return {
            index,
            row: Math.round(vy + 0.32),
            col: Math.round(vx + 0.32),
            imgXY: `${svg.querySelector("image").getAttribute("x")},${svg
              .querySelector("image")
              .getAttribute("y")}`,
            uid: clip,
          };
        }),
    );
    check(tray.length === 1, `tray shows ${tray.length} piece (want 1)`);
    if (tray[0]) check(expectPiece(tray[0], 6, "QR 7 -> slot 6 (bottom-left)"), "identity");
    await page.screenshot({ path: `${OUT}\\accept-1-qr7-tray.png` });
    await page.close();
  }

  /* 2. add QR 3 -> second piece is top-right slice; images follow ids */
  console.log("\n[2] tray with QR 7 + QR 3 earned");
  {
    const page = await newPage(browser, seed([7, 3]));
    await page.goto(`${BASE}/stage/`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.body.innerText.includes("2 HELD"));
    await new Promise((r) => setTimeout(r, 400));
    const tray = await page.evaluate(inspect);
    check(tray.length === 2, `tray shows ${tray.length} pieces (want 2)`);
    // tray is id-ascending: piece 3 (index 2) then piece 7 (index 6)
    if (tray[0]) check(expectPiece(tray[0], 2, "QR 3 -> slot 2 (top-right)"), "identity");
    if (tray[1]) check(expectPiece(tray[1], 6, "QR 7 -> slot 6 (bottom-left)"), "identity");
    await page.screenshot({ path: `${OUT}\\accept-2-tray.png` });
    await page.close();
  }

  /* 3. drag piece 7 -> slot 7 and piece 3 -> slot 3 */
  console.log("\n[3] drag 7 and 3 into their own slots");
  {
    const page = await newPage(browser, seed([7, 3]));
    await page.goto(`${BASE}/stage/`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.body.innerText.includes("2 HELD"));
    await new Promise((r) => setTimeout(r, 500));

    for (const index of [6, 2]) {
      const pts = await page.evaluate((idx) => {
        const trayItem = [...document.querySelectorAll('[class*="cursor-grab"]')]
          .find((el) => new RegExp(`orbit-clip-${idx}-tray`).test(el.innerHTML));
        if (!trayItem) return null;
        const r = trayItem.getBoundingClientRect();
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const slot = [...document.querySelectorAll("div")].find((d) => {
          if (!d.classList.contains("border-dashed") || !d.style.left)
            return false;
          const w = parseFloat(d.style.width);
          if (!w) return false;
          // slots are positioned in px: left = col * cell, top = row * cell
          return (
            Math.round(parseFloat(d.style.left) / w) === col &&
            Math.round(parseFloat(d.style.top) / w) === row
          );
        });
        if (!slot) return null;
        const sr = slot.getBoundingClientRect();
        return {
          from: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
          to: { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 },
        };
      }, index);
      check(Boolean(pts), `found geometry for piece ${index + 1}`);
      if (!pts) continue;
      await page.mouse.move(pts.from.x, pts.from.y);
      await page.mouse.down();
      for (let s = 1; s <= 6; s += 1) {
        await page.mouse.move(
          pts.from.x + ((pts.to.x - pts.from.x) * s) / 6,
          pts.from.y + ((pts.to.y - pts.from.y) * s) / 6,
        );
      }
      await page.mouse.up();
      await new Promise((r) => setTimeout(r, 350));
    }

    await page.waitForFunction(() => document.body.innerText.includes("2/09"), {
      timeout: 5000,
    });
    // board now holds 2 placed pieces; their viewBox must match their slot
    const placed = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".piece-art svg")].filter(
        (svg) =>
          svg.closest('[class*="pointer-events-none"]') !== null,
      );
      return cells.map((svg) => {
        const clip = svg.querySelector("clipPath").getAttribute("id");
        const index = Number(clip.match(/^orbit-clip-(\d+)-/)[1]);
        const [vx, vy] = svg.getAttribute("viewBox").split(" ").map(Number);
        return {
          index,
          row: Math.round(vy + 0.32),
          col: Math.round(vx + 0.32),
          imgXY: `${svg.querySelector("image").getAttribute("x")},${svg
            .querySelector("image")
            .getAttribute("y")}`,
        };
      });
    });
    check(placed.length === 2, `${placed.length} pieces placed (want 2)`);
    for (const p of placed)
      check(expectPiece(p, p.index, `placed piece ${p.index + 1}`), "identity");
    await page.screenshot({ path: `${OUT}\\accept-3-placed.png` });
    await page.close();
  }

  /* 4. fill all nine -> completed board */
  console.log("\n[4] all nine placed -> completed board");
  {
    const page = await newPage(browser, seed([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    await page.goto(`${BASE}/stage/`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.body.innerText.includes("9 HELD"));
    await new Promise((r) => setTimeout(r, 500));

    for (let n = 0; n < 9; n += 1) {
      const pts = await page.evaluate(() => {
        const grab = [...document.querySelectorAll('[class*="cursor-grab"]')];
        const item = grab.find((el) => /orbit-clip-\d+-tray/.test(el.innerHTML));
        if (!item) return null;
        const index = Number(
          item.innerHTML.match(/orbit-clip-(\d+)-tray/)[1],
        );
        const r = item.getBoundingClientRect();
        const col = index % 3;
        const row = Math.floor(index / 3);
        const slot = [...document.querySelectorAll("div")].find((d) => {
          if (!d.classList.contains("border-dashed") || !d.style.left)
            return false;
          const w = parseFloat(d.style.width);
          if (!w) return false;
          // slots are positioned in px: left = col * cell, top = row * cell
          return (
            Math.round(parseFloat(d.style.left) / w) === col &&
            Math.round(parseFloat(d.style.top) / w) === row
          );
        });
        if (!slot) return null;
        const sr = slot.getBoundingClientRect();
        return {
          index,
          from: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
          to: { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 },
        };
      });
      if (!pts) throw new Error(`no geometry for drop ${n + 1}`);
      await page.mouse.move(pts.from.x, pts.from.y);
      await page.mouse.down();
      for (let s = 1; s <= 6; s += 1) {
        await page.mouse.move(
          pts.from.x + ((pts.to.x - pts.from.x) * s) / 6,
          pts.from.y + ((pts.to.y - pts.from.y) * s) / 6,
        );
      }
      await page.mouse.up();
      await new Promise((r) => setTimeout(r, 300));
    }

    await page.waitForFunction(() => document.body.innerText.includes("9/09"), {
      timeout: 6000,
    });
    await new Promise((r) => setTimeout(r, 400));

    const board = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".piece-art svg")].filter(
        (svg) => svg.closest('[class*="pointer-events-none"]') !== null,
      );
      return cells.map((svg) => {
        const index = Number(
          svg
            .querySelector("clipPath")
            .getAttribute("id")
            .match(/^orbit-clip-(\d+)-/)[1],
        );
        const [vx, vy] = svg.getAttribute("viewBox").split(" ").map(Number);
        return {
          index,
          row: Math.round(vy + 0.32),
          col: Math.round(vx + 0.32),
          imgXY: `${svg.querySelector("image").getAttribute("x")},${svg
            .querySelector("image")
            .getAttribute("y")}`,
        };
      });
    });
    check(board.length === 9, `board holds ${board.length} pieces (want 9)`);
    let allOk = true;
    for (const p of board) {
      const wantRow = Math.floor(p.index / 3);
      const wantCol = p.index % 3;
      const ok =
        p.row === wantRow && p.col === wantCol && p.imgXY === "0,0";
      if (!ok) {
        allOk = false;
        console.log(
          `    FAIL piece ${p.index + 1}: slot=(r${p.row},c${p.col}) want=(r${wantRow},c${wantCol})`,
        );
      }
    }
    check(allOk, "every board slot renders its own source slice");
    await page.screenshot({ path: `${OUT}\\accept-4-complete.png` });
    await page.close();
  }

  /* 5. different scan order (9, 1, 5) -> same identity mapping */
  console.log("\n[5] different earn order — QR 9, 1, 5");
  {
    const page = await newPage(browser, seed([9, 1, 5]));
    await page.goto(`${BASE}/stage/`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.body.innerText.includes("3 HELD"));
    await new Promise((r) => setTimeout(r, 400));
    const tray = await page.evaluate(inspect);
    check(tray.length === 3, `tray shows ${tray.length} pieces (want 3)`);
    const want = [0, 4, 8]; // ids 1,5,9 in id order
    tray.forEach((p, i) => {
      if (want[i] !== undefined)
        check(
          expectPiece(p, want[i], `QR ${i + 1}th -> slot ${want[i]}`),
          "identity",
        );
    });
    await page.screenshot({ path: `${OUT}\\accept-5-order.png` });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(
  failures === 0
    ? "\nALL ACCEPTANCE CHECKS PASSED"
    : `\n${failures} CHECK(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
