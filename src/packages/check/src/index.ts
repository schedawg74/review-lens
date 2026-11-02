import {
  type Facts,
  type FactsFile,
  type Lens,
  lensSchema,
} from "@review-lens/schema";
import type { z } from "zod";

export type Problem = { path: string; message: string };
export type CheckResult = {
  errors: Problem[];
  warnings: Problem[];
  lens?: Lens;
};
export type CheckLimits = { maxCards: number; maxChildEdges: number };

export const defaultLimits: CheckLimits = { maxCards: 16, maxChildEdges: 20 };

type Report = {
  error: (path: string, message: string) => void;
  warn: (path: string, message: string) => void;
};

const LEADING_DOT = /^\./;

const issuePath = (issue: z.core.$ZodIssue): string => {
  const path = issue.path
    .map((part) =>
      typeof part === "number" ? `[${part}]` : `.${String(part)}`
    )
    .join("");
  return path.replace(LEADING_DOT, "") || "(root)";
};

const checkIds = (lens: Lens, report: Report): Set<string> => {
  const seen = new Set<string>();
  const add = (id: string, path: string): void => {
    if (seen.has(id)) {
      report.error(
        path,
        `id "${id}" is used twice; card and child ids must be unique`
      );
    }
    seen.add(id);
  };
  lens.nodes.forEach((node, i) => {
    add(node.id, `nodes[${i}].id`);
    for (const [j, child] of (node.children?.nodes ?? []).entries()) {
      add(child.id, `nodes[${i}].children.nodes[${j}].id`);
    }
  });
  const lanes = new Set<string>();
  lens.lanes.forEach((lane, i) => {
    if (lanes.has(lane.id)) {
      report.error(`lanes[${i}].id`, `lane id "${lane.id}" is used twice`);
    }
    lanes.add(lane.id);
  });
  const decisions = new Set<string>();
  lens.decisions.forEach((decision, i) => {
    if (decisions.has(decision.id)) {
      report.error(
        `decisions[${i}].id`,
        `decision id "${decision.id}" is used twice`
      );
    }
    decisions.add(decision.id);
  });
  return seen;
};

const checkReferences = (
  lens: Lens,
  ids: Set<string>,
  report: Report
): void => {
  const lanes = new Set(lens.lanes.map((lane) => lane.id));
  const cards = new Set(lens.nodes.map((node) => node.id));
  lens.nodes.forEach((node, i) => {
    if (!lanes.has(node.lane)) {
      report.error(`nodes[${i}].lane`, `lane "${node.lane}" does not exist`);
    }
  });
  lens.edges.forEach((edge, i) => {
    for (const end of ["from", "to"] as const) {
      if (!cards.has(edge[end])) {
        report.error(
          `edges[${i}].${end}`,
          `card "${edge[end]}" does not exist`
        );
      }
    }
    if (edge.from === edge.to) {
      report.error(`edges[${i}]`, "an edge must connect two different cards");
    }
  });
  lens.decisions.forEach((decision, i) => {
    decision.nodes.forEach((id, j) => {
      if (!ids.has(id)) {
        report.error(
          `decisions[${i}].nodes[${j}]`,
          `node "${id}" does not exist`
        );
      }
    });
    if (decision.line !== undefined && decision.path === undefined) {
      report.error(`decisions[${i}].line`, "a line needs a path");
    }
  });
};

const checkChildren = (
  lens: Lens,
  limits: CheckLimits,
  report: Report
): void => {
  lens.nodes.forEach((node, i) => {
    if (!node.children) {
      if (node.expanded) {
        report.warn(
          `nodes[${i}].expanded`,
          "expanded has no effect without children"
        );
      }
      return;
    }
    const own = new Set(node.children.nodes.map((child) => child.id));
    node.children.edges.forEach((edge, j) => {
      for (const end of ["from", "to"] as const) {
        if (!own.has(edge[end])) {
          report.error(
            `nodes[${i}].children.edges[${j}].${end}`,
            `child "${edge[end]}" does not exist in this card`
          );
        }
      }
    });
    if (node.children.edges.length > limits.maxChildEdges) {
      report.warn(
        `nodes[${i}].children.edges`,
        `${node.children.edges.length} arrows; keep a state machine at ${limits.maxChildEdges} or fewer`
      );
    }
    if (node.kind === "note") {
      report.error(`nodes[${i}].children`, "a note card cannot have children");
    }
  });
};

