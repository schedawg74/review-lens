import type { TriageClass, TriageKind } from "@review-lens/schema";

type Rule = { kind: TriageKind; test: RegExp };

const RULES: readonly Rule[] = [
  {
    kind: "generated",
    test: /(^|\/)(generated|__generated__|dist|vendor)\/|\.gen\.|\.min\.(js|css)$|\.snap$|(^|\/)(openapi\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|uv\.lock|poetry\.lock|Cargo\.lock|go\.sum)$/,
  },
  {
    kind: "tests",
    test: /(^|\/)(tests?|__tests__|e2e|fixtures|benchmarks?)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]+\.py$|_test\.(py|go)$/,
  },
  {
    kind: "docs",
    test: /(^|\/)docs?\/|\.(md|mdx|rst|adoc)$|(^|\/)(LICENSE|CHANGELOG|NOTICE)[^/]*$/,
  },
  {
    kind: "prompts",
    test: /(^|\/)(prompts?|templates|locales?|i18n|seed-data|data)\/|\.(prompt|jinja2?|j2|po|csv)$/,
  },
  {
    kind: "config",
    test: /(^|\/)\.github\/|(^|\/)\.[^/]+$|(^|\/)(package\.json|tsconfig[^/]*\.json|biome\.jsonc?|turbo\.json|pyproject\.toml|Dockerfile[^/]*|Makefile|docker-compose[^/]*)$|\.(ya?ml|toml|ini|cfg)$/,
  },
];

export const classifyPath = (path: string): TriageKind =>
  RULES.find((rule) => rule.test.test(path))?.kind ?? "logic";

const LABELS: Record<TriageKind, string> = {
  logic: "Logic",
  tests: "Tests",
  generated: "Generated",
  prompts: "Prompts + data",
  docs: "Docs",
  config: "Config",
};

const ORDER: readonly TriageKind[] = [
  "logic",
  "tests",
  "generated",
  "prompts",
  "docs",
  "config",
];

export const triageOf = (
  kinds: readonly TriageKind[]
): { files: number; classes: TriageClass[] } => ({
  files: kinds.length,
  classes: ORDER.map((kind) => ({
    kind,
    label: LABELS[kind],
    files: kinds.filter((k) => k === kind).length,
  })).filter((item) => item.files > 0),
});
