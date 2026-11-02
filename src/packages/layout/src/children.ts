import type { ChildEdge, ChildNode, Children } from "@review-lens/schema";
import { linePath, orthPath, round } from "./path";
import type {
  ChildEdgePath,
  ChildEdgeStyle,
  ChildLabel,
  ChildLayout,
  ChildOptions,
  ChildSizes,
  LabelAlign,
  Rect,
  Size,
} from "./types";

export const defaultChildOptions: ChildOptions = {
  gapX: 28,
  gapY: 70,
  padTop: 10,
  padBottom: 10,
  minWidth: 220,
  labelRoom: 150,
  backOffset: 14,
  pairOffset: 14,
};

type ChildGraph = Pick<Children, "nodes" | "edges">;

export const childEdgeKey = (edge: Pick<ChildEdge, "from" | "to">): string =>
  `${edge.from}>${edge.to}`;

export const rankChildren = (
  graph: ChildGraph
): { ranks: Record<string, number>; back: Set<number> } => {
  const out = new Map<string, number[]>();
  graph.edges.forEach((edge, index) => {
    const list = out.get(edge.from) ?? [];
    list.push(index);
    out.set(edge.from, list);
  });
  const ranks: Record<string, number> = {};
  const back = new Set<number>();
  const onStack = new Set<string>();
  const visit = (id: string, rank: number): void => {
    onStack.add(id);
    ranks[id] = Math.max(ranks[id] ?? 0, rank);
    for (const index of out.get(id) ?? []) {
      const edge = graph.edges[index];
      if (!edge || back.has(index)) {
        continue;
      }
      if (onStack.has(edge.to)) {
        back.add(index);
        continue;
      }
      const known = ranks[edge.to];
      if (known === undefined || known < rank + 1) {
        visit(edge.to, rank + 1);
      }
    }
    onStack.delete(id);
  };
  const first = graph.nodes[0];
  if (first) {
    visit(first.id, 0);
  }
  for (const node of graph.nodes) {
    ranks[node.id] ??= 0;
  }
  return { ranks, back };
};

const sizeOf = (sizes: ChildSizes, id: string): Size => {
  const size = sizes.nodes[id];
  if (!size) {
    throw new Error(`No size for child node "${id}"`);
  }
  return size;
};

const groupRows = (
  nodes: readonly ChildNode[],
  ranks: Record<string, number>
): string[][] => {
  const rows: string[][] = [];
  for (const node of nodes) {
    const rank = ranks[node.id] ?? 0;
    while (rows.length <= rank) {
      rows.push([]);
    }
    rows[rank]?.push(node.id);
  }
  return rows.filter((row) => row.length > 0);
};

type Box = Rect & { rank: number };

const placeRows = (
  rows: string[][],
  ctx: { sizes: ChildSizes; options: ChildOptions; rowHeight: number }
): { boxes: Record<string, Box>; width: number } => {
  const { options, rowHeight } = ctx;
  const rowWidths = rows.map(
    (row) =>
      row.reduce((sum, id) => sum + sizeOf(ctx.sizes, id).w, 0) +
      options.gapX * (row.length - 1)
  );
  const width = Math.max(options.minWidth, ...rowWidths) + options.labelRoom;
  const boxes: Record<string, Box> = {};
  rows.forEach((row, rank) => {
    let x = (width - (rowWidths[rank] ?? 0)) / 2;
    const y = options.padTop + rank * (rowHeight + options.gapY);
    for (const id of row) {
      const { w } = sizeOf(ctx.sizes, id);
      boxes[id] = { x, y, w, h: rowHeight, rank };
      x += w + options.gapX;
    }
  });
  return { boxes, width };
};

const labelBox = (label: ChildLabel, size: Size | undefined): Rect => {
  const w = size?.w ?? 0;
  const h = size?.h ?? 0;
  const offsets: Record<LabelAlign, number> = {
    left: 0,
    right: -w,
    center: -w / 2,
  };
  return { x: label.x + offsets[label.align], y: label.y, w, h };
};

type EdgeContext = {
  boxes: Record<string, Box>;
  pairs: Set<string>;
  marks: Map<string, ChildNode["mark"]>;
  options: ChildOptions;
};

const edgeStyle = (
  edge: ChildEdge,
  back: boolean,
  marks: EdgeContext["marks"]
): ChildEdgeStyle => {
  if (marks.get(edge.from) === "bugPath" && marks.get(edge.to)) {
    return "bug";
  }
  return back ? "back" : "flow";
};

const backEdge = (
  a: Box,
  b: Box,
  options: ChildOptions
): { d: string; label: Omit<ChildLabel, "text"> } => {
  const x = a.x + a.w / 2 + options.backOffset;
  if (x > b.x + 6 && x < b.x + b.w - 6) {
    return {
      d: linePath([x, a.y], [x, b.y + b.h]),
      label: { x: x + 8, y: (a.y + b.y + b.h) / 2 - 12, align: "left" },
    };
  }
  const right = Math.max(a.x + a.w, b.x + b.w) + 18;
  const ay = a.y + a.h / 2;
  const by = b.y + b.h / 2;
  return {
    d: orthPath(
      [
        [a.x + a.w, ay],
        [right, ay],
        [right, by],
        [b.x + b.w, by],
      ],
      8
    ),
    label: { x: right + 6, y: (ay + by) / 2 - 8, align: "left" },
  };
};

