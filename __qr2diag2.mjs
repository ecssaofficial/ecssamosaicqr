/* Replicate __qr2test.mjs's exact sequence, instrumented. */
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:4599";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log("  PAGEERROR:", e.message));

  await page.goto(`${BASE}/qr/2/`, { waitUntil: "networkidle0" });
  await page.waitForSelector('[aria-label="piece 1"]');
  await sleep(300);

  const inFlight = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll("div")].filter(
          (d) =>
            d.classList.contains("border-dashed") &&
            d.style.width === "56px",
        ).length,
    );
  const readout = () =>
    page.evaluate(() => {
      const m = document.body.innerText.match(/PIECES SET\s+(\d+)/);
      return m ? m[1] : "??";
    });
  const flash = (i) =>
    page.evaluate((n) => {
      const el = document.querySelector(`[aria-label="piece ${n + 1}"]`);
      return el && el.className.includes("border-danger") ? "RED" : "-";
    }, i);

  const pieceCenter = (i) =>
    page.evaluate((n) => {
      const el = document.querySelector(`[aria-label="piece ${n + 1}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, i);
  const slotCenter = (i) =>
    page.evaluate((n) => {
      const pct = 100 / 3;
      const want = { l: (n % 3) * pct, t: Math.floor(n / 3) * pct };
      const el = [...document.querySelectorAll("div")].find(
        (d) =>
          d.classList.contains("border-dashed") &&
          d.style.left &&
          Math.abs(parseFloat(d.style.left) - want.l) < 0.01 &&
          Math.abs(parseFloat(d.style.top) - want.t) < 0.01,
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, i);

  const drag = async (from, to) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let s = 1; s <= 6; s += 1) {
      await page.mouse.move(
        from.x + ((to.x - from.x) * s) / 6,
        from.y + ((to.y - from.y) * s) / 6,
      );
    }
    await page.mouse.up();
  };

  // exact test: wrong drop first
  await drag(await pieceCenter(0), await slotCenter(1));
  await sleep(90);
  console.log(
    `wrong drop  -> inFlight=${await inFlight()} set=${await readout()} flash=${await flash(0)}`,
  );
  await sleep(300);

  for (let i = 0; i < 9; i += 1) {
    const from = await pieceCenter(i);
    const to = await slotCenter(i);
    if (!from || !to) {
      console.log(`piece ${i}: MISSING geometry from=${from} to=${to}`);
      continue;
    }
    await drag(from, to);
    console.log(
      `drop ${i} -> inFlight=${await inFlight()} set=${await readout()} flash=${await flash(i)}`,
    );
    await sleep(260);
  }
} finally {
  await browser.close();
}
