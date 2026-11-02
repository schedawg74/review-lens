import type { Lens, LensEdge, LensNode } from "@review-lens/schema";
import { curvePath, linePath, orthPath, round } from "./path";
import type {
  CardBox,
  EdgePath,
  LaneBox,
  MapLayout,
  MapOptions,
  MapSizes,
  Pill,
  Point,
  Side,
  Size,
} from "./types";

export const defaultMapOptions: MapOptions = {
  laneGap: 44,
  lanePad: 16,
  laneHead: 40,
  rowGap: 30,
  stackGap: 14,
  portY: 24,
  portStep: 14,
  portSpread: 16,
  minLaneWidth: 170,
  bottomPad: 6,
  cornerRadius: 8,
};

type MapGraph = Pick<Lens, "lanes" | "nodes" | "edges">;

const sizeOf = (sizes: MapSizes, id: string): Size => {
  const size = sizes.nodes[id];
  if (!size) {
    throw new Error(`No size for node "${id}"`);
  }
  return size;
};

const laneIndexOf = (graph: MapGraph): Map<string, number> =>
  new Map(graph.lanes.map((lane, index) => [lane.id, index]));

const laneOf = (lanes: Map<string, number>, node: LensNode): number => {
  const index = lanes.get(node.lane);
  if (index === undefined) {
    throw new Error(`Node "${node.id}" uses unknown lane "${node.lane}"`);
  }
  return index;
};

const nodeMap = (graph: MapGraph): Map<string, LensNode> =>
  new Map(graph.nodes.map((node) => [node.id, node]));

const cycleEdges = (graph: MapGraph): Set<LensEdge> => {
  const out = new Map<string, LensEdge[]>();
  for (const edge of graph.edges) {
    if (edge.kind !== "moved") {
      out.set(edge.from, [...(out.get(edge.from) ?? []), edge]);
    }
  }
  const back = new Set<LensEdge>();
  const done = new Set<string>();
  const onStack = new Set<string>();
  const visit = (id: string): void => {
    onStack.add(id);
    for (const edge of out.get(id) ?? []) {
      if (onStack.has(edge.to)) {
        back.add(edge);
      } else if (!done.has(edge.to)) {
        visit(edge.to);
      }
    }
    onStack.delete(id);
    done.add(id);
  };
  for (const node of graph.nodes) {
    if (!done.has(node.id)) {
      visit(node.id);
    }
  }
  return back;
};

const incomingEdges = (graph: MapGraph): Map<string, LensEdge[]> => {
  const back = cycleEdges(graph);
  const incoming = new Map<string, LensEdge[]>();
  for (const edge of graph.edges) {
    if (edge.kind === "moved" || back.has(edge)) {
      continue;
    }
    const list = incoming.get(edge.to) ?? [];
    list.push(edge);
    incoming.set(edge.to, list);
  }
  return incoming;
};

const previousInLane = (
  graph: MapGraph,
  index: number
): LensNode | undefined => {
  const node = graph.nodes[index];
  for (let i = index - 1; i >= 0; i--) {
    const candidate = graph.nodes[i];
    if (candidate && candidate.lane === node?.lane) {
      return candidate;
    }
  }
  return;
};

type RankContext = {
  graph: MapGraph;
  lanes: Map<string, number>;
  nodes: Map<string, LensNode>;
  incoming: Map<string, LensEdge[]>;
  ranks: Record<string, number>;
};

const rankFromEdges = (
  ctx: RankContext,
  node: LensNode,
  start: number
): number => {
  let rank = start;
  const lane = laneOf(ctx.lanes, node);
  for (const edge of ctx.incoming.get(node.id) ?? []) {
    const from = ctx.nodes.get(edge.from);
    if (!from) {
      continue;
    }
    const step = laneOf(ctx.lanes, from) >= lane ? 1 : 0;
    rank = Math.max(rank, (ctx.ranks[from.id] ?? 0) + step);
  }
  return rank;
};

