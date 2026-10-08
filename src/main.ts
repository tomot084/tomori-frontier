import "./style.css";
import { load, KEY, type Upgrade } from "./data";
import { GameModel, type Point } from "./simulation";
import { WorldView } from "./view3d";
import { MovementInput } from "./input";
import { GameUI, el } from "./ui";
import { GameFeedback } from "./feedback";
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
    view
      .loadAssets()
      .then(boot)
      .catch((error) => {
        el("loading").textContent =
          "島の素材を読み込めませんでした。更新してお試しください。";
        throw error;
      });
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
  const feedback = new GameFeedback();
  const movement = new MovementInput(canvas, el("stick"));
  const ui = new GameUI(model, (u: Upgrade) => {
    if (model.purchase(u)) {
      persist();
      ui.update(started);
      view.syncSites();
    }
  });
  let resetting = false;
  function persist() {
    if (resetting) return;
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
  for (const id of [
    "invest-toggle",
    "invest-close",
    "invest-return",
    "investment-filters",
    "crew-routing",
    "tile-action",
    "investment-options",
    "market-action",
  ])
    el(id).addEventListener("click", release);
  el("shop-toggle").addEventListener("click", release);
  el("shop-close").addEventListener("click", release);
  el("start").onclick = () => {
    feedback.activate();
    el("intro").remove();
    started = true;
    movement.enabled = true;
    ui.toast("フィールドをドラッグして移動。採集と戦闘は自動！");
    ui.update(started);
  };
  el("settings").onclick = () => {
    release();
    (el("config") as HTMLDialogElement).showModal();
  };
  el("close").onclick = () => {
    el("reset-confirm").hidden = true;
    el("reset").hidden = false;
    (el("config") as HTMLDialogElement).close();
  };
  el("reset").onclick = () => {
    el("reset-confirm").hidden = false;
    el("reset").hidden = true;
  };
  el("reset-cancel").onclick = () => {
    el("reset-confirm").hidden = true;
    el("reset").hidden = false;
  };
  el("reset-execute").onclick = () => {
    resetting = true;
    release();
    try {
      localStorage.removeItem(KEY);
      location.reload();
    } catch {
      resetting = false;
      ui.toast(
        "保存領域を削除できませんでした。ブラウザの設定を確認してください",
      );
    }
  };
  const paintFeedback = () => {
    el("feedback").textContent =
      `音・完成時の振動：${feedback.enabled ? "ON" : "OFF"}`;
  };
  paintFeedback();
  el("feedback").onclick = () => {
    feedback.toggle();
    paintFeedback();
  };
  el("quality").onclick = () => {
    const low = view.quality !== "low";
    view.quality = low ? "low" : "balanced";
    view.engine.setHardwareScalingLevel(
      low
        ? Math.max(1.15, view.width / 960, view.height / 960)
        : 1 / Math.min(devicePixelRatio, 1.25),
    );
    view.shadows.mapSize = low ? 512 : 1024;
    view.shadows.getShadowMap()!.refreshRate = low ? 2 : 1;
    el("quality").textContent = `描画品質：${low ? "軽量" : "標準"}`;
    view.resize();
    view.scene.render();
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
        guidance: model.guidance,
        feedback: feedback.metrics(),
        investments: {
          economy: model.investments.economy,
          waiter: model.investments.waiter,
          focus: model.investments.focus,
          open: ui.investmentOpen,
        },
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
      delta = Math.min(1000, now - last);
    last = now;
    const paused =
      !started ||
      ui.shopOpen ||
      ui.investmentOpen ||
      (el("config") as HTMLDialogElement).open ||
      document.hidden;
    movement.enabled = !paused && !ui.shopOpen;
    if (!paused) {
      const dir = ui.shopOpen
        ? { x: 0, y: 0 }
        : view.screenInput(movement.screenVector());
      const input = {
        x: dir.x + (ui.shopOpen ? 0 : debugInput.x),
        y: dir.y + (ui.shopOpen ? 0 : debugInput.y),
      };
      // Account for long render frames in <=60ms steps (max one second of catch-up).
      // Visibility changes reset last, so paused/background time is never simulated.
      for (let remaining = delta; remaining > 0; remaining -= 60)
        model.step(Math.min(remaining, 60), input);
    }
    const picked = new Set<string>();
    for (const event of model.events.splice(0)) {
      if (event.type === "toast") ui.toast(event.text!);
      else if (event.type === "save") persist();
      else {
        if (event.type === "pickup") {
          picked.add(event.kind!);
        }
        view.effects(event);
        feedback.play(event);
        if (event.type === "complete") ui.celebrate(event.index!);
        if (event.type === "deposit" || event.type === "complete")
          view.syncSites();
      }
    }
    if (picked.size) {
      ui.update(started);
      for (const kind of picked) ui.pulse(kind);
    }
    if (now > uiAt) {
      uiAt = now + 200;
      ui.update(started);
    }
    view.update(delta);
    if (started && now > 4000 && view.engine.getFps() < 28) slowFrames += delta;
    else slowFrames = Math.max(0, slowFrames - delta);
    if (slowFrames > 2000 && view.quality !== "low") {
      view.quality = "low";
      view.engine.setHardwareScalingLevel(
        Math.max(1.15, view.width / 960, view.height / 960),
      );
      view.shadows.mapSize = 512;
      view.shadows.getShadowMap()!.refreshRate = 2;
      view.resize();
      view.scene.render();
      el("quality").textContent = "描画品質：軽量";
    }
  });
}
import { buildingData as importedBuildings } from "./data";
