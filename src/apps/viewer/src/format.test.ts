import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { diffUrl, fileLine, pathTail } from "./format";
import { sha256Hex } from "./sha256";

describe("sha256Hex", () => {
  it("matches node:crypto", () => {
    const inputs = [
      "",
      "abc",
      "src/apps/api/a.ts",
      "ä/ö/ü.md",
      "x".repeat(55),
      "y".repeat(64),
      "z".repeat(200),
    ];
    for (const input of inputs) {
      expect(sha256Hex(input)).toBe(
        createHash("sha256").update(input).digest("hex")
      );
    }
  });
});

describe("format", () => {
  it("builds GitHub diff links with a right-side line", () => {
    const pr = { repo: "example/app", number: 7, title: "t", head: "abcdef0" };
    const hash = createHash("sha256").update("a/b.ts").digest("hex");
    expect(diffUrl(pr, "a/b.ts", 12)).toBe(
      `https://github.com/example/app/pull/7/files#diff-${hash}R12`
    );
    expect(diffUrl(pr, "a/b.ts")).toBe(
      `https://github.com/example/app/pull/7/files#diff-${hash}`
    );
  });

  it("summarizes the files of a card", () => {
    expect(
      fileLine([
        { path: "x/y/job.ts", add: 10, del: 0 },
        { path: "x/z.ts", add: 1, del: 1 },
      ])
    ).toBe("job.ts +10 · 1 more");
    expect(fileLine([{ path: "old.py", add: 0, del: 5 }])).toBe("old.py −5");
    expect(fileLine(undefined)).toBe("");
    expect(pathTail("a/b/c/d.ts")).toBe("c/d.ts");
  });
});
