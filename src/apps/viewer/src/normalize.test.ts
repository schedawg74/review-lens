import { describe, expect, it } from "vitest";
import { normalizeLens } from "./normalize";

describe("normalizeLens", () => {
  it("fills defaults", () => {
    const lens = normalizeLens({
      version: 2,
      pr: { repo: "a/b", number: 1, title: "t", head: "abcdef0" },
      generatedBy: { skill: "s", role: "r", model: "m" },
      triage: { files: 1, classes: [] },
      title: "T",
      summary: "S",
      lanes: [{ id: "l", title: "L" }],
      nodes: [
        {
          id: "n",
          lane: "l",
          title: "n",
          children: {
            label: "1 state",
            nodes: [{ id: "c", title: "c" }],
            edges: [],
          },
        },
      ],
      edges: [{ from: "n", to: "n" }],
      decisions: [],
    });
    expect(lens?.nodes[0]?.status).toBe("context");
    expect(lens?.nodes[0]?.kind).toBe("unit");
    expect(lens?.nodes[0]?.children?.nodes[0]?.tone).toBe("neutral");
    expect(lens?.edges[0]?.kind).toBe("flow");
  });

  it("rejects other data", () => {
    expect(normalizeLens({ version: 1 })).toBeNull();
    expect(normalizeLens("x")).toBeNull();
  });
});
