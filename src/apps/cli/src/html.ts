import type { Lens } from "@review-lens/schema";

export const LENS_PLACEHOLDER =
  '<script id="lens" type="application/json">__LENS_JSON__</script>';

export const embedJson = (value: unknown): string =>
  JSON.stringify(value)
    .replaceAll("</", "<\\/")
    .replaceAll("<!--", "\\u003c!--");

export const fillTemplate = (template: string, lens: Lens): string => {
  const parts = template.split(LENS_PLACEHOLDER);
  if (parts.length !== 2) {
    throw new Error(
      "The viewer template must contain the lens placeholder once"
    );
  }
  return parts.join(
    `<script id="lens" type="application/json">${embedJson(lens)}</script>`
  );
};
