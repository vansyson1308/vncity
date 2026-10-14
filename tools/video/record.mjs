// Step walk.html#record frame by frame and save each frame as JPEG plus meta.json (scene per frame).
// Serve the site first (python -m http.server 8765 -d site/caugiay), then:
//   node tools/video/record.mjs <out dir> [fps=30] [url=http://localhost:8765/walk.html#record]
import { chromium } from "playwright";
import fs from "fs";
const [out, fpsArg, urlArg] = process.argv.slice(2);
const fps = +(fpsArg || 30), url = urlArg || "http://localhost:8765/walk.html#record";
fs.mkdirSync(out, { recursive: true });
// software GL is enough: the frames are stepped, not timed
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on("pageerror", (e) => console.log("ERR", String(e)));
await p.goto(url);
await p.waitForFunction(() => window.vncity, null, { timeout: 600000 });
await p.addStyleTag({ content: ".hud, #stick { display: none !important; }" });
const meta = [];
let i = 0, tail = Math.round(fps * 0.3);
const t0 = Date.now();
for (;;) {
  const jpg = await p.evaluate((dt) => window.vncity.frame(dt), 1 / fps);
  meta.push(await p.evaluate(() => window.vncity.scene));
  fs.writeFileSync(`${out}/f${String(i).padStart(5, "0")}.jpg`, Buffer.from(jpg.split(",")[1], "base64"));
  if (++i % 60 === 0) console.log(i, (await p.evaluate(() => window.vncity.progress)).toFixed(2), ((Date.now() - t0) / i / 1000).toFixed(2), "s/frame");
  if (await p.evaluate(() => window.vncity.done) && --tail <= 0) break;
}
fs.writeFileSync(`${out}/meta.json`, JSON.stringify(meta));
console.log(i, "frames");
await b.close();
