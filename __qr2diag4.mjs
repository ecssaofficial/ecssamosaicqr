/* diag2 flow + rect/event instrumentation */
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
    window.__r = [];
    window.__up = [];
    window.__pd = [];
    const orig = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      const r = orig.call(this);
      if (this.classList && this.classList.contains("border-dashed")) {
        window.__r.push(
          `w${Math.round(r.width)},l${Math.round(r.left)},t${Math.round(r.top)}`,
        );
      }
      return r;
    };
    window.addEventListener(
      "pointerup",
      (e) => window.__up.push(`${Math.round(e.clientX)},${Math.round(e.clientY)}`),
      true,
    );
    window.addEventListener(
      "pointerdown",
      (e) => window.__pd.push(e.target.getAttribute?.("aria-label") ?? "?"),
      true,
    );
  });

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

  const show = async (label) => {
    const pd = await page.evaluate(() => window.__pd.splice(0));
    const up = await page.evaluate(() => window.__up.splice(0));
    const rects = await page.evaluate(() => window.__r.splice(0));
    const set = await page.evaluate(
      () => document.body.innerText.match(/PIECES SET\s+\d+/)?.[0],
    );
    const ghost = await page.evaluate(() => {
      const g = [...document.querySelectorAll("div")].find(
        (d) => d.className.includes("z-50") && d.className.includes("fixed"),
      );
      return g ? g.style.width : "none";
    });
    console.log(
      `${label}\n   pdown=${JSON.stringify(pd)} pup=${JSON.stringify(up)} ghost=${ghost} ${set}\n   slotAt rects=${JSON.stringify(rects)}`,
    );
  };

  // wrong drop first (exactly like __qr2test.mjs)
  await drag(await pieceCenter(0), await slotCenter(1));
  await sleep(90);
  await show("wrong drop piece0->slot1");
  await sleep(300);

  for (let i = 0; i < 3; i += 1) {
    const from = await pieceCenter(i);
    const to = await slotCenter(i);
    await drag(from, to);
    await show(`correct drop piece${i}->slot${i}  (target ${Math.round(to.x)},${Math.round(to.y)})`);
    await sleep(260);
  }
} finally {
  await browser.close();
}
