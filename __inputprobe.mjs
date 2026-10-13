/* Does pointercancel reproduce on a blank page (pure input sequencing)? */
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

async function probe(url, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0" }).catch(() => {});
  await page.evaluate(() => {
    document.body.innerHTML =
      '<div id="a" style="position:absolute;left:100px;top:100px;width:200px;height:200px;background:#222"></div>' +
      '<div id="b" style="position:absolute;left:600px;top:400px;width:200px;height:200px;background:#444"></div>';
    window.__ev = [];
    for (const t of ["pointerdown", "pointerup", "pointercancel", "mousedown", "mouseup"]) {
      window.addEventListener(
        t,
        (e) => window.__ev.push(`${t}:${e.target.id || e.target.tagName}@${Math.round(e.clientX)},${Math.round(e.clientY)}`),
        true,
      );
    }
  });
  await sleep(100);

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
    await sleep(150);
    return page.evaluate(() => window.__ev.splice(0));
  };

  console.log(`\n== ${label} ==`);
  const A = { x: 200, y: 200 };
  const B = { x: 700, y: 500 };
  for (let i = 0; i < 3; i += 1) {
    console.log(`  drag ${i}: ${JSON.stringify(await drag(A, B))}`);
  }
  await page.close();
}

await probe("about:blank", "blank page (no app JS)");
await probe("http://localhost:4599/qr/2/", "QR 02 page");

await browser.close();
