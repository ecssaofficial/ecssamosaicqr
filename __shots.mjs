/* Screenshot + spec verification for the monochrome redesign.
   Run: node __shots.mjs  (requires `npx serve out -l 4599` running) */
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:4599";
const OUT = "C:\\VS_Code\\mosaicqrcode\\shots";

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 1 },
};

const results = [];

function seed(ids) {
  return ids.map((id) => ({ id, earned: true, earned_at: new Date().toISOString() }));
}

async function setupPage(browser, vp) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  page.on("pageerror", (e) => console.log("  PAGEERROR:", e.message));
  return page;
}

async function clearStorage(page) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    localStorage.clear();
  });
}

async function setPieces(page, ids) {
  await page.evaluate((rows) => {
    localStorage.setItem("orbit_pieces_local", JSON.stringify(rows));
  }, seed(ids));
}

async function checkOverflow(page) {
  return page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
}

async function snap(page, name, vpName) {
  const of = await checkOverflow(page);
  const path = `${OUT}\\${name}-${vpName}.png`;
  await page.screenshot({ path });
  results.push({ name: `${name}-${vpName}`, ...of });
  console.log(`  saved ${name}-${vpName}.png  scrollW=${of.scrollW} innerW=${of.innerW}${of.overflow ? "  ** OVERFLOW **" : ""}`);
}

const GAME_WORDS = {
  2: "GRAB PUZZLE",
  4: "MEMORY FLIP",
  6: "SEQUENCE TAP",
  8: "MAZE",
};

async function waitForTerminal(page, id) {
  const want = GAME_WORDS[id]
    ? GAME_WORDS[id]
    : ["PIECE TRANSMITTED", "ALREADY ACTIVE"];
  await page.waitForFunction(
    (words) => {
      const t = document.body.innerText;
      return words.some((w) => t.includes(w));
    },
    { timeout: 8000 },
    Array.isArray(want) ? want : [want],
  );
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

try {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    console.log(`\n== ${vpName} ${vp.width}x${vp.height} ==`);

    // ---- admin ----
    {
      const page = await setupPage(browser, vp);
      await clearStorage(page);
      await setPieces(page, [1, 4, 6]);
      await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
      await page.waitForFunction(() => document.body.innerText.includes("PIECES 03/09"));
      await snap(page, "home", vpName);
      await page.close();
    }

    // ---- stage with pieces in tray ----
    {
      const page = await setupPage(browser, vp);
      await clearStorage(page);
      await setPieces(page, [1, 3, 5, 8]);
      await page.goto(`${BASE}/stage/`, { waitUntil: "networkidle0" });
      await page.waitForFunction(() => document.body.innerText.includes("4 HELD"));
      await new Promise((r) => setTimeout(r, 400));
      await snap(page, "stage", vpName);
      await page.close();
    }

    // ---- QR pages ----
    for (let id = 1; id <= 9; id += 1) {
      const page = await setupPage(browser, vp);
      await clearStorage(page);
      if (id === 3) await setPieces(page, [3]); // locked state
      await page.goto(`${BASE}/qr/${id}/`, { waitUntil: "networkidle0" });
      await waitForTerminal(page, id);
      await new Promise((r) => setTimeout(r, 300));
      await snap(page, `qr${id}`, vpName);
      await page.close();
    }
  }

  // ---- win sequence (desktop, all 9 pieces dragged home) ----
  {
    const page = await setupPage(browser, VIEWPORTS.desktop);
    await clearStorage(page);
    await setPieces(page, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    await page.goto(`${BASE}/stage/`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.body.innerText.includes("9 HELD"));
    await new Promise((r) => setTimeout(r, 400));

    for (let n = 0; n < 9; n += 1) {
      const info = await page.evaluate(() => {
        const grab = [...document.querySelectorAll('[class*="cursor-grab"]')];
        const item = grab.find((el) => /orbit-clip-\d+-tray/.test(el.innerHTML));
        if (!item) return null;
        const index = Number(item.innerHTML.match(/orbit-clip-(\d+)-tray/)[1]);
        const r = item.getBoundingClientRect();
        const col = index % 3;
        const row = Math.floor(index / 3);
        const slots = [...document.querySelectorAll("div")].filter(
          (d) => d.classList.contains("border-dashed") && d.style.left && d.style.width,
        );
        for (const s of slots) {
          const w = parseFloat(s.style.width);
          if (
            Math.round(parseFloat(s.style.left) / w) === col &&
            Math.round(parseFloat(s.style.top) / w) === row
          ) {
            const sr = s.getBoundingClientRect();
            return {
              index,
              from: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
              to: { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 },
            };
          }
        }
        return null;
      });
      if (!info) throw new Error(`could not locate tray piece (pass ${n + 1})`);
      const { from, to } = info;
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let s = 1; s <= 6; s += 1) {
        await page.mouse.move(
          from.x + ((to.x - from.x) * s) / 6,
          from.y + ((to.y - from.y) * s) / 6,
        );
      }
      await page.mouse.up();
      await new Promise((r) => setTimeout(r, 260));
    }

    await page.waitForFunction(() => document.body.innerText.includes("STAGE CLEARED"), {
      timeout: 5000,
    });
    await new Promise((r) => setTimeout(r, 500)); // let the invert fade land
    await snap(page, "stage-win", "desktop");
    await page.close();
  }
} finally {
  await browser.close();
}

fs.writeFileSync(`${OUT}\\results.json`, JSON.stringify(results, null, 2));
const bad = results.filter((r) => r.overflow);
console.log(`\n${results.length} shots, ${bad.length} with horizontal overflow${bad.length ? ": " + bad.map((b) => b.name).join(", ") : ""}`);
