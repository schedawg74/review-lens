import { readFileSync } from "node:fs";
import { type Lens, type LensInput, lensSchema } from "@review-lens/schema";
import { describe, expect, it } from "vitest";
import {
  childEdgeKey,
  labelPosition,
  layoutChildren,
  rankChildren,
} from "./children";
import { cardWidths, layoutMap, rankNodes } from "./map";
import { orthPath } from "./path";
import type { MapSizes, Size } from "./types";

const STRAIGHT_LINE = /^M[\d.]+,[\d.]+ L[\d.]+,[\d.]+$/;

const base: LensInput = {
  version: 2,
  pr: { repo: "example/app", number: 1, title: "t", head: "abcdef0" },
  generatedBy: { skill: "s", role: "r", model: "m" },
  triage: { files: 0, classes: [] },
  title: "T",
  summary: "S",
  lanes: [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
  ],
  nodes: [{ id: "x", lane: "a", title: "x" }],
  edges: [],
  decisions: [],
};

const lens = (patch: Partial<LensInput>): Lens =>
  lensSchema.parse({ ...base, ...patch });

const uniform = (ids: string[], size: Size = { w: 180, h: 60 }): MapSizes => ({
  nodes: Object.fromEntries(ids.map((id) => [id, size])),
});

const example = (): Lens =>
  lensSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../examples/invoice-pdf/lens.json", import.meta.url),
        "utf8"
      )
    )
  );

const exampleSizes = (graph: Lens): MapSizes => ({
  nodes: Object.fromEntries(
    graph.nodes.map((node, i) => [
      node.id,
      {
        w: node.expanded ? 380 : 190 + (i % 3) * 10,
        h: node.expanded ? 360 : 70,
      },
    ])
  ),
});

describe("rankNodes", () => {
  it("puts a same-lane target one row down and a right-lane target in the same row", () => {
    const graph = lens({
      nodes: [
        { id: "p", lane: "a", title: "p" },
        { id: "q", lane: "a", title: "q" },
        { id: "r", lane: "b", title: "r" },
      ],
      edges: [
        { from: "p", to: "q" },
        { from: "q", to: "r" },
      ],
    });
    expect(rankNodes(graph)).toEqual({ p: 0, q: 1, r: 1 });
  });

  it("moves the target of an edge from a lane on the right one row down", () => {
    const graph = lens({
      nodes: [
        { id: "p", lane: "b", title: "p" },
        { id: "q", lane: "a", title: "q" },
      ],
      edges: [{ from: "p", to: "q" }],
    });
    expect(rankNodes(graph)).toEqual({ p: 0, q: 1 });
  });

  it("does not rank by moved edges", () => {
    const graph = lens({
      nodes: [
        { id: "p", lane: "a", title: "p" },
        { id: "q", lane: "a", title: "q" },
      ],
      edges: [{ from: "p", to: "q", kind: "moved" }],
    });
    expect(rankNodes(graph)).toEqual({ p: 0, q: 0 });
  });

  it("gives a node without incoming edges the row of the previous node in its lane", () => {
    const graph = lens({
      nodes: [
        { id: "p", lane: "a", title: "p" },
        { id: "q", lane: "a", title: "q" },
        { id: "note", lane: "a", kind: "note", title: "n" },
      ],
      edges: [{ from: "p", to: "q" }],
    });
    expect(rankNodes(graph)).toEqual({ p: 0, q: 1, note: 1 });
  });

  it("stops on a cycle", () => {
    const graph = lens({
      nodes: [
        { id: "p", lane: "a", title: "p" },
        { id: "q", lane: "a", title: "q" },
      ],
      edges: [
        { from: "p", to: "q" },
        { from: "q", to: "p" },
      ],
    });
    const ranks = rankNodes(graph);
    expect(
      Object.values(ranks).every((rank) => rank <= graph.nodes.length + 1)
    ).toBe(true);
  });

  it("ranks the example like the drawing", () => {
    const ranks = rankNodes(example());
    expect(ranks).toMatchObject({
      FIN: 0,
      SNAP: 0,
      HND: 0,
      JOB: 1,
      DB: 1,
      MAIL: 1,
      REN: 2,
      S3: 2,
      GEN: 1,
      LIFE: 1,
    });
  });
});

