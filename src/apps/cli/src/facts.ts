import { execFileSync } from "node:child_process";
import type { Facts, FactsFile } from "@review-lens/schema";
import { classifyPath, triageOf } from "./classify";

export type NumstatEntry = {
  path: string;
  add: number;
  del: number;
  binary: boolean;
};

export const parseNumstat = (output: string): NumstatEntry[] =>
  output
    .split("\0")
    .filter((record) => record.length > 0)
    .map((record) => {
      const [add = "", del = "", ...rest] = record.split("\t");
      const binary = add === "-" && del === "-";
      return {
        path: rest.join("\t"),
        add: binary ? 0 : Number(add),
        del: binary ? 0 : Number(del),
        binary,
      };
    });

export const countLines = (text: string): number => {
  if (text.length === 0) {
    return 0;
  }
  const breaks = text.split("\n").length - 1;
  return text.endsWith("\n") ? breaks : breaks + 1;
};

const git = (cwd: string, args: string[]): string =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

const existsAt = (cwd: string, head: string): Set<string> =>
  new Set(
    git(cwd, ["ls-tree", "-r", "-z", "--name-only", head])
      .split("\0")
      .filter(Boolean)
  );

export type FactsOptions = { base: string; head: string; cwd: string };

export const buildFacts = ({ base, head, cwd }: FactsOptions): Facts => {
  const baseSha = git(cwd, [
    "rev-parse",
    "--verify",
    `${base}^{commit}`,
  ]).trim();
  const headSha = git(cwd, [
    "rev-parse",
    "--verify",
    `${head}^{commit}`,
  ]).trim();
  const entries = parseNumstat(
    git(cwd, [
      "diff",
      "--numstat",
      "-z",
      "--no-renames",
      `${baseSha}...${headSha}`,
    ])
  );
  const present = existsAt(cwd, headSha);
  const files: FactsFile[] = entries.map((entry) => {
    const lines =
      entry.binary || !present.has(entry.path)
        ? null
        : countLines(git(cwd, ["show", `${headSha}:${entry.path}`]));
    const file: FactsFile = {
      path: entry.path,
      add: entry.add,
      del: entry.del,
      lines,
      class: classifyPath(entry.path),
    };
    if (entry.binary) {
      file.binary = true;
    }
    return file;
  });
  return {
    version: 1,
    base: baseSha,
    head: headSha,
    files,
    triage: triageOf(files.map((file) => file.class)),
  };
};
