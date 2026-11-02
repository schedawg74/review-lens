import { byId, h } from "./dom";
import { renderHeader } from "./header";
import { renderMap } from "./map";
import { buildModel, initialState, type Model, type ViewState } from "./model";
import { normalizeLens } from "./normalize";
import { renderSidebar } from "./sidebar";
import { createViewport, type Viewport } from "./viewport";

const NARROW = 860;

const readLens = (): ReturnType<typeof normalizeLens> => {
  try {
    return normalizeLens(JSON.parse(byId("lens").textContent ?? ""));
  } catch {
    return null;
  }
};

const showError = (message: string): void => {
  byId("stage").replaceChildren(h("div", { class: "err" }, message));
};

const start = (model: Model): void => {
  const state: ViewState = initialState(model.lens);
  const app = byId("app");
  const stage = byId("stage");
  const side = byId("side");
  let viewport: Viewport | null = null;

  const paint = (): void => {
    for (const el of stage.querySelectorAll<HTMLElement>(
      "[data-id],[data-child]"
    )) {
      const id = el.dataset.id ?? el.dataset.child ?? "";
      el.classList.toggle("sel", state.selected === id);
      el.classList.toggle(
        "hl",
        state.highlight.includes(id) && state.selected !== id
      );
    }
  };
  const highlight = (ids: string[]): void => {
    state.highlight = ids;
    paint();
  };
  const select = (id: string | null): void => {
    state.selected = id;
    state.highlight = [];
    paint();
    renderSidebar(side, model, id, { back: () => select(null), highlight });
    if (id) {
      app.classList.add("open");
    }
  };
  const layout = (): void => {
    const out = renderMap(stage, model.lens, state.expanded);
    state.width = out.width;
    state.height = out.height;
    paint();
    if (state.fitted) {
      viewport?.apply();
      return;
    }
    viewport?.fit();
    state.fitted = true;
  };
  const toggle = (id: string): void => {
    if (state.expanded.has(id)) {
      state.expanded.delete(id);
    } else {
      state.expanded.add(id);
    }
    layout();
  };

  viewport = createViewport(byId("vp"), stage, {
    state,
    onBackgroundClick: () => {
      if (state.selected) {
        select(null);
      }
    },
  });
  stage.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const chip = event.target.closest<HTMLElement>("[data-exp]");
    if (chip?.dataset.exp) {
      toggle(chip.dataset.exp);
      return;
    }
    const target = event.target.closest<HTMLElement>("[data-child],[data-id]");
    const id = target?.dataset.child ?? target?.dataset.id;
    if (id && model.nodes.get(id)?.kind !== "note") {
      select(id);
    }
  });
  byId("zin").addEventListener("click", () => viewport?.zoom(1.2));
  byId("zout").addEventListener("click", () => viewport?.zoom(1 / 1.2));
  byId("zfit").addEventListener("click", () => viewport?.fit());
  byId("toggle").addEventListener("click", () => app.classList.toggle("open"));

  if (window.innerWidth >= NARROW) {
    app.classList.add("open");
  }
  renderHeader(byId("head"), model.lens);
  layout();
  select(null);
  new ResizeObserver(() => viewport?.fit()).observe(byId("vp"));
  Reflect.set(window, "__lens", { select, toggle, layout, state });
};

const lens = readLens();
if (lens) {
  start(buildModel(lens));
} else {
  showError(
    "No lens data. Build the page with review-lens html, which checks the JSON first."
  );
}