describe("layoutMap", () => {
  it("stacks nodes of one lane and row and sizes the row by the tallest stack", () => {
    const graph = lens({
      nodes: [
        { id: "p", lane: "a", title: "p" },
        { id: "q", lane: "a", title: "q" },
        { id: "r", lane: "b", title: "r" },
      ],
    });
    const out = layoutMap(graph, uniform(["p", "q", "r"]), {
      stackGap: 10,
      laneHead: 40,
      rowGap: 30,
      bottomPad: 6,
    });
    expect(out.cards.p?.y).toBe(40);
    expect(out.cards.q?.y).toBe(110);
    expect(out.cards.r?.y).toBe(40);
    expect(out.height).toBe(40 + 130 + 30 + 6);
  });

  it("makes a lane as wide as its widest card and centers narrower cards", () => {
    const graph = lens({
      nodes: [
        { id: "p", lane: "a", title: "p" },
        { id: "q", lane: "a", title: "q" },
      ],
    });
    const sizes: MapSizes = {
      nodes: { p: { w: 200, h: 50 }, q: { w: 240, h: 50 } },
    };
    const out = layoutMap(graph, sizes);
    expect(out.laneWidths[0]).toBe(240);
    expect(out.cards.p?.w).toBe(200);
    expect((out.cards.p?.x ?? 0) - (out.cards.q?.x ?? 0)).toBe(20);
    expect(cardWidths(graph, sizes)).toEqual({ p: 240, q: 240 });
  });

  it("keeps the width of an expanded card", () => {
    const graph = lens({
      nodes: [
        { id: "p", lane: "a", title: "p" },
        {
          id: "q",
          lane: "a",
          title: "q",
          expanded: true,
          children: {
            label: "2 states",
            nodes: [{ id: "s1", title: "one" }],
            edges: [],
          },
        },
      ],
    });
    const sizes: MapSizes = {
      nodes: { p: { w: 400, h: 50 }, q: { w: 300, h: 200 } },
    };
    expect(cardWidths(graph, sizes)).toEqual({ p: 400, q: 300 });
  });

  it("draws a same-lane edge bottom to top when no card is between", () => {
    const graph = lens({
      nodes: [
        { id: "p", lane: "a", title: "p" },
        { id: "q", lane: "a", title: "q" },
      ],
      edges: [{ from: "p", to: "q" }],
    });
    const edge = layoutMap(graph, uniform(["p", "q"])).edges[0];
    expect(edge?.source).toBe("bottom");
    expect(edge?.target).toBe("top");
    expect(edge?.d).toMatch(STRAIGHT_LINE);
  });

  it("routes a same-lane edge along the left side when a card is between", () => {
    const graph = lens({
      nodes: [
        { id: "p", lane: "a", title: "p" },
        { id: "q", lane: "a", title: "q" },
        { id: "r", lane: "a", title: "r" },
      ],
      edges: [
        { from: "p", to: "q", kind: "removed" },
        { from: "p", to: "r", kind: "removed" },
      ],
    });
    const out = layoutMap(graph, uniform(["p", "q", "r"]));
    expect(out.edges[1]?.source).toBe("left");
    expect(out.edges[1]?.target).toBe("left");
  });

  it("orders ports on one side by the position of the other end", () => {
    const graph = lens({
      nodes: [
        { id: "src", lane: "a", title: "s" },
        { id: "up", lane: "b", title: "u" },
        { id: "down", lane: "b", title: "d" },
      ],
      edges: [
        { from: "src", to: "down" },
        { from: "src", to: "up" },
      ],
    });
    const out = layoutMap(graph, uniform(["src", "up", "down"]));
    const toDown = out.edges.find((edge) => edge.to === "down");
    const toUp = out.edges.find((edge) => edge.to === "up");
    expect(toUp?.start[1]).toBeLessThan(toDown?.start[1] ?? 0);
    expect(toUp?.source).toBe("right");
  });

  it("bends a cross-lane edge in the gap before the target lane", () => {
    const graph = lens({
      nodes: [
        { id: "p", lane: "a", title: "p" },
        { id: "q", lane: "b", title: "q" },
        { id: "r", lane: "b", title: "r" },
      ],
      edges: [{ from: "p", to: "r" }],
    });
    const out = layoutMap(graph, uniform(["p", "q", "r"]));
    const laneB = out.lanes[1];
    expect(laneB).toBeDefined();
    const bend = (laneB?.x ?? 0) - 22;
    expect(out.edges[0]?.d).toContain(`Q${bend},`);
  });

  it("draws moved edges as curves with a pill", () => {
    const graph = lens({
      nodes: [
        { id: "p", lane: "a", title: "p" },
        { id: "q", lane: "b", title: "q" },
      ],
      edges: [{ from: "p", to: "q", kind: "moved", label: "moved" }],
    });
    const out = layoutMap(graph, uniform(["p", "q"]));
    expect(out.edges[0]?.d).toContain(" C");
    expect(out.pills).toHaveLength(1);
    expect(out.pills[0]?.text).toBe("moved");
  });

  it("returns the same output for the same input", () => {
    const graph = example();
    const sizes = exampleSizes(graph);
    expect(JSON.stringify(layoutMap(graph, sizes))).toBe(
      JSON.stringify(layoutMap(example(), exampleSizes(example())))
    );
  });

  it("puts no two cards on top of each other in the example", () => {
    const graph = example();
    const boxes = Object.values(layoutMap(graph, exampleSizes(graph)).cards);
    for (const a of boxes) {
      for (const b of boxes) {
        if (a.id >= b.id) {
          continue;
        }
        const apart =
          a.x + a.w <= b.x ||
          b.x + b.w <= a.x ||
          a.y + a.h <= b.y ||
          b.y + b.h <= a.y;
        expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
      }
    }
  });
});

