import type { LensNode } from "@review-lens/schema";
import { renderChildren } from "./children";
import { h } from "./dom";
import { fileLine } from "./format";

const chip = (node: LensNode, open: boolean): HTMLElement | null => {
  if (!node.children) {
    return null;
  }
  return h(
    "button",
    {
      class: "exp",
      type: "button",
      "data-exp": node.id,
      "aria-expanded": open ? "true" : "false",
    },
    `${open ? "▾" : "▸"} ${node.children.label}`
  );
};

const titleRow = (node: LensNode, open: boolean): HTMLElement[] => [
  h("div", { class: "ti" }, h("span", {}, node.title), chip(node, open)),
  ...(node.text ? [h("div", { class: "tx" }, node.text)] : []),
];

const footer = (node: LensNode): HTMLElement[] => {
  const line = fileLine(node.files);
  return [
    ...(line ? [h("div", { class: "fl" }, line)] : []),
    ...(node.note ? [h("div", { class: "nt" }, node.note)] : []),
  ];
};

export const cardElement = (node: LensNode, open: boolean): HTMLElement => {
  const expanded = open && Boolean(node.children);
  const classes = [
    "card",
    `s-${node.status}`,
    `k-${node.kind}`,
    expanded ? "open" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const card = h("div", { class: classes, "data-id": node.id });
  if (!(expanded && node.children)) {
    card.append(...titleRow(node, false), ...footer(node));
    return card;
  }
  const host = h("div", { class: "sub" });
  card.append(
    h("div", { class: "hd" }, ...titleRow(node, true)),
    h("div", { class: "bd" }, host, ...footer(node))
  );
  return card;
};

export const renderOpenChildren = (card: HTMLElement, node: LensNode): void => {
  const host = card.querySelector<HTMLElement>(".sub");
  if (host && node.children) {
    renderChildren(host, node.children);
  }
};
