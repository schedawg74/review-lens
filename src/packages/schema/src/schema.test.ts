import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lensSchema } from "./index";

const example = (): Record<string, unknown> =>
  JSON.parse(
    readFileSync(
      new URL("../../../../examples/invoice-pdf/lens.json", import.meta.url),
      "utf8"
    )
  ) as Record<string, unknown>;

describe("lensSchema", () => {
  it("parses the example and fills defaults", () => {
    const lens = lensSchema.parse(example());
    expect(lens.nodes.find((node) => node.id === "LIFE")?.status).toBe(
      "context"
    );
    expect(lens.edges[0]?.kind).toBe("flow");
    expect(lens.nodes.find((node) => node.id === "HND")?.kind).toBe("unit");
  });

  it("accepts the child marks", () => {
    const lens = lensSchema.parse(example());
    const marks = lens.nodes.flatMap(
      (node) => node.children?.nodes.map((child) => child.mark) ?? []
    );
    expect(marks).toEqual([undefined, "bugPath", "mayBreak", undefined]);
  });

  it("rejects coordinates", () => {
    const raw = example();
    const nodes = raw.nodes as Record<string, unknown>[];
    const first = nodes[0];
    if (first) {
      first.x = 10;
    }
    expect(lensSchema.safeParse(raw).success).toBe(false);
  });
});
