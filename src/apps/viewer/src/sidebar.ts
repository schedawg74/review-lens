import type { Anchor, Decision, FileChange, Lens } from "@review-lens/schema";
import { h } from "./dom";
import { diffUrl, filesUrl, pathTail, shortSha, statusLabel } from "./format";
import type { Model } from "./model";

export type SidebarActions = {
  back: () => void;
  highlight: (ids: string[]) => void;
};

const MARK_TEXT = {
  breaks: "breaks a rule",
  mayBreak: "may break a rule",
  bugPath: "on the bug path",
} as const;

const link = (href: string, text: string, title?: string): HTMLElement =>
  h("a", { href, target: "_blank", rel: "noreferrer", title }, text);

const fileItem = (lens: Lens, file: FileChange): HTMLElement =>
  h(
    "div",
    { class: "item" },
    link(diffUrl(lens.pr, file.path), pathTail(file.path), file.path),
    h(
      "span",
      { class: "n" },
      h("span", { class: "add" }, `+${file.add}`),
      file.del ? h("span", { class: "del" }, ` −${file.del}`) : null
    )
  );

const anchorItem = (lens: Lens, anchor: Anchor): HTMLElement =>
  h(
    "div",
    { class: "item" },
    link(
      diffUrl(lens.pr, anchor.path, anchor.line),
      anchor.name,
      `${anchor.path}:${anchor.line}`
    ),
    h("span", { class: "n" }, `:${anchor.line}`)
  );

const section = (title: string, items: HTMLElement[]): HTMLElement[] =>
  items.length
    ? [h("h3", {}, title), h("div", { class: "list" }, ...items)]
    : [];

const decisionItem = (
  lens: Lens,
  decision: Decision,
  actions: SidebarActions
): HTMLElement => {
  const anchor =
    decision.path === undefined
      ? null
      : link(
          diffUrl(lens.pr, decision.path, decision.line),
          `${pathTail(decision.path)}${decision.line ? `:${decision.line}` : ""}`,
          decision.path
        );
  const el = h(
    "div",
    { class: "dec", "data-d": decision.id },
    h("span", { class: "k" }, decision.kind),
    decision.text,
    anchor
  );
  el.addEventListener("mouseenter", () => actions.highlight(decision.nodes));
  el.addEventListener("mouseleave", () => actions.highlight([]));
  return el;
};

const decisions = (
  lens: Lens,
  list: Decision[],
  actions: SidebarActions
): HTMLElement[] =>
  list.length
    ? [
        h("h3", {}, "Decisions to check"),
        ...list.map((d) => decisionItem(lens, d, actions)),
      ]
    : [];

const overview = (model: Model, actions: SidebarActions): HTMLElement[] => {
  const { lens } = model;
  const { skill, role, model: by } = lens.generatedBy;
  return [
    h("h2", {}, lens.title),
    h("p", {}, lens.summary),
    ...decisions(lens, lens.decisions, actions),
    h(
      "div",
      { class: "prov" },
      `Written by the ${skill} skill (${role}, ${by}) at ${shortSha(lens.pr.head)}. Layout is computed; the model gives no coordinates. `,
      link(filesUrl(lens.pr), "Open the PR files")
    ),
  ];
};

const detail = (
  model: Model,
  id: string,
  actions: SidebarActions
): HTMLElement[] | null => {
  const { lens } = model;
  const node = model.nodes.get(id);
  const entry = model.children.get(id);
  const item = node ?? entry?.child;
  if (!item) {
    return null;
  }
  const status = node?.status ?? entry?.parent.status ?? "context";
  const back = h(
    "button",
    { class: "back", type: "button" },
    `← ${entry ? entry.parent.title : lens.title}`
  );
  back.addEventListener("click", actions.back);
  const mark = entry?.child.mark;
  return [
    back,
    h(
      "h2",
      {},
      item.title,
      h("span", { class: `chip ${status}` }, statusLabel(status))
    ),
    mark
      ? h("p", { class: `mark m-${mark}` }, `This state ${MARK_TEXT[mark]}.`)
      : null,
    h("p", {}, item.summary ?? node?.text ?? ""),
    ...section(
      "Files",
      (node?.files ?? []).map((file) => fileItem(lens, file))
    ),
    ...section(
      "Inside",
      (item.inside ?? []).map((anchor) => anchorItem(lens, anchor))
    ),
    ...decisions(
      lens,
      lens.decisions.filter((decision) => decision.nodes.includes(id)),
      actions
    ),
  ].filter((el): el is HTMLElement => el !== null);
};

export const renderSidebar = (
  host: HTMLElement,
  model: Model,
  selected: string | null,
  actions: SidebarActions
): void => {
  const content =
    (selected && detail(model, selected, actions)) || overview(model, actions);
  host.replaceChildren(...content);
  host.scrollTop = 0;
};