const relaxRank = (ctx: RankContext, index: number): boolean => {
  const node = ctx.graph.nodes[index];
  if (!node) {
    return false;
  }
  const current = ctx.ranks[node.id] ?? 0;
  let rank = current;
  if (!ctx.incoming.has(node.id)) {
    const previous = previousInLane(ctx.graph, index);
    if (previous) {
      rank = Math.max(rank, ctx.ranks[previous.id] ?? 0);
    }
  }
  rank = rankFromEdges(ctx, node, rank);
  ctx.ranks[node.id] = rank;
  return rank !== current;
};

export const rankNodes = (graph: MapGraph): Record<string, number> => {
  const ctx: RankContext = {
    graph,
    lanes: laneIndexOf(graph),
    nodes: nodeMap(graph),
    incoming: incomingEdges(graph),
    ranks: Object.fromEntries(graph.nodes.map((node) => [node.id, 0])),
  };
  const limit = graph.nodes.length + 1;
  for (let pass = 0; pass < limit; pass++) {
    let changed = false;
    for (let i = 0; i < graph.nodes.length; i++) {
      changed = relaxRank(ctx, i) || changed;
    }
    if (!changed) {
      break;
    }
  }
  return ctx.ranks;
};

export const laneWidths = (
  graph: MapGraph,
  sizes: MapSizes,
  minLaneWidth: number
): number[] =>
  graph.lanes.map((lane) =>
    Math.max(
      minLaneWidth,
      ...graph.nodes
        .filter((node) => node.lane === lane.id)
        .map((node) => sizeOf(sizes, node.id).w)
    )
  );

const cardWidth = (node: LensNode, size: Size, laneWidth: number): number =>
  node.expanded && node.children ? size.w : laneWidth;

export const cardWidths = (
  graph: MapGraph,
  sizes: MapSizes,
  overrides: Partial<MapOptions> = {}
): Record<string, number> => {
  const options: MapOptions = { ...defaultMapOptions, ...overrides };
  const lanes = laneIndexOf(graph);
  const widths = laneWidths(graph, sizes, options.minLaneWidth);
  return Object.fromEntries(
    graph.nodes.map((node) => [
      node.id,
      cardWidth(node, sizeOf(sizes, node.id), widths[laneOf(lanes, node)] ?? 0),
    ])
  );
};

type Grid = {
  rowY: number[];
  height: number;
  cells: Map<string, string[]>;
};

const cellKey = (lane: number, row: number): string => `${lane}:${row}`;

const buildGrid = (
  graph: MapGraph,
  ctx: {
    sizes: MapSizes;
    ranks: Record<string, number>;
    lanes: Map<string, number>;
    options: MapOptions;
  }
): Grid => {
  const cells = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const key = cellKey(laneOf(ctx.lanes, node), ctx.ranks[node.id] ?? 0);
    const list = cells.get(key) ?? [];
    list.push(node.id);
    cells.set(key, list);
  }
  const maxRank = Math.max(0, ...Object.values(ctx.ranks));
  const rowY: number[] = [];
  let y = ctx.options.laneHead;
  for (let row = 0; row <= maxRank; row++) {
    let rowHeight = 0;
    for (let lane = 0; lane < graph.lanes.length; lane++) {
      const ids = cells.get(cellKey(lane, row)) ?? [];
      const stack =
        ids.reduce((sum, id) => sum + sizeOf(ctx.sizes, id).h, 0) +
        ctx.options.stackGap * Math.max(0, ids.length - 1);
      rowHeight = Math.max(rowHeight, stack);
    }
    rowY.push(y);
    y += rowHeight + ctx.options.rowGap;
  }
  return { rowY, height: y + ctx.options.bottomPad, cells };
};

type Placed = {
  cards: Record<string, CardBox>;
  lanes: LaneBox[];
  laneX: number[];
  width: number;
  height: number;
};

