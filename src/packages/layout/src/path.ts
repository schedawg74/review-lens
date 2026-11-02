import type { Point } from "./types";

export const round = (value: number): number => Math.round(value * 10) / 10;

const pt = (x: number, y: number): string => `${round(x)},${round(y)}`;

const at = (points: readonly Point[], index: number): Point => {
  const point = points[index];
  if (!point) {
    throw new Error(`Path point ${index} is missing`);
  }
  return point;
};

export const linePath = (from: Point, to: Point): string =>
  `M${pt(from[0], from[1])} L${pt(to[0], to[1])}`;

export const orthPath = (points: readonly Point[], radius = 8): string => {
  const first = at(points, 0);
  const parts = [`M${pt(first[0], first[1])}`];
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = at(points, i - 1);
    const [x, y] = at(points, i);
    const [nx, ny] = at(points, i + 1);
    const r = Math.min(
      radius,
      Math.hypot(x - px, y - py) / 2,
      Math.hypot(nx - x, ny - y) / 2
    );
    const ax = x - Math.sign(x - px) * r;
    const ay = y - Math.sign(y - py) * r;
    const bx = x + Math.sign(nx - x) * r;
    const by = y + Math.sign(ny - y) * r;
    parts.push(`L${pt(ax, ay)} Q${pt(x, y)} ${pt(bx, by)}`);
  }
  const last = at(points, points.length - 1);
  parts.push(`L${pt(last[0], last[1])}`);
  return parts.join(" ");
};

export const curvePath = (from: Point, to: Point): string => {
  const c = Math.max(80, (to[0] - from[0]) * 0.45);
  return `M${pt(from[0], from[1])} C${pt(from[0] + c, from[1])} ${pt(to[0] - c, to[1])} ${pt(to[0], to[1])}`;
};
