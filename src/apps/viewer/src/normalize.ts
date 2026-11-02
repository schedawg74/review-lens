import type { Lens, LensInput } from "@review-lens/schema";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const looksLikeLens = (value: unknown): value is LensInput =>
  isObject(value) &&
  value.version === 2 &&
  isObject(value.pr) &&
  isObject(value.triage) &&
  Array.isArray(value.lanes) &&
  Array.isArray(value.nodes) &&
  Array.isArray(value.edges) &&
  Array.isArray(value.decisions);

export const normalizeLens = (value: unknown): Lens | null => {
  if (!looksLikeLens(value)) {
    return null;
  }
  return {
    ...value,
    nodes: value.nodes.map((node) => ({
      ...node,
      kind: node.kind ?? "unit",
      status: node.status ?? "context",
      children: node.children && {
        ...node.children,
        nodes: node.children.nodes.map((child) => ({
          ...child,
          tone: child.tone ?? "neutral",
        })),
      },
    })),
    edges: value.edges.map((edge) => ({ ...edge, kind: edge.kind ?? "flow" })),
  };
};
