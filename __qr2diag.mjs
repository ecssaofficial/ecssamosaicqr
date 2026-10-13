/* Diagnose why QR 02 grab-puzzle drops do not register. */
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
  page.on("console", (m) => {
    if (m.type() === "error") console.log("  CONSOLE:", m.text());
  });

  await page.goto(`${BASE}/qr/2/`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.body.innerText.includes("PIECES SET"));
  await sleep(400);

  // Count "in-flight" markers (56px dashed placeholders) => `drag` state is live
  const inFlight = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("div")].filter(
        (d) =>
          d.classList.contains("border-dashed") &&
          d.style.width === "56px" &&
          d.style.height === "56px",
      ).length,
    );

  // Count real board slots (percentage positioned) => slot refs should be set
  const slotCount = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll("div")].filter(
          (d) =>
            d.classList.contains("border-dashed") &&
            d.style.left &&
            d.style.top,
        ).length,
    );

  const readout = () =>
    page.evaluate(() => {
      const m = document.body.innerText.match(/PIECES SET\s+(\d+)\s*\/\s*09/);
      return m ? m[1] : "??";
    });

  const flashState = (idx) =>
    page.evaluate((i) => {
      const el = document.querySelector(`[aria-label="piece ${i + 1}"]`);
      if (!el) return "piece-missing";
      if (el.className.includes("border-danger")) return "RED-FLASH";
      if (el.className.includes("border-white/45")) return "normal";
      return el.className.includes("border") ? "other-border" : "no-border";
    }, idx);

  const rectOf = (idx) =>
    page.evaluate((i) => {
      const el = document.querySelector(`[aria-label="piece ${i + 1}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    }, idx);

  const slotRectOf = (idx) =>
    page.evaluate((i) => {
      const pct = 100 / 3;
      const want = { l: (i % 3) * pct, t: Math.floor(i / 3) * pct };
      const el = [...document.querySelectorAll("div")].find(
        (d) =>
          d.classList.contains("border-dashed") &&
          d.style.left &&
          d.style.top &&
          Math.abs(parseFloat(d.style.left) - want.l) < 0.01 &&
          Math.abs(parseFloat(d.style.top) - want.t) < 0.01,
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, w: r.width, h: r.height,
               cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }, idx);

  console.log("initial: inFlight=%d slots=%d set=%s", await inFlight(), await slotCount(), await readout());

  // instrument window listeners so we know the events arrive at all
  await page.evaluate(() => {
    window.__ev = [];
    for (const t of ["pointerdown", "pointermove", "pointerup"]) {
      window.addEventListener(
        t,
        (e) => {
          if (t !== "pointermove")
            window.__ev.push(`${t}:${e.target?.getAttribute?.("aria-label") ?? e.target?.tagName}`);
        },
        true,
      );
    }
  });

  for (const idx of [0, 1, 4]) {
    const from = await rectOf(idx);
    const to = await slotRectOf(idx);
    console.log(`\n--- drop piece ${idx + 1} -> slot ${idx} ---`);
    console.log("  piece center:", from);
    console.log("  slot  center:", to);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await sleep(150);
    console.log("  after down: inFlight=%d (want 1)", await inFlight());

    for (let s = 1; s <= 6; s += 1) {
      await page.mouse.move(
        from.x + ((to.cx - from.x) * s) / 6,
        from.y + ((to.cy - from.y) * s) / 6,
      );
    }
    await page.mouse.up();
    await sleep(120);
    console.log("  after up:  inFlight=%d set=%s flash=%s",
      await inFlight(), await readout(), await flashState(idx));
    console.log("  window events:", JSON.stringify(await page.evaluate(() => window.__ev.splice(0))));
    await sleep(300);
  }

  console.log("\nfinal set =", await readout());
} finally {
  await browser.close();
}
