// Takes the README screenshots of a built lens page with puppeteer.
// Usage: PUPPETEER_MODULE=/path/to/node_modules/puppeteer node scripts/screenshots.mjs [lens.html] [out-dir]
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PUPPETEER_MODULE ?? "puppeteer";
const puppeteer = createRequire(import.meta.url)(modulePath);
const page = resolve(process.argv[2] ?? "examples/invoice-pdf/lens.html");
const outDir = resolve(process.argv[3] ?? "docs/images");
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const browser = await puppeteer.launch({
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
try {
  const tab = await browser.newPage();
  const problems = [];
  tab.on("console", (message) => problems.push(`console: ${message.text()}`));
  tab.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  await tab.setViewport({ width: 1440, height: 700, deviceScaleFactor: 2 });
  await tab.goto(pathToFileURL(page).href, { waitUntil: "networkidle0" });
  await wait(300);
  const shot = async (name) => {
    const app = await tab.$("#app");
    await app.screenshot({ path: `${outDir}/${name}.png` });
    console.log(`${outDir}/${name}.png`);
  };
  await shot("map");
  await tab.evaluate(() => window.__lens.select("JOB"));
  await wait(200);
  await shot("card-selected");
  await tab.evaluate(() => window.__lens.select("done"));
  await wait(200);
  await shot("state-selected");
  await tab.evaluate(() => {
    window.__lens.select(null);
    window.__lens.toggle("JOB");
  });
  await wait(300);
  await shot("collapsed");
  for (const line of problems) {
    console.log(line);
  }
} finally {
  await browser.close();
}
