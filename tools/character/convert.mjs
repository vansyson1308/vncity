// Serve the work dir from prepare.py (python -m http.server 8767 -d <work dir>), then:
//   node tools/character/convert.mjs viewer/assets/walker.glb
import { chromium } from "playwright";
import fs from "fs";
const b = await chromium.launch(); const p = await b.newPage();
p.on("pageerror", (e) => console.log("ERR", String(e)));
await p.goto("http://localhost:8767/convert.html");
await p.waitForFunction(() => window.glb, null, { timeout: 300000 });
fs.writeFileSync(process.argv[2], Buffer.from(await p.evaluate(() => window.glb), "base64"));
console.log(process.argv[2], fs.statSync(process.argv[2]).size, "bytes");
await b.close();
