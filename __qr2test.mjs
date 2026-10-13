/* QR 02 grab-puzzle verification: screenshots + scripted drag-to-solve. */
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:4599";
const OUT = "C:\\VS_Code\\mosaicqrcode\\shots";

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 1 },
};

async function slotCenter(page, index) {
  return page.evaluate((idx) => {
    const pctStep = 100 / 3;
    const slots = [...document.querySelectorAll("div")].filter(
      (d) =>
        d.classList.contains("border-dashed") &&
        d.style.left &&
        d.style.top &&
        d.style.width &&
        d.style.height,
    );
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    for (const s of slots) {
      const l = parseFloat(s.style.left);
      const t = parseFloat(s.style.top);
      if (
        Math.abs(l - col * pctStep) < 1 &&
        Math.abs(t - row * pctStep) < 1
      ) {
        const r = s.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    return null;
  }, index);
}

async function pieceCenter(page, index) {
  return page.evaluate((idx) => {
    const el = document.querySelector(`[aria-label="piece ${idx + 1}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, index);
}

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let s = 1; s <= 6; s += 1) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * s) / 6,
      from.y + ((to.y - from.y) * s) / 6,
    );
  }
  await page.mouse.up();
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

try {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    console.log(`\n== ${vpName} ==`);
    const page = await browser.newPage();
    await page.setViewport(vp);
    // fresh game state per viewport — the desktop solve earns piece 2
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
    });
    page.on("pageerror", (e) => console.log("  PAGEERROR:", e.message));

    await page.goto(`${BASE}/qr/2/`, { waitUntil: "networkidle0" });
    await page.waitForSelector('[aria-label="piece 1"]');
    await page.waitForFunction(() =>
      document.body.innerText.includes("GRAB PUZZLE"),
    );
    await new Promise((r) => setTimeout(r, 300));

    const of = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
    }));
    await page.screenshot({ path: `${OUT}\\qr2-${vpName}-initial.png` });
    console.log(
      `  initial shot  scrollW=${of.scrollW} innerW=${of.innerW}${of.scrollW > of.innerW + 1 ? " ** OVERFLOW **" : ""}`,
    );

    // wrong drop first: piece 1 onto slot 2 → red outline flash, piece stays
    const p1 = await pieceCenter(page, 0);
    const s2 = await slotCenter(page, 1);
    await drag(page, p1, s2);
    await new Promise((r) => setTimeout(r, 90));
    await page.screenshot({ path: `${OUT}\\qr2-${vpName}-wrongdrop.png` });
    const stillHome = await page.evaluate(
      () => document.querySelector('[aria-label="piece 1"]') !== null,
    );
    console.log(`  wrong drop: piece returned to scatter = ${stillHome}`);
    await new Promise((r) => setTimeout(r, 300));

    // now solve all nine correctly
    for (let i = 0; i < 9; i += 1) {
      const from = await pieceCenter(page, i);
      const to = await slotCenter(page, i);
      if (!from || !to) throw new Error(`missing geometry for piece ${i}`);
      await drag(page, from, to);
      await new Promise((r) => setTimeout(r, 260));
      const set = await page.evaluate(() => {
        const m = document.body.innerText.match(/PIECES SET (\d+) \/ 09/);
        return m ? m[1] : "?";
      });
      console.log(`  drop piece ${i} → slot ${i}: PIECES SET ${set}/09`);
    }

    await page.waitForFunction(
      () => document.body.innerText.includes("PIECE TRANSMITTED"),
      { timeout: 6000 },
    ).catch(async (e) => {
      await page.screenshot({ path: `${OUT}\\qr2-${vpName}-FAILED.png` });
      const state = await page.evaluate(() => document.body.innerText);
      console.log("  FAILED state:\n" + state);
      throw e;
    });
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: `${OUT}\\qr2-${vpName}-solved.png` });
    console.log("  solved → success screen");
    await page.close();
  }

  // admin caption check
  const page = await browser.newPage();
  await page.setViewport(VIEWPORTS.desktop);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.body.innerText.includes("QR 02 //"));
  const caption = await page.evaluate(() => {
    const m = document.body.innerText.match(/QR 02 \/\/ [A-Z]+/);
    return m ? m[0] : null;
  });
  console.log(`\nadmin caption: ${caption}`);
  await page.close();
} finally {
  await browser.close();
}
console.log("done");