const checkShape = (lens: Lens, limits: CheckLimits, report: Report): void => {
  const cards = lens.nodes.filter((node) => node.kind !== "note").length;
  if (cards > limits.maxCards) {
    report.warn(
      "nodes",
      `${cards} cards; keep a map at ${limits.maxCards} or fewer`
    );
  }
  const connected = new Set(lens.edges.flatMap((edge) => [edge.from, edge.to]));
  lens.nodes.forEach((node, i) => {
    if (
      node.kind !== "note" &&
      !connected.has(node.id) &&
      lens.nodes.length > 1
    ) {
      report.warn(`nodes[${i}]`, `card "${node.id}" has no edge`);
    }
    if (node.status === "removed") {
      node.files?.forEach((file, j) => {
        if (file.add > 0) {
          report.error(
            `nodes[${i}].files[${j}].add`,
            "a removed card cannot have added lines"
          );
        }
      });
    }
  });
  const classTotal = lens.triage.classes.reduce(
    (sum, item) => sum + item.files,
    0
  );
  if (classTotal !== lens.triage.files) {
    report.warn(
      "triage.classes",
      `classes add up to ${classTotal} files, triage.files is ${lens.triage.files}`
    );
  }
};

type Anchored = { path: string; line?: number | undefined; where: string };

const anchorsOf = (lens: Lens): Anchored[] => {
  const list: Anchored[] = [];
  for (const [i, node] of lens.nodes.entries()) {
    for (const [j, a] of (node.inside ?? []).entries()) {
      list.push({
        path: a.path,
        line: a.line,
        where: `nodes[${i}].inside[${j}]`,
      });
    }
    for (const [j, child] of (node.children?.nodes ?? []).entries()) {
      for (const [k, a] of (child.inside ?? []).entries()) {
        list.push({
          path: a.path,
          line: a.line,
          where: `nodes[${i}].children.nodes[${j}].inside[${k}]`,
        });
      }
    }
  }
  for (const [i, decision] of lens.decisions.entries()) {
    if (decision.path) {
      list.push({
        path: decision.path,
        line: decision.line,
        where: `decisions[${i}]`,
      });
    }
  }
  return list;
};

const checkAnchor = (
  anchor: Anchored,
  file: FactsFile | undefined,
  report: Report
): void => {
  if (!file) {
    report.warn(
      `${anchor.where}.path`,
      `"${anchor.path}" is not in the diff, so the link opens the PR files page`
    );
    return;
  }
  if (anchor.line === undefined) {
    return;
  }
  if (file.lines === null) {
    report.error(
      `${anchor.where}.line`,
      `"${anchor.path}" has no lines at head (deleted or binary)`
    );
    return;
  }
  if (anchor.line > file.lines) {
    report.error(
      `${anchor.where}.line`,
      `line ${anchor.line} is after the end of "${anchor.path}" (${file.lines} lines)`
    );
  }
};

const checkFacts = (lens: Lens, facts: Facts, report: Report): void => {
  const files = new Map(facts.files.map((file) => [file.path, file]));
  lens.nodes.forEach((node, i) => {
    node.files?.forEach((change, j) => {
      const where = `nodes[${i}].files[${j}]`;
      const fact = files.get(change.path);
      if (!fact) {
        report.error(`${where}.path`, `"${change.path}" is not in the diff`);
        return;
      }
      if (fact.add !== change.add || fact.del !== change.del) {
        report.error(
          where,
          `+${change.add} −${change.del} does not match the diff (+${fact.add} −${fact.del})`
        );
      }
      if (node.status === "removed" && fact.add > 0) {
        report.error(
          where,
          `a removed card cannot point at a file with added lines (+${fact.add})`
        );
      }
    });
  });
  for (const anchor of anchorsOf(lens)) {
    checkAnchor(anchor, files.get(anchor.path), report);
  }
  if (lens.triage.files !== facts.files.length) {
    report.warn(
      "triage.files",
      `triage.files is ${lens.triage.files}, the diff has ${facts.files.length} files`
    );
  }
};

export const checkLens = (
  raw: unknown,
  facts?: Facts,
  limits: Partial<CheckLimits> = {}
): CheckResult => {
  const errors: Problem[] = [];
  const warnings: Problem[] = [];
  const parsed = lensSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({ path: issuePath(issue), message: issue.message });
    }
    return { errors, warnings };
  }
  const lens = parsed.data;
  const report: Report = {
    error: (path, message) => errors.push({ path, message }),
    warn: (path, message) => warnings.push({ path, message }),
  };
  const merged: CheckLimits = { ...defaultLimits, ...limits };
  const ids = checkIds(lens, report);
  checkReferences(lens, ids, report);
  checkChildren(lens, merged, report);
  checkShape(lens, merged, report);
  if (facts) {
    checkFacts(lens, facts, report);
  }
  return { errors, warnings, lens };
};

export const formatProblems = (
  result: Pick<CheckResult, "errors" | "warnings">
): string[] => [
  ...result.errors.map(
    (problem) => `error   ${problem.path}: ${problem.message}`
  ),
  ...result.warnings.map(
    (problem) => `warning ${problem.path}: ${problem.message}`
  ),
];
