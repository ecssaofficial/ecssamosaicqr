/* Fresh page per variant, 3 drags each — find a reliable down/move/up sequence. */
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

const A = { x: 200, y: 200 };
const B = { x: 700, y: 500 };

const variants = {
  "6 stepped moves": async (page) => {
    await page.mouse.move(A.x, A.y);
    await page.mouse.down();
    for (let s = 1; s <= 6; s += 1)
      await page.mouse.move(A.x + ((B.x - A.x) * s) / 6, A.y + ((B.y - A.y) * s) / 6);
    await page.mouse.up();
  },
  "1 single move": async (page) => {
    await page.mouse.move(A.x, A.y);
    await page.mouse.down();
    await page.mouse.move(B.x, B.y);
    await page.mouse.up();
  },
  "100ms gap after down, then 6 moves": async (page) => {
    await page.mouse.move(A.x, A.y);
    await page.mouse.down();
    await sleep(100);
    for (let s = 1; s <= 6; s += 1)
      await page.mouse.move(A.x + ((B.x - A.x) * s) / 6, A.y + ((B.y - A.y) * s) / 6);
    await page.mouse.up();
  },
  "6 moves, 100ms gap before up": async (page) => {
    await page.mouse.move(A.x, A.y);
    await page.mouse.down();
    for (let s = 1; s <= 6; s += 1)
      await page.mouse.move(A.x + ((B.x - A.x) * s) / 6, A.y + ((B.y - A.y) * s) / 6);
    await sleep(100);
    await page.mouse.up();
  },
  "100ms gap after down + before up": async (page) => {
    await page.mouse.move(A.x, A.y);
    await page.mouse.down();
    await sleep(100);
    for (let s = 1; s <= 6; s += 1)
      await page.mouse.move(A.x + ((B.x - A.x) * s) / 6, A.y + ((B.y - A.y) * s) / 6);
    await sleep(100);
    await page.mouse.up();
  },
  "mouse.move with steps:6 then single up": async (page) => {
    await page.mouse.move(A.x, A.y, { steps: 4 });
    await page.mouse.down();
    await page.mouse.move(B.x, B.y, { steps: 4 });
    await page.mouse.up();
  },
};

for (const [name, fn] of Object.entries(variants)) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto("about:blank");
  await page.evaluate(() => {
    document.body.innerHTML =
      '<div id="a" style="position:absolute;left:100px;top:100px;width:200px;height:200px;background:#222"></div>' +
      '<div id="b" style="position:absolute;left:600px;top:400px;width:200px;height:200px;background:#444"></div>';
    window.__ev = [];
    for (const t of ["pointerdown", "pointerup", "pointercancel"]) {
      window.addEventListener(
        t,
        (e) => window.__ev.push(t),
        true,
      );
    }
  });
  await sleep(80);

  const out = [];
  for (let i = 0; i < 3; i += 1) {
    await page.evaluate(() => window.__ev.splice(0));
    await fn(page);
    await sleep(200);
    out.push((await page.evaluate(() => window.__ev)).join(">"));
  }
  const ok = out.every((o) => o === "pointerdown>pointerup");
  console.log(`${ok ? "OK  " : "FAIL"} ${name}\n      ${out.join(" | ")}`);
  await page.close();
}

await browser.close();
