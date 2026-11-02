import {
  cardWidths,
  layoutMap,
  type MapLayout,
  type Size,
} from "@review-lens/layout";
import type { Lens } from "@review-lens/schema";
import { cardElement, renderOpenChildren } from "./cards";
import { h, measure, place } from "./dom";
import { edgeLayer, edgePath } from "./edges";

const sizesOf = (cards: Map<string, HTMLElement>): Record<string, Size> =>
  Object.fromEntries([...cards].map(([id, el]) => [id, measure(el)]));

const mountCards = (
  stage: HTMLElement,
  lens: Lens,
  expanded: ReadonlySet<string>
): Map<string, HTMLElement> => {
  const cards = new Map<string, HTMLElement>();
  for (const node of lens.nodes) {
    const open = expanded.has(node.id);
    const card = cardElement(node, open);
    stage.append(card);
    if (open) {
      renderOpenChildren(card, node);
    }
    cards.set(node.id, card);
  }
  return cards;
};

const graphOf = (lens: Lens, expanded: ReadonlySet<string>): Lens => ({
  ...lens,
  nodes: lens.nodes.map((node) => ({
    ...node,
    expanded: expanded.has(node.id),
  })),
});

const drawLanes = (stage: HTMLElement, out: MapLayout): void => {
  const lanes = out.lanes.map((lane) => {
    const el = h("div", { class: "lane" }, h("h4", {}, lane.title));
    place(el, lane);
    return el;
  });
  stage.prepend(...lanes);
};

const drawEdges = (
  stage: HTMLElement,
  out: MapLayout,
  firstCard: HTMLElement | undefined
): void => {
  const layer = edgeLayer(out.width, out.height);
  for (const edge of out.edges) {
    layer.append(edgePath(edge.d, edge.kind));
  }
  stage.insertBefore(layer, firstCard ?? null);
  for (const pill of out.pills) {
    const el = h("div", { class: "pill" }, pill.text);
    place(el, pill);
    stage.append(el);
  }
};

export const renderMap = (
  stage: HTMLElement,
  lens: Lens,
  expanded: ReadonlySet<string>
): MapLayout => {
  stage.replaceChildren();
  stage.style.transform = "none";
  const graph = graphOf(lens, expanded);
  const cards = mountCards(stage, graph, expanded);
  const widths = cardWidths(graph, { nodes: sizesOf(cards) });
  for (const [id, el] of cards) {
    const width = widths[id];
    if (width !== undefined) {
      el.style.width = `${width}px`;
    }
  }
  const out = layoutMap(graph, { nodes: sizesOf(cards) });
  for (const [id, el] of cards) {
    const box = out.cards[id];
    if (box) {
      place(el, { x: box.x, y: box.y });
    }
  }
  drawLanes(stage, out);
  drawEdges(stage, out, cards.values().next().value);
  stage.style.width = `${out.width}px`;
  stage.style.height = `${out.height}px`;
  return out;
};
