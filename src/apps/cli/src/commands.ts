import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CheckResult,
  checkLens,
  formatProblems,
} from "@review-lens/check";
import { type Facts, factsSchema } from "@review-lens/schema";
import { buildFacts } from "./facts";
import { fillTemplate } from "./html";

export type Output = { code: number; stdout: string[]; stderr: string[] };

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));

const readFacts = (path: string | undefined): Facts | undefined =>
  path ? factsSchema.parse(readJson(path)) : undefined;

export const templatePath = (): string => {
  const sibling = fileURLToPath(new URL("./viewer.html", import.meta.url));
  if (existsSync(sibling)) {
    return sibling;
  }
  return createRequire(import.meta.url).resolve(
    "@review-lens/viewer/viewer.html"
  );
};

const summary = (result: CheckResult): string =>
  `${result.errors.length} error${result.errors.length === 1 ? "" : "s"}, ${result.warnings.length} warning${
    result.warnings.length === 1 ? "" : "s"
  }`;

export const factsCommand = (opts: {
  base: string;
  head: string;
  cwd: string;
  out?: string | undefined;
}): Output => {
  const facts = buildFacts({
    base: opts.base,
    head: opts.head,
    cwd: resolve(opts.cwd),
  });
  const json = `${JSON.stringify(facts, null, 2)}\n`;
  if (!opts.out) {
    return { code: 0, stdout: [json.trimEnd()], stderr: [] };
  }
  writeFileSync(opts.out, json);
  const logic =
    facts.triage.classes.find((item) => item.kind === "logic")?.files ?? 0;
  return {
    code: 0,
    stdout: [],
    stderr: [`${opts.out}: ${facts.files.length} files, ${logic} hold logic`],
  };
};

export const checkCommand = (opts: {
  lens: string;
  facts?: string | undefined;
}): Output => {
  const result = checkLens(readJson(opts.lens), readFacts(opts.facts));
  const lines = formatProblems(result);
  const code = result.errors.length > 0 ? 1 : 0;
  return {
    code,
    stdout: [...lines, `${opts.lens}: ${summary(result)}`],
    stderr: [],
  };
};

export const htmlCommand = (opts: {
  lens: string;
  out: string;
  facts?: string | undefined;
}): Output => {
  const result = checkLens(readJson(opts.lens), readFacts(opts.facts));
  const problems = formatProblems(result);
  if (result.errors.length > 0 || !result.lens) {
    return {
      code: 1,
      stdout: [],
      stderr: [
        ...problems,
        `${opts.lens}: ${summary(result)}; no HTML written`,
      ],
    };
  }
  const html = fillTemplate(readFileSync(templatePath(), "utf8"), result.lens);
  writeFileSync(opts.out, html);
  return {
    code: 0,
    stdout: [],
    stderr: [
      ...problems,
      `${opts.out}: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`,
    ],
  };
};
