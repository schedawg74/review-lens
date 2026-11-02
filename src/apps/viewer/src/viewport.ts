import type { ViewState } from "./model";

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

export type Viewport = {
  fit: () => void;
  apply: () => void;
  zoom: (factor: number) => void;
};

export const createViewport = (
  vp: HTMLElement,
  stage: HTMLElement,
  ctx: { state: ViewState; onBackgroundClick: () => void }
): Viewport => {
  const { state } = ctx;
  const apply = (): void => {
    stage.style.transform = `translate(${state.tx}px,${state.ty}px) scale(${state.scale})`;
  };
  const fit = (): void => {
    if (!(state.width && state.height)) {
      return;
    }
    const w = vp.clientWidth - 24;
    const h = vp.clientHeight - 40;
    state.scale = Math.min(1, w / state.width, h / state.height);
    state.tx = (vp.clientWidth - state.width * state.scale) / 2;
    state.ty = 12;
    apply();
  };
  const zoomAt = (factor: number, cx: number, cy: number): void => {
    const scale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, state.scale * factor)
    );
    state.tx = cx - ((cx - state.tx) * scale) / state.scale;
    state.ty = cy - ((cy - state.ty) * scale) / state.scale;
    state.scale = scale;
    apply();
  };
  vp.addEventListener(
    "wheel",
    (event) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      event.preventDefault();
      const rect = vp.getBoundingClientRect();
      zoomAt(
        Math.exp(-event.deltaY / 300),
        event.clientX - rect.left,
        event.clientY - rect.top
      );
    },
    { passive: false }
  );
  let drag: {
    x: number;
    y: number;
    tx: number;
    ty: number;
    moved: boolean;
  } | null = null;
  vp.addEventListener("pointerdown", (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest(".card,.legend")
    ) {
      return;
    }
    drag = {
      x: event.clientX,
      y: event.clientY,
      tx: state.tx,
      ty: state.ty,
      moved: false,
    };
    vp.classList.add("drag");
  });
  window.addEventListener("pointermove", (event) => {
    if (!drag) {
      return;
    }
    state.tx = drag.tx + event.clientX - drag.x;
    state.ty = drag.ty + event.clientY - drag.y;
    drag.moved ||=
      Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 3;
    apply();
  });
  window.addEventListener("pointerup", () => {
    if (drag && !drag.moved) {
      ctx.onBackgroundClick();
    }
    drag = null;
    vp.classList.remove("drag");
  });
  return {
    fit,
    apply,
    zoom: (factor) => zoomAt(factor, vp.clientWidth / 2, vp.clientHeight / 2),
  };
};
