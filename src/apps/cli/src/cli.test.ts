import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyPath, triageOf } from "./classify";
import { checkCommand, htmlCommand } from "./commands";
import { buildFacts, countLines, parseNumstat } from "./facts";
import { embedJson, fillTemplate, LENS_PLACEHOLDER } from "./html";

const FULL_SHA = /^[0-9a-f]{40}$/;

const examplePath = new URL(
  "../../../../examples/invoice-pdf/lens.json",
  import.meta.url
).pathname;

describe("classifyPath", () => {
  it.each([
    ["src/api/jobs/pdf.job.ts", "logic"],
    ["worker/billing/finalize.py", "logic"],
    ["src/api/jobs/pdf.job.test.ts", "tests"],
    ["worker/tests/test_finalize.py", "tests"],
    ["packages/client/generated/models.ts", "generated"],
    ["packages/contracts/openapi.json", "generated"],
    ["pnpm-lock.yaml", "generated"],
    ["docs/guide.md", "docs"],
    ["README.md", "docs"],
    ["worker/templates/invoice/base.html", "prompts"],
    ["api/prompts/summary.en.txt", "prompts"],
    [".github/workflows/ci.yml", "config"],
    ["package.json", "config"],
    ["tsconfig.base.json", "config"],
  ] as const)("%s is %s", (path, kind) => {
    expect(classifyPath(path)).toBe(kind);
  });

  it("counts classes in a fixed order", () => {
    expect(triageOf(["tests", "logic", "logic"])).toEqual({
      files: 3,
      classes: [
        { kind: "logic", label: "Logic", files: 2 },
        { kind: "tests", label: "Tests", files: 1 },
      ],
    });
  });
});

describe("facts", () => {
  it("parses numstat output with -z", () => {
    expect(parseNumstat("3\t1\ta.ts\0-\t-\timg.png\0")).toEqual([
      { path: "a.ts", add: 3, del: 1, binary: false },
      { path: "img.png", add: 0, del: 0, binary: true },
    ]);
  });

  it("counts lines with and without a final newline", () => {
    expect(countLines("")).toBe(0);
    expect(countLines("a\nb\n")).toBe(2);
    expect(countLines("a\nb")).toBe(2);
  });

  it("reads a real diff", () => {
    const dir = mkdtempSync(join(tmpdir(), "review-lens-"));
    const git = (...args: string[]): string =>
      execFileSync(
        "git",
        ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args],
        { cwd: dir, encoding: "utf8" }
      );
    git("init", "-q", "-b", "main");
    writeFileSync(join(dir, "old.py"), "a\nb\n");
    writeFileSync(join(dir, "keep.ts"), "x\n");
    git("add", ".");
    git("commit", "-qm", "base");
    git("checkout", "-qb", "feature");
    git("rm", "-q", "old.py");
    writeFileSync(join(dir, "keep.ts"), "x\ny\nz\n");
    writeFileSync(join(dir, "keep.test.ts"), "t\n");
    git("add", ".");
    git("commit", "-qm", "change");
    const facts = buildFacts({ base: "main", head: "feature", cwd: dir });
    expect(facts.files).toEqual([
      { path: "keep.test.ts", add: 1, del: 0, lines: 1, class: "tests" },
      { path: "keep.ts", add: 2, del: 0, lines: 3, class: "logic" },
      { path: "old.py", add: 0, del: 2, lines: null, class: "logic" },
    ]);
    expect(facts.triage.files).toBe(3);
    expect(facts.head).toMatch(FULL_SHA);
  });
});

describe("html", () => {
  it("escapes the end of a script element", () => {
    const json = embedJson({ text: "</script><!-- x" });
    expect(json).not.toContain("</");
    expect(json).not.toContain("<!--");
    expect(JSON.parse(json)).toEqual({ text: "</script><!-- x" });
  });

  it("fills the placeholder once", () => {
    const template = `<p>${LENS_PLACEHOLDER}</p>`;
    const lens = JSON.parse(readFileSync(examplePath, "utf8"));
    const html = fillTemplate(template, lens);
    expect(html).not.toContain("__LENS_JSON__");
    expect(() => fillTemplate("<p></p>", lens)).toThrow("placeholder");
  });
});

describe("commands", () => {
  it("checks the example", () => {
    const out = checkCommand({ lens: examplePath });
    expect(out.code).toBe(0);
    expect(out.stdout.at(-1)).toContain("0 errors, 0 warnings");
  });

  it("refuses to write HTML for a broken lens", () => {
    const dir = mkdtempSync(join(tmpdir(), "review-lens-"));
    const broken = join(dir, "lens.json");
    const lens = JSON.parse(readFileSync(examplePath, "utf8"));
    lens.edges.push({ from: "FIN", to: "MISSING" });
    writeFileSync(broken, JSON.stringify(lens));
    const out = htmlCommand({ lens: broken, out: join(dir, "out.html") });
    expect(out.code).toBe(1);
    expect(out.stderr.join("\n")).toContain('card "MISSING" does not exist');
  });
});
