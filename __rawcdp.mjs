/* Raw CDP mouse sequences — find one that yields pointerup on every drag. */
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

/** move style: 'left' (puppeteer) or 'none' (spec) on mouseMoved while pressed */
async function dragRaw(client, { moveButton, addPointerType, releaseClickCount }) {
  const pt = addPointerType ? { pointerType: "mouse" } : {};
  const send = (msg) => client.send("Input.dispatchMouseEvent", { ...pt, ...msg });

  await send({ type: "mouseMoved", x: A.x, y: A.y, buttons: 0, button: "none" });
  await sleep(30);
  await send({ type: "mousePressed", x: A.x, y: A.y, buttons: 1, button: "left", clickCount: 1 });
  for (let s = 1; s <= 6; s += 1) {
    await send({
      type: "mouseMoved",
      x: Math.round(A.x + ((B.x - A.x) * s) / 6),
      y: Math.round(A.y + ((B.y - A.y) * s) / 6),
      buttons: 1,
      button: moveButton,
    });
    await sleep(15);
  }
  await sleep(30);
  await send({
    type: "mouseReleased",
    x: B.x,
    y: B.y,
    buttons: 0,
    button: "left",
    clickCount: releaseClickCount,
  });
}

async function run(name, opts) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto("about:blank");
  await page.evaluate(() => {
    document.body.innerHTML =
      '<div id="a" style="position:absolute;left:100px;top:100px;width:200px;height:200px;background:#222"></div>' +
      '<div id="b" style="position:absolute;left:600px;top:400px;width:200px;height:200px;background:#444"></div>';
    window.__ev = [];
    for (const t of ["pointerdown", "pointerup", "pointercancel"]) {
      window.addEventListener(t, (e) => window.__ev.push(t), true);
    }
  });
  await sleep(80);
  const client = await page.createCDPSession();

  const out = [];
  for (let i = 0; i < 3; i += 1) {
    await page.evaluate(() => window.__ev.splice(0));
    await dragRaw(client, opts);
    await sleep(200);
    out.push((await page.evaluate(() => window.__ev)).join(">"));
  }
  const ok = out.every((o) => o === "pointerdown>pointerup");
  console.log(`${ok ? "OK  " : "FAIL"} ${name}\n      ${out.join(" | ")}`);
  await page.close();
}

await run("puppeteer-like: move button=left", { moveButton: "left", addPointerType: false, releaseClickCount: 1 });
await run("move button=none", { moveButton: "none", addPointerType: false, releaseClickCount: 1 });
await run("move button=none + pointerType", { moveButton: "none", addPointerType: true, releaseClickCount: 1 });
await run("move button=none, release clickCount=0", { moveButton: "none", addPointerType: false, releaseClickCount: 0 });
await run("move button=left + pointerType", { moveButton: "left", addPointerType: true, releaseClickCount: 1 });

await browser.close();
