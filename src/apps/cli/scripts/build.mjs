// Bundles the CLI into one ES module and copies the viewer template next to
// it, so dist/ runs without the workspace sources.
import { chmod, copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);

await mkdir(new URL("dist/", root), { recursive: true });
await build({
  entryPoints: [new URL("src/bin.ts", root).pathname],
  outfile: new URL("dist/bin.js", root).pathname,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  legalComments: "none",
});
await chmod(new URL("dist/bin.js", root), 0o755);
const template = createRequire(import.meta.url).resolve(
  "@review-lens/viewer/viewer.html"
);
await copyFile(template, new URL("dist/viewer.html", root));
console.log("dist/bin.js, dist/viewer.html");
