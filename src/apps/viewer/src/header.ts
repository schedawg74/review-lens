import type { Lens, TriageKind } from "@review-lens/schema";
import { h } from "./dom";
import { shortSha } from "./format";

const TRIAGE_COLOR: Record<TriageKind, string> = {
  logic: "var(--fg)",
  tests: "var(--mute)",
  generated: "var(--bd)",
  prompts: "var(--soft-2)",
  docs: "var(--bd)",
  config: "var(--soft-2)",
};

export const renderHeader = (host: HTMLElement, lens: Lens): void => {
  const { triage, pr } = lens;
  const tip = triage.classes
    .map((item) => `${item.label}: ${item.files}`)
    .join("\n");
  const logic = triage.classes
    .filter((item) => item.kind === "logic")
    .reduce((sum, item) => sum + item.files, 0);
  const bar = h("span", { class: "tri", title: tip });
  for (const item of triage.classes) {
    const segment = h("i");
    segment.style.width = `${triage.files ? (item.files / triage.files) * 100 : 0}%`;
    segment.style.background = TRIAGE_COLOR[item.kind];
    bar.append(segment);
  }
  host.replaceChildren(
    h("span", { class: "t" }, h("b", {}, `#${pr.number}`), ` ${pr.title}`),
    h(
      "span",
      { class: "meta" },
      bar,
      h(
        "span",
        { title: tip },
        h("b", {}, String(logic)),
        ` of ${triage.files} files hold logic`
      ),
      h("span", {}, `· ${shortSha(pr.head)}`)
    )
  );
};