const forwardEdge = (
  edge: ChildEdge,
  a: Box,
  b: Box,
  ctx: EdgeContext
): { d: string; label: Omit<ChildLabel, "text"> } => {
  const paired = ctx.pairs.has(childEdgeKey({ from: edge.to, to: edge.from }));
  const centerA = a.x + a.w / 2;
  const centerB = b.x + b.w / 2;
  const sy = a.y + a.h;
  const ty = b.y;
  const straight = Math.abs(centerA - centerB) < 1;
  if (straight) {
    const x = paired ? centerA - ctx.options.pairOffset : centerA;
    return {
      d: linePath([x, sy], [x, ty]),
      label: { x: x - 8, y: (sy + ty) / 2 - 8, align: "right" },
    };
  }
  const dx = centerB - centerA;
  const sx = centerA + Math.sign(dx) * Math.min(Math.abs(dx) / 3, a.w / 3);
  return {
    d: linePath([sx, sy], [centerB, ty]),
    label: { x: centerB, y: ty + b.h + 6, align: "center" },
  };
};

const routeChildEdge = (
  edge: ChildEdge,
  index: number,
  ctx: EdgeContext & { back: boolean }
): ChildEdgePath => {
  const a = ctx.boxes[edge.from];
  const b = ctx.boxes[edge.to];
  if (!(a && b)) {
    throw new Error(`Child edge ${childEdgeKey(edge)} uses an unknown node`);
  }
  const route = ctx.back
    ? backEdge(a, b, ctx.options)
    : forwardEdge(edge, a, b, ctx);
  const path: ChildEdgePath = {
    index,
    key: childEdgeKey(edge),
    from: edge.from,
    to: edge.to,
    back: ctx.back,
    style: edgeStyle(edge, ctx.back, ctx.marks),
    d: route.d,
  };
  if (edge.label) {
    path.label = { ...route.label, text: edge.label };
  }
  return path;
};

type Bounds = { minX: number; maxX: number; maxY: number };

const extend = (bounds: Bounds, rect: Rect): Bounds => ({
  minX: Math.min(bounds.minX, rect.x),
  maxX: Math.max(bounds.maxX, rect.x + rect.w),
  maxY: Math.max(bounds.maxY, rect.y + rect.h),
});

export const layoutChildren = (
  graph: ChildGraph,
  sizes: ChildSizes,
  overrides: Partial<ChildOptions> = {}
): ChildLayout => {
  const options: ChildOptions = { ...defaultChildOptions, ...overrides };
  const { ranks, back } = rankChildren(graph);
  const rowHeight = Math.max(
    0,
    ...graph.nodes.map((node) => sizeOf(sizes, node.id).h)
  );
  const rows = groupRows(graph.nodes, ranks);
  const placed = placeRows(rows, { sizes, options, rowHeight });
  const ctx: EdgeContext = {
    boxes: placed.boxes,
    pairs: new Set(graph.edges.map(childEdgeKey)),
    marks: new Map(graph.nodes.map((node) => [node.id, node.mark])),
    options,
  };
  const route = (boxes: Record<string, Box>): ChildEdgePath[] =>
    graph.edges.map((edge, index) =>
      routeChildEdge(edge, index, { ...ctx, boxes, back: back.has(index) })
    );
  let edges = route(placed.boxes);
  let bounds: Bounds = { minX: 0, maxX: placed.width, maxY: 0 };
  for (const box of Object.values(placed.boxes)) {
    bounds = extend(bounds, box);
  }
  for (const edge of edges) {
    if (edge.label) {
      bounds = extend(bounds, labelBox(edge.label, sizes.labels?.[edge.key]));
    }
  }
  const dx = bounds.minX < 0 ? Math.ceil(-bounds.minX) + 4 : 0;
  const nodes: ChildLayout["nodes"] = {};
  for (const [id, box] of Object.entries(placed.boxes)) {
    nodes[id] = { ...box, x: round(box.x + dx), y: round(box.y) };
  }
  if (dx > 0) {
    edges = route(nodes);
  }
  return {
    width: round(bounds.maxX + dx),
    height: round(bounds.maxY + options.padBottom),
    nodes,
    edges: edges.map((edge) =>
      edge.label
        ? {
            ...edge,
            label: {
              ...edge.label,
              x: round(edge.label.x),
              y: round(edge.label.y),
            },
          }
        : edge
    ),
  };
};

export const labelPosition = (
  label: ChildLabel,
  size: Size
): { left: number; top: number } => {
  const box = labelBox(label, size);
  return { left: round(box.x), top: round(box.y) };
};
