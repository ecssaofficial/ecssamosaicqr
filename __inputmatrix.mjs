/* Find an input sequence that yields pointerup on every drag. */
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

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
      (e) => window.__ev.push(`${t}@${Math.round(e.clientX)},${Math.round(e.clientY)}`),
      true,
    );
  }
});

const A = { x: 200, y: 200 };
const B = { x: 700, y: 500 };
const drain = () => page.evaluate(() => window.__ev.splice(0));

const variants = {
  "no sleep": async () => {
    await page.mouse.move(A.x, A.y);
    await page.mouse.down();
    for (let s = 1; s <= 6; s += 1)
      await page.mouse.move(A.x + ((B.x - A.x) * s) / 6, A.y + ((B.y - A.y) * s) / 6);
    await page.mouse.up();
  },
  "sleep 150 after down": async () => {
    await page.mouse.move(A.x, A.y);
    await page.mouse.down();
    await sleep(150);
    for (let s = 1; s <= 6; s += 1)
      await page.mouse.move(A.x + ((B.x - A.x) * s) / 6, A.y + ((B.y - A.y) * s) / 6);
    await page.mouse.up();
  },
  "move steps:6 + sleep 100 before down": async () => {
    await page.mouse.move(A.x, A.y, { steps: 6 });
    await sleep(100);
    await page.mouse.down();
    await page.mouse.move(B.x, B.y, { steps: 6 });
    await page.mouse.up();
  },
  "sleep 100 after up only": async () => {
    await page.mouse.move(A.x, A.y);
    await page.mouse.down();
    for (let s = 1; s <= 6; s += 1)
      await page.mouse.move(A.x + ((B.x - A.x) * s) / 6, A.y + ((B.y - A.y) * s) / 6);
    await page.mouse.up();
    await sleep(100);
  },
  "down+up instant, then 6 moves": async () => {
    await page.mouse.move(A.x, A.y);
    await page.mouse.down();
    await page.mouse.up();
    for (let s = 1; s <= 6; s += 1)
      await page.mouse.move(A.x + ((B.x - A.x) * s) / 6, A.y + ((B.y - A.y) * s) / 6);
  },
};

for (const [name, fn] of Object.entries(variants)) {
  await drain();
  const out = [];
  for (let i = 0; i < 3; i += 1) {
    await fn();
    await sleep(250);
    out.push(JSON.stringify(await drain()));
  }
  console.log(`\n${name}`);
  out.forEach((o, i) => console.log(`  drag ${i}: ${o}`));
}

await browser.close();
