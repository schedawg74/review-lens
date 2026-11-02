export type Attrs = Record<string, string | number | boolean | undefined>;
export type Child = Node | string | null | undefined | false;

const SVG_NS = "http://www.w3.org/2000/svg";

const setAttrs = (el: Element, attrs: Attrs): void => {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) {
      continue;
    }
    el.setAttribute(key, value === true ? "" : String(value));
  }
};

const append = (el: Element, children: Child[]): void => {
  for (const child of children) {
    if (child === null || child === undefined || child === false) {
      continue;
    }
    el.append(child);
  }
};

export const h = (
  tag: string,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElement => {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
};

export const svg = (
  tag: string,
  attrs: Attrs = {},
  ...children: Child[]
): SVGElement => {
  const el = document.createElementNS(SVG_NS, tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
};

export const byId = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Element #${id} is missing`);
  }
  return el;
};

export const place = (
  el: HTMLElement,
  box: { x: number; y: number; w?: number; h?: number }
): void => {
  el.style.left = `${box.x}px`;
  el.style.top = `${box.y}px`;
  if (box.w !== undefined) {
    el.style.width = `${box.w}px`;
  }
  if (box.h !== undefined) {
    el.style.height = `${box.h}px`;
  }
};

export const measure = (el: HTMLElement): { w: number; h: number } => {
  const rect = el.getBoundingClientRect();
  return { w: Math.ceil(rect.width), h: Math.ceil(rect.height) };
};
