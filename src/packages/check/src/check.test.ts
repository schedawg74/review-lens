import { readFileSync } from "node:fs";
import type { Facts } from "@review-lens/schema";
import { describe, expect, it } from "vitest";
import { checkLens, formatProblems } from "./index";

type Json = Record<string, unknown> & {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
};

const example = (): Json =>
  JSON.parse(
    readFileSync(
      new URL("../../../../examples/invoice-pdf/lens.json", import.meta.url),
      "utf8"
    )
  ) as Json;

const factsFor = (lens: Json): Facts => {
  const files = new Map<string, Facts["files"][number]>();
  for (const node of lens.nodes) {
    for (const file of (node.files ?? []) as {
      path: string;
      add: number;
      del: number;
    }[]) {
      files.set(file.path, {
        ...file,
        lines: file.add > 0 ? 400 : null,
        class: "logic",
      });
    }
  }
  for (const path of [
    "worker/billing/finalize.py",
    "apps/api/src/invoices/invoices.service.ts",
  ]) {
    if (!files.has(path)) {
      files.set(path, { path, add: 1, del: 0, lines: 400, class: "logic" });
    }
  }
  const list = [...files.values()];
  return {
    version: 1,
    base: "main",
    head: "HEAD",
    files: list,
    triage: { files: list.length, classes: [] },
  };
};

describe("checkLens", () => {
  it("accepts the example without errors", () => {
    const result = checkLens(example());
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("reports schema errors with a path", () => {
    const lens = example();
    lens.version = 3;
    const first = lens.nodes[0];
    if (first) {
      first.status = "new";
    }
    const result = checkLens(lens);
    expect(result.errors.map((problem) => problem.path)).toEqual([
      "version",
      "nodes[0].status",
    ]);
  });

  it("rejects unknown keys", () => {
    const lens = example();
    const first = lens.nodes[0];
    if (first) {
      first.expand = true;
    }
    expect(checkLens(lens).errors[0]?.path).toBe("nodes[0]");
  });

  it("finds dangling references and unknown lanes", () => {
    const lens = example();
    lens.edges.push({ from: "FIN", to: "NOPE" });
    const first = lens.nodes[0];
    if (first) {
      first.lane = "mobile";
    }
    const messages = checkLens(lens).errors.map((problem) => problem.message);
    expect(messages).toContain('card "NOPE" does not exist');
    expect(messages).toContain('lane "mobile" does not exist');
  });

  it("finds duplicate ids across cards and children", () => {
    const lens = example();
    lens.nodes.push({ id: "queued", lane: "api", title: "dup" });
    lens.edges.push({ from: "HND", to: "queued" });
    expect(checkLens(lens).errors.map((problem) => problem.path)).toContain(
      "nodes[12].id"
    );
  });

  it("checks child edges against the children of the same card", () => {
    const lens = example();
    const job = lens.nodes.find((node) => node.id === "JOB") as {
      children: { edges: unknown[] };
    };
    job.children.edges.push({ from: "queued", to: "HND" });
    expect(checkLens(lens).errors[0]?.message).toBe(
      'child "HND" does not exist in this card'
    );
  });

  it("warns about size limits", () => {
    const result = checkLens(example(), undefined, {
      maxCards: 5,
      maxChildEdges: 2,
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((problem) => problem.path)).toEqual([
      "nodes[7].children.edges",
      "nodes",
    ]);
  });

  it("rejects added lines on a removed card", () => {
    const lens = example();
    const gen = lens.nodes.find((node) => node.id === "GEN") as {
      files: { add: number }[];
    };
    const file = gen.files[0];
    if (file) {
      file.add = 3;
    }
    expect(checkLens(lens).errors.map((problem) => problem.message)).toContain(
      "a removed card cannot have added lines"
    );
  });

  it("passes with matching facts", () => {
    const lens = example();
    const facts = factsFor(lens);
    lens.triage = { ...(lens.triage as object), files: facts.files.length };
    const result = checkLens(lens, facts);
    expect(result.errors).toEqual([]);
  });

  it("compares files, counts and anchors with the facts", () => {
    const lens = example();
    const facts = factsFor(lens);
    const finalize = facts.files.find(
      (file) => file.path === "worker/billing/finalize.py"
    );
    if (finalize) {
      finalize.add = 65;
      finalize.lines = 50;
    }
    facts.files = facts.files.filter(
      (file) => file.path !== "worker/billing/mailer.py"
    );
    const messages = formatProblems(checkLens(lens, facts));
    expect(messages).toContain(
      "error   nodes[0].files[0]: +64 −212 does not match the diff (+65 −212)"
    );
    expect(messages).toContain(
      'error   nodes[0].inside[1].line: line 88 is after the end of "worker/billing/finalize.py" (50 lines)'
    );
    expect(messages).toContain(
      'error   nodes[2].files[0].path: "worker/billing/mailer.py" is not in the diff'
    );
  });
});
