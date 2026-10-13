/* Probe: is slotRefs populated when startDrag runs? */
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
  await page.goto(`${BASE}/qr/2/`, { waitUntil: "networkidle0" });
  await page.waitForSelector('[aria-label="piece 1"]');
  await sleep(300);

  // record every getBoundingClientRect() React makes on dashed elements
  await page.evaluate(() => {
    window.__r = [];
    const orig = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      const r = orig.call(this);
      if (this.classList && this.classList.contains("border-dashed")) {
        window.__r.push({
          w: Math.round(r.width * 100) / 100,
          l: Math.round(r.left * 100) / 100,
          t: Math.round(r.top * 100) / 100,
        });
      }
      return r;
    };
    window.__up = [];
    window.addEventListener(
      "pointerup",
      (e) => window.__up.push([e.clientX, e.clientY]),
      true,
    );
  });

  const info = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="piece 1"]');
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  // target = slot 0 center
  const slot0 = await page.evaluate(() => {
    const pct = 100 / 3;
    const el = [...document.querySelectorAll("div")].find(
      (d) =>
        d.classList.contains("border-dashed") &&
        d.style.left &&
        Math.abs(parseFloat(d.style.left) - 0) < 0.01 &&
        Math.abs(parseFloat(d.style.top) - 0) < 0.01,
    );
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
  });

  await page.mouse.move(info.x, info.y);
  await page.mouse.down();
  await sleep(150);

  const ghost = await page.evaluate(() => {
    const g = [...document.querySelectorAll("div")].find(
      (d) => d.className.includes("z-50") && d.className.includes("fixed"),
    );
    if (!g) return null;
    return { w: g.style.width, left: g.style.left, top: g.style.top };
  });

  const rectsAfterDown = await page.evaluate(() => window.__r.splice(0));

  console.log("slot 0 center:", slot0);
  console.log("ghost (drag.size):", ghost, "<- 96px means slotRefs EMPTY");
  console.log("dashed rects queried on pointerdown:", JSON.stringify(rectsAfterDown));

  for (let s = 1; s <= 6; s += 1) {
    await page.mouse.move(
      info.x + ((slot0.x - info.x) * s) / 6,
      info.y + ((slot0.y - info.y) * s) / 6,
    );
  }
  console.log("dashed rects queried during moves:", JSON.stringify(await page.evaluate(() => window.__r.splice(0))));

  await page.mouse.up();
  await sleep(120);
  console.log("pointerup clientX/Y:", JSON.stringify(await page.evaluate(() => window.__up)));
  console.log("dashed rects queried on pointerup:", JSON.stringify(await page.evaluate(() => window.__r.splice(0))));
  console.log("readout:", await page.evaluate(() => document.body.innerText.match(/PIECES SET\s+\d+/)?.[0]));
} finally {
  await browser.close();
}
