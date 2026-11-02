import { svg } from "./dom";

export type EdgeStyle = "flow" | "removed" | "moved" | "back" | "bug";

const MARKER: Record<EdgeStyle, string> = {
  flow: "m-flow",
  removed: "m-removed",
  moved: "m-moved",
  back: "m-flow",
  bug: "m-bug",
};

export const edgePath = (d: string, style: EdgeStyle): SVGElement =>
  svg("path", {
    d,
    class: `e e-${style}`,
    "marker-end": `url(#${MARKER[style]})`,
  });

export const edgeLayer = (width: number, height: number): SVGElement =>
  svg("svg", { class: "edges", width, height, "aria-hidden": "true" });
