// Bundles the viewer into one IIFE and inlines it and the CSS into
// dist/viewer.html. The CLI fills the __LENS_JSON__ placeholder.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { build, transform } from "esbuild";

const MAX_BYTES = 300 * 1024;
const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const js = await build({
  entryPoints: [new URL("src/main.ts", root).pathname],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  legalComments: "none",
  write: false,
});
const script = js.outputFiles[0]?.text ?? "";
const css = await transform(await read("src/styles.css"), {
  loader: "css",
  minify: true,
});
const template = await read("src/template.html");

if (/<\/script/i.test(script) || script.includes("__LENS_JSON__")) {
  throw new Error(
    "The bundle must not contain </script or the JSON placeholder"
  );
}
const html = template
  .replace("/*__CSS__*/", () => css.code.trim())
  .replace("/*__JS__*/", () => script.trim());
if (html.split("__LENS_JSON__").length !== 2) {
  throw new Error("The template must contain the JSON placeholder once");
}
const bytes = Buffer.byteLength(html);
if (bytes > MAX_BYTES) {
  throw new Error(`viewer.html is ${bytes} bytes; the limit is ${MAX_BYTES}`);
}
await mkdir(new URL("dist/", root), { recursive: true });
await writeFile(new URL("dist/viewer.html", root), html);
console.log(`dist/viewer.html ${(bytes / 1024).toFixed(1)} KB`);
