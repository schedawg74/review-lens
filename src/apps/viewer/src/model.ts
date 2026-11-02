import type { ChildNode, Lens, LensNode } from "@review-lens/schema";

export type ChildEntry = { child: ChildNode; parent: LensNode };

export type Model = {
  lens: Lens;
  nodes: Map<string, LensNode>;
  children: Map<string, ChildEntry>;
};

export type ViewState = {
  expanded: Set<string>;
  selected: string | null;
  highlight: string[];
  scale: number;
  tx: number;
  ty: number;
  width: number;
  height: number;
  fitted: boolean;
};

export const buildModel = (lens: Lens): Model => {
  const children = new Map<string, ChildEntry>();
  for (const parent of lens.nodes) {
    for (const child of parent.children?.nodes ?? []) {
      children.set(child.id, { child, parent });
    }
  }
  return {
    lens,
    nodes: new Map(lens.nodes.map((node) => [node.id, node])),
    children,
  };
};

export const initialState = (lens: Lens): ViewState => ({
  expanded: new Set(
    lens.nodes
      .filter((node) => node.expanded && node.children)
      .map((node) => node.id)
  ),
  selected: null,
  highlight: [],
  scale: 1,
  tx: 0,
  ty: 0,
  width: 0,
  height: 0,
  fitted: false,
});
