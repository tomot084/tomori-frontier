import "./style.css";
import { load, KEY, type Upgrade } from "./data";
import { GameModel, type Point } from "./simulation";
import { WorldView } from "./view3d";
import { MovementInput } from "./input";
import { GameUI, el } from "./ui";
import { Engine } from "@babylonjs/core/Engines/engine";
let saved: string | null = null;
try {
  saved = localStorage.getItem(KEY);
} catch {
  /* Gameplay remains available without browser storage. */
}
const model = new GameModel(load(saved));
const canvas = el("scene") as HTMLCanvasElement;
let view: WorldView;
if (!Engine.IsSupported) {
  el("loading").textContent =
    "このブラウザはWebGLを利用できません。対応ブラウザで開いてください。";
} else {
  try {
    view = new WorldView(canvas, model, el("world-ui"));
    boot();
  } catch (e) {
    el("loading").textContent =
      "島を読み込めませんでした。ブラウザを更新してお試しください。";
    throw e;
  }
}
function boot() {
  let started = false,
    debugInput: Point = { x: 0, y: 0 },
    last = performance.now(),
    uiAt = 0;
  const movement = new MovementInput(canvas, el("stick"));
  const ui = new GameUI(model, (u: Upgrade) => {
    if (model.purchase(u)) {
      persist();
      ui.update(started);
      view.syncSites();
    }
  });
  function persist() {
    model.s.x = model.player.x;
    model.s.y = model.player.y;
    try {
      localStorage.setItem(KEY, JSON.stringify(model.s));
      el("save-status").textContent = "保存しました";
    } catch {
      ui.toast("保存できません。ブラウザの空き容量を確認してください");
    }
  }
  function release() {
    movement.release();
    debugInput = { x: 0, y: 0 };
  }
  el("shop-toggle").addEventListener("click", release);
  el("shop-close").addEventListener("click", release);
  el("start").onclick = () => {
    el("intro").remove();
    started = true;
    movement.enabled = true;
    ui.toast("左下をドラッグして移動。採集と戦闘は自動！");
    ui.update(started);
  };
  el("settings").onclick = () => {
    release();
    (el("config") as HTMLDialogElement).showModal();
  };
  el("close").onclick = () => (el("config") as HTMLDialogElement).close();
  el("reset").onclick = () => {
    if (confirm("この島の進行をすべて消して、最初から始めますか？")) {
      localStorage.removeItem(KEY);
      location.reload();
    }
  };
  el("quality").onclick = () => {
    const low = view.quality !== "low";
    view.quality = low ? "low" : "balanced";
    view.engine.setHardwareScalingLevel(
      low ? 1.35 : 1 / Math.min(devicePixelRatio, 1.25),
    );
    view.shadows.getShadowMap()!.refreshRate = low ? 2 : 1;
    el("quality").textContent = `描画品質：${low ? "軽量" : "標準"}`;
    view.resize();
  };
  window.addEventListener("blur", () => {
    release();
    persist();
  });
  document.addEventListener("visibilitychange", () => {
    release();
    persist();
    last = performance.now();
  });
  new ResizeObserver(() => {
    release();
    view.resize();
  }).observe(el("game"));
  ui.update(started);
  el("loading").hidden = true;
  (el("start") as HTMLButtonElement).disabled = false;
  if (import.meta.env.DEV || new URLSearchParams(location.search).has("e2e"))
    (window as unknown as { __game: unknown }).__game = {
      state: () => model.snapshot(),
      position: (x: number, y: number) => {
        release();
        model.player = { x, y };
        model.s.x = x;
        model.s.y = y;
        ui.toggleShop(false);
      },
      entities: () => ({
        nodes: model.nodes,
        enemies: model.enemies,
        buildings: importedBuildings,
      }),
      save: persist,
      input: (x: number, y: number) => {
        debugInput = { x, y };
      },
      inspect: () => ({
        effects: view.particles.length,
        stick: movement.stick,
        shop: ui.shopShown,
        shopOpen: ui.shopOpen,
        ...view.metrics(),
      }),
    };
  let slowFrames = 0;
  view.engine.runRenderLoop(() => {
    const now = performance.now(),
      delta = Math.min(60, now - last);
    last = now;
    const paused =
      !started || (el("config") as HTMLDialogElement).open || document.hidden;
    movement.enabled = !paused && !ui.shopOpen;
    if (!paused) {
      const dir = ui.shopOpen
        ? { x: 0, y: 0 }
        : view.screenInput(movement.screenVector());
      model.step(delta, {
        x: dir.x + (ui.shopOpen ? 0 : debugInput.x),
        y: dir.y + (ui.shopOpen ? 0 : debugInput.y),
      });
    }
    for (const event of model.events.splice(0)) {
      if (event.type === "toast") ui.toast(event.text!);
      else if (event.type === "save") persist();
      else {
        view.effects(event);
        if (event.type === "deposit" || event.type === "complete")
          view.syncSites();
      }
    }
    if (now > uiAt) {
      uiAt = now + 200;
      ui.update(started);
    }
    view.update(delta);
    if (started && now > 4000 && view.engine.getFps() < 28) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 90 && view.quality !== "low") {
      view.quality = "low";
      view.engine.setHardwareScalingLevel(1.35);
      view.shadows.getShadowMap()!.refreshRate = 2;
      view.resize();
      el("quality").textContent = "描画品質：軽量";
    }
  });
}
import { buildingData as importedBuildings } from "./data";