const placeCards = (
  graph: MapGraph,
  ctx: { sizes: MapSizes; grid: Grid; widths: number[]; options: MapOptions }
): Placed => {
  const { options, widths, grid } = ctx;
  const laneX: number[] = [];
  let x = 0;
  for (const width of widths) {
    laneX.push(x);
    x += width + options.lanePad * 2 + options.laneGap;
  }
  const cards: Record<string, CardBox> = {};
  for (const [key, ids] of grid.cells) {
    const [lane = 0, row = 0] = key.split(":").map(Number);
    let y = grid.rowY[row] ?? 0;
    for (const id of ids) {
      const size = sizeOf(ctx.sizes, id);
      const w = size.w;
      const left =
        (laneX[lane] ?? 0) + options.lanePad + ((widths[lane] ?? 0) - w) / 2;
      cards[id] = { id, x: left, y, w, h: size.h, lane, row };
      y += size.h + options.stackGap;
    }
  }
  const lanes: LaneBox[] = graph.lanes.map((lane, index) => ({
    id: lane.id,
    title: lane.title,
    index,
    x: laneX[index] ?? 0,
    y: 0,
    w: (widths[index] ?? 0) + options.lanePad * 2,
    h: grid.height,
  }));
  return {
    cards,
    lanes,
    laneX,
    width: x - options.laneGap,
    height: grid.height,
  };
};

const boxOf = (cards: Record<string, CardBox>, id: string): CardBox => {
  const box = cards[id];
  if (!box) {
    throw new Error(`Edge uses unknown node "${id}"`);
  }
  return box;
};

const hasCardBetween = (
  cards: Record<string, CardBox>,
  a: CardBox,
  b: CardBox
): boolean =>
  Object.values(cards).some(
    (box) =>
      box.id !== a.id &&
      box.id !== b.id &&
      box.lane === a.lane &&
      box.y > a.y &&
      box.y < b.y
  );

const sidesOf = (
  edge: LensEdge,
  cards: Record<string, CardBox>
): [Side, Side] => {
  const a = boxOf(cards, edge.from);
  const b = boxOf(cards, edge.to);
  if (edge.kind === "moved") {
    return a.lane <= b.lane ? ["right", "left"] : ["left", "right"];
  }
  if (a.lane === b.lane) {
    const below = b.y > a.y;
    return below && !hasCardBetween(cards, a, b)
      ? ["bottom", "top"]
      : ["left", "left"];
  }
  return a.lane < b.lane ? ["right", "left"] : ["left", "right"];
};

type PortRequest = {
  edge: number;
  end: "from" | "to";
  side: Side;
  other: CardBox;
};

const portPoint = (
  box: CardBox,
  request: PortRequest,
  slot: { i: number; n: number },
  options: MapOptions
): Point => {
  if (request.side === "left" || request.side === "right") {
    const y =
      box.y + Math.min(box.h - 10, options.portY + slot.i * options.portStep);
    return [request.side === "right" ? box.x + box.w : box.x, y];
  }
  const x =
    box.x + box.w / 2 + (slot.i - (slot.n - 1) / 2) * options.portSpread;
  return [x, request.side === "bottom" ? box.y + box.h : box.y];
};

const comparePorts = (p: PortRequest, q: PortRequest): number => {
  const vertical = p.side === "left" || p.side === "right";
  const primary = vertical ? p.other.y - q.other.y : p.other.x - q.other.x;
  if (primary !== 0) {
    return primary;
  }
  const secondary = vertical ? p.other.x - q.other.x : p.other.y - q.other.y;
  return secondary === 0 ? p.edge - q.edge : secondary;
};

export const assignPorts = (
  graph: MapGraph,
  cards: Record<string, CardBox>,
  options: MapOptions = defaultMapOptions
): { sides: [Side, Side][]; points: [Point, Point][] } => {
  const sides = graph.edges.map((edge) => sidesOf(edge, cards));
  const groups = new Map<string, PortRequest[]>();
  graph.edges.forEach((edge, index) => {
    const [source, target] = sides[index] ?? ["right", "left"];
    const requests: PortRequest[] = [
      { edge: index, end: "from", side: source, other: boxOf(cards, edge.to) },
      { edge: index, end: "to", side: target, other: boxOf(cards, edge.from) },
    ];
    for (const request of requests) {
      const id = request.end === "from" ? edge.from : edge.to;
      const key = `${id}\u0000${request.side}`;
      const list = groups.get(key) ?? [];
      list.push(request);
      groups.set(key, list);
    }
  });
  const points: [Point, Point][] = graph.edges.map(() => [
    [0, 0],
    [0, 0],
  ]);
  for (const list of groups.values()) {
    list.sort(comparePorts);
    list.forEach((request, i) => {
      const edge = graph.edges[request.edge];
      const pair = points[request.edge];
      if (!(edge && pair)) {
        return;
      }
      const box = boxOf(cards, request.end === "from" ? edge.from : edge.to);
      const point = portPoint(box, request, { i, n: list.length }, options);
      pair[request.end === "from" ? 0 : 1] = point;
    });
  }
  return { sides, points };
};

