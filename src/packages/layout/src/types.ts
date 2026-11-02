import type { EdgeKind } from "@review-lens/schema";

export type Size = { w: number; h: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Point = readonly [number, number];
export type Side = "top" | "right" | "bottom" | "left";

export type MapSizes = {
  nodes: Readonly<Record<string, Size>>;
};

export type MapOptions = {
  laneGap: number;
  lanePad: number;
  laneHead: number;
  rowGap: number;
  stackGap: number;
  portY: number;
  portStep: number;
  portSpread: number;
  minLaneWidth: number;
  bottomPad: number;
  cornerRadius: number;
};

export type LaneBox = Rect & { id: string; title: string; index: number };

export type CardBox = Rect & { id: string; lane: number; row: number };

export type EdgePath = {
  index: number;
  from: string;
  to: string;
  kind: EdgeKind;
  source: Side;
  target: Side;
  start: Point;
  end: Point;
  d: string;
};

export type Pill = { x: number; y: number; text: string; edge: number };

export type MapLayout = {
  width: number;
  height: number;
  laneWidths: number[];
  lanes: LaneBox[];
  cards: Record<string, CardBox>;
  edges: EdgePath[];
  pills: Pill[];
  ranks: Record<string, number>;
};

export type ChildSizes = {
  nodes: Readonly<Record<string, Size>>;
  labels?: Readonly<Record<string, Size>>;
};

export type ChildOptions = {
  gapX: number;
  gapY: number;
  padTop: number;
  padBottom: number;
  minWidth: number;
  labelRoom: number;
  backOffset: number;
  pairOffset: number;
};

export type LabelAlign = "left" | "right" | "center";

export type ChildLabel = {
  text: string;
  x: number;
  y: number;
  align: LabelAlign;
};

export type ChildEdgeStyle = "flow" | "back" | "bug";

export type ChildEdgePath = {
  index: number;
  key: string;
  from: string;
  to: string;
  back: boolean;
  style: ChildEdgeStyle;
  d: string;
  label?: ChildLabel;
};

export type ChildLayout = {
  width: number;
  height: number;
  nodes: Record<string, Rect & { rank: number }>;
  edges: ChildEdgePath[];
};
