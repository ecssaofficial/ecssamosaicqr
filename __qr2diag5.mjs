/* Log every pointer event on window with target + coords. */
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

  await page.evaluate(() => {
    window.__ev = [];
    for (const t of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "lostpointercapture",
      "gotpointercapture",
      "mousedown",
      "mouseup",
    ]) {
      window.addEventListener(
        t,
        (e) => {
          if (t === "pointermove") return;
          const tgt = e.target;
          window.__ev.push(
            `${t} tgt=${tgt?.getAttribute?.("aria-label") ?? tgt?.tagName}(${Math.round(e.clientX)},${Math.round(e.clientY)})`,
          );
        },
        true,
      );
    }
  });

  const pieceCenter = (i) =>
    page.evaluate((n) => {
      const el = document.querySelector(`[aria-label="piece ${n + 1}"]`);
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

  // wrong drop first (mirrors __qr2test.mjs)
  await drag(await pieceCenter(0), await slotCenter(1));
  await sleep(400);
  console.log("WRONG DROP:", JSON.stringify(await page.evaluate(() => window.__ev.splice(0))));

  for (let i = 0; i < 3; i += 1) {
    await drag(await pieceCenter(i), await slotCenter(i));
    await sleep(400);
    console.log(`DROP ${i}:`, JSON.stringify(await page.evaluate(() => window.__ev.splice(0))));
    console.log("   set =", await page.evaluate(() => document.body.innerText.match(/PIECES SET\s+\d+/)?.[0]));
  }
} finally {
  await browser.close();
}
