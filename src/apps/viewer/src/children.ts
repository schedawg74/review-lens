import {
  childEdgeKey,
  labelPosition,
  layoutChildren,
} from "@review-lens/layout";
import type { Children, Mark } from "@review-lens/schema";
import { h, measure, place } from "./dom";
import { edgeLayer, edgePath } from "./edges";

const MARK_LABEL: Record<Mark, string> = {
  breaks: "breaks",
  mayBreak: "may break",
  bugPath: "bug path",
};

const stateElement = (child: Children["nodes"][number]): HTMLElement => {
  const tag = child.mark
    ? h("span", { class: "mk" }, MARK_LABEL[child.mark])
    : null;
  const classes = ["st", `t-${child.tone}`, child.mark ? `m-${child.mark}` : ""]
    .filter(Boolean)
    .join(" ");
  return h(
    "div",
    { class: classes, "data-child": child.id },
    h("span", {}, child.title),
    tag
  );
};

export const renderChildren = (host: HTMLElement, graph: Children): void => {
  host.replaceChildren();
  const states = new Map<string, HTMLElement>();
  for (const child of graph.nodes) {
    const el = stateElement(child);
    host.append(el);
    states.set(child.id, el);
  }
  const labels = new Map<string, HTMLElement>();
  for (const edge of graph.edges) {
    if (!edge.label) {
      continue;
    }
    const el = h("div", { class: "el" }, edge.label);
    host.append(el);
    labels.set(childEdgeKey(edge), el);
  }
  const out = layoutChildren(graph, {
    nodes: Object.fromEntries([...states].map(([id, el]) => [id, measure(el)])),
    labels: Object.fromEntries(
      [...labels].map(([key, el]) => [key, measure(el)])
    ),
  });
  for (const [id, el] of states) {
    const box = out.nodes[id];
    if (box) {
      place(el, { x: box.x, y: box.y, w: box.w });
    }
  }
  const layer = edgeLayer(out.width, out.height);
  for (const edge of out.edges) {
    layer.append(edgePath(edge.d, edge.style));
    const el = labels.get(edge.key);
    if (el && edge.label) {
      const position = labelPosition(edge.label, measure(el));
      el.classList.add(`a-${edge.label.align}`);
      place(el, { x: position.left, y: position.top });
    }
  }
  host.prepend(layer);
  host.style.width = `${out.width}px`;
  host.style.height = `${out.height}px`;
};