describe("children", () => {
  const machine = {
    nodes: [
      { id: "queued", title: "queued", tone: "neutral" as const },
      {
        id: "running",
        title: "running",
        tone: "warn" as const,
        mark: "bugPath" as const,
      },
      {
        id: "done",
        title: "done",
        tone: "ok" as const,
        mark: "mayBreak" as const,
      },
      { id: "failed", title: "failed", tone: "bad" as const },
    ],
    edges: [
      { from: "queued", to: "running", label: "claim" },
      { from: "running", to: "queued", label: "retry" },
      { from: "running", to: "done", label: "ok" },
      { from: "running", to: "failed" },
    ],
  };
  const sizes = {
    nodes: Object.fromEntries(
      machine.nodes.map((node) => [node.id, { w: 90, h: 28 }])
    ),
  };

  it("detects back edges and ranks by longest path", () => {
    const { ranks, back } = rankChildren(machine);
    expect(ranks).toEqual({ queued: 0, running: 1, done: 2, failed: 2 });
    expect([...back]).toEqual([1]);
  });

  it("finds back edges in a longer cycle", () => {
    const { back } = rankChildren({
      nodes: [
        { id: "a", title: "a", tone: "neutral" },
        { id: "b", title: "b", tone: "neutral" },
        { id: "c", title: "c", tone: "neutral" },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "a" },
      ],
    });
    expect([...back]).toEqual([2]);
  });

  it("draws back edges dashed on the right and forward edges straight", () => {
    const out = layoutChildren(machine, sizes);
    const back = out.edges.find((edge) => edge.back);
    const forward = out.edges.find((edge) => edge.key === "queued>running");
    expect(back?.style).toBe("back");
    expect(forward?.d).toMatch(STRAIGHT_LINE);
    const running = out.nodes.running;
    const backX = Number(back?.d.slice(1).split(",")[0]);
    expect(backX).toBeGreaterThan((running?.x ?? 0) + (running?.w ?? 0) / 2);
    const forwardX = Number(forward?.d.slice(1).split(",")[0]);
    expect(forwardX).toBeLessThan((running?.x ?? 0) + (running?.w ?? 0) / 2);
  });

  it("styles a step on the bug path", () => {
    const out = layoutChildren(machine, sizes);
    expect(out.edges.find((edge) => edge.key === "running>done")?.style).toBe(
      "bug"
    );
    expect(out.edges.find((edge) => edge.key === "running>failed")?.style).toBe(
      "flow"
    );
  });

  it("places rows by rank and keeps labels inside the box", () => {
    const labels = {
      [childEdgeKey({ from: "running", to: "done" })]: { w: 120, h: 14 },
    };
    const out = layoutChildren(machine, { ...sizes, labels });
    expect(out.nodes.done?.y).toBe(out.nodes.failed?.y);
    expect(out.nodes.queued?.y).toBeLessThan(out.nodes.running?.y ?? 0);
    for (const edge of out.edges) {
      if (!edge.label) {
        continue;
      }
      const position = labelPosition(
        edge.label,
        labels[edge.key] ?? { w: 0, h: 0 }
      );
      expect(position.left).toBeGreaterThanOrEqual(0);
      expect(position.top + 14).toBeLessThanOrEqual(out.height);
    }
  });

  it("is deterministic", () => {
    expect(JSON.stringify(layoutChildren(machine, sizes))).toBe(
      JSON.stringify(layoutChildren(machine, sizes))
    );
  });
});

describe("orthPath", () => {
  it("rounds corners", () => {
    expect(
      orthPath([
        [0, 0],
        [20, 0],
        [20, 20],
      ])
    ).toBe("M0,0 L12,0 Q20,0 20,8 L20,20");
  });
});