type RouteContext = {
  cards: Record<string, CardBox>;
  laneX: number[];
  laneW: number[];
  options: MapOptions;
  gutter: Map<string, number>;
};

const gutterX = (ctx: RouteContext, edge: LensEdge, lane: number): number => {
  const used = ctx.gutter.get(`${lane}`) ?? 0;
  const key = `${edge.from}>${edge.to}`;
  const slot = ctx.gutter.get(key) ?? used;
  if (!ctx.gutter.has(key)) {
    ctx.gutter.set(key, slot);
    ctx.gutter.set(`${lane}`, used + 1);
  }
  return (ctx.laneX[lane] ?? 0) + 6 + slot * 5;
};

const bendX = (ctx: RouteContext, source: Side, target: CardBox): number => {
  const half = ctx.options.laneGap / 2;
  const left = ctx.laneX[target.lane] ?? 0;
  if (source === "right") {
    return left - half;
  }
  return left + (ctx.laneW[target.lane] ?? 0) + ctx.options.lanePad * 2 + half;
};

const routeEdge = (
  edge: LensEdge,
  ends: { sides: [Side, Side]; points: [Point, Point] },
  ctx: RouteContext
): string => {
  const [start, end] = ends.points;
  const [source, target] = ends.sides;
  const r = ctx.options.cornerRadius;
  if (edge.kind === "moved") {
    return curvePath(start, end);
  }
  if (source === "bottom") {
    if (Math.abs(start[0] - end[0]) < 2) {
      return linePath(start, end);
    }
    const midY = (start[1] + end[1]) / 2;
    return orthPath([start, [start[0], midY], [end[0], midY], end], r);
  }
  if (source === "left" && target === "left") {
    const gx = gutterX(ctx, edge, boxOf(ctx.cards, edge.from).lane);
    return orthPath([start, [gx, start[1]], [gx, end[1]], end], r);
  }
  if (Math.abs(start[1] - end[1]) < 2) {
    return linePath(start, end);
  }
  const gx = bendX(ctx, source, boxOf(ctx.cards, edge.to));
  return orthPath([start, [gx, start[1]], [gx, end[1]], end], r);
};

export const layoutMap = (
  graph: MapGraph,
  sizes: MapSizes,
  overrides: Partial<MapOptions> = {}
): MapLayout => {
  const options: MapOptions = { ...defaultMapOptions, ...overrides };
  const lanes = laneIndexOf(graph);
  const ranks = rankNodes(graph);
  const widths = laneWidths(graph, sizes, options.minLaneWidth);
  const grid = buildGrid(graph, { sizes, ranks, lanes, options });
  const placed = placeCards(graph, { sizes, grid, widths, options });
  const ports = assignPorts(graph, placed.cards, options);
  const ctx: RouteContext = {
    cards: placed.cards,
    laneX: placed.laneX,
    laneW: widths,
    options,
    gutter: new Map(),
  };
  const edges: EdgePath[] = [];
  const pills: Pill[] = [];
  graph.edges.forEach((edge, index) => {
    const sides = ports.sides[index] ?? ["right", "left"];
    const points = ports.points[index] ?? [
      [0, 0],
      [0, 0],
    ];
    const d = routeEdge(edge, { sides, points }, ctx);
    edges.push({
      index,
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      source: sides[0],
      target: sides[1],
      start: points[0],
      end: points[1],
      d,
    });
    if (edge.kind === "moved" && edge.label) {
      pills.push({
        x: round((points[0][0] + points[1][0]) / 2),
        y: round((points[0][1] + points[1][1]) / 2),
        text: edge.label,
        edge: index,
      });
    }
  });
  return {
    width: placed.width,
    height: placed.height,
    laneWidths: widths,
    lanes: placed.lanes,
    cards: placed.cards,
    edges,
    pills,
    ranks,
  };
};
