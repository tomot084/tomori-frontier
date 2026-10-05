import {
  buildingData,
  resourceData,
  stats,
  cost,
  upgradeData,
  type Resource,
  type Upgrade,
} from "./data";
import { GameModel } from "./simulation";
const svg = (body: string) =>
  `<svg viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
export const icons: Record<Resource, string> = {
  wood: svg(
    '<path d="M5 21 24 11l4 9L9 30Z" fill="#a66d3b"/><path d="M5 13 24 4l4 9L9 23Z" fill="#c99557"/><ellipse cx="8" cy="18" rx="5" ry="6" fill="#f4d39b" transform="rotate(-25 8 18)"/><ellipse cx="8" cy="18" rx="2" ry="3" fill="none" stroke="#bd8850" stroke-width="1.7"/><path d="m17 8 4 9m-4 6 4 3" stroke="#8f602f" stroke-width="2"/>',
  ),
  stone: svg(
    '<path d="m3 23 4-14 13-5 9 10-3 13-16 2Z" fill="#7a9fa9"/><path d="m7 9 13-5-5 14L3 23Z" fill="#b9cbc9"/><path d="m15 18 14-4-3 13-16 2Z" fill="#8bb0b4"/><path d="m20 4-2 10 6 3" stroke="#e3e4ce" stroke-width="2" fill="none"/>',
  ),
  food: svg(
    '<path d="M15 10q-1-9 12-8-3 11-12 8" fill="#74a669"/><path d="m16 6-3 11" stroke="#668653" stroke-width="2"/><circle cx="10" cy="20" r="8" fill="#e78869"/><circle cx="22" cy="23" r="7" fill="#d57761"/><circle cx="7" cy="17" r="2" fill="#ffc7a1"/>',
  ),
  coin: svg(
    '<circle cx="16" cy="16" r="13" fill="#e4a954"/><circle cx="16" cy="14" r="11" fill="#f5cc77"/><circle cx="16" cy="14" r="8" fill="none" stroke="#d7a34c" stroke-width="1.5"/><path d="m16 7 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#fff2c3"/>',
  ),
};
export const el = (id: string) => document.getElementById(id)!;
export class GameUI {
  shopShown = false;
  shopOpen = false;
  toastTimer = 0;
  unlockTimer = 0;
  lastShop = "";
  lastResources = "";
  lastGoal = "";
  pulse(kind: string) {
    const chip = document.querySelector(`[data-resource="${kind}"]`);
    if (chip) {
      chip.classList.remove("collected");
      void (chip as HTMLElement).offsetWidth;
      chip.classList.add("collected");
    }
  }
  constructor(
    public model: GameModel,
    private buy: (u: Upgrade) => void,
  ) {
    el("shop-toggle").onclick = () => this.toggleShop();
    el("shop-close").onclick = () => this.toggleShop(false);
    el("upgrades").onclick = (e) => {
      const button = (e.target as Element).closest<HTMLButtonElement>(
        "button[data-u]",
      );
      if (button && !button.disabled) buy(button.dataset.u as Upgrade);
    };
  }
  toast(text: string) {
    el("toast").textContent = text;
    el("toast").classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(
      () => el("toast").classList.remove("show"),
      3000,
    );
  }
  celebrate(index: number) {
    const rewards = [
      "灯りの精霊が採集・運搬をお手伝い",
      "精霊が2体に！ 採集で得られる素材も増加",
      "三つの島を復旧。暁の灯りが戻った！",
    ];
    const card = el("unlock");
    card.innerHTML = `<i>✦</i><div><small>開拓が進んだ！</small><b>${buildingData[index].name} 完成</b><span>${rewards[index]}</span></div>`;
    card.hidden = false;
    clearTimeout(this.unlockTimer);
    this.unlockTimer = window.setTimeout(() => (card.hidden = true), 4500);
  }
  toggleShop(open = !this.shopOpen) {
    this.shopOpen = open;
    el("shop-panel").hidden = !open;
    el("shop-toggle").hidden = open;
    document.body.classList.toggle("shop-open", open);
  }
  update(started: boolean) {
    const s = this.model.s,
      st = stats(s);
    const key = JSON.stringify(s.resources) + st.capacity;
    if (key !== this.lastResources) {
      if (!el("resources").children.length)
        el("resources").innerHTML = (
          ["wood", "stone", "food", "coin"] as Resource[]
        )
          .map((r) => {
            const cap =
              r === "coin"
                ? null
                : r === "food"
                  ? Math.floor(st.capacity / 2)
                  : st.capacity;
            return `<div class="resource-chip ${r}${cap && s.resources[r] >= cap ? " full" : ""}" data-resource="${r}">${icons[r]}<strong>${s.resources[r]}</strong><small>${r === "wood" ? "木材" : r === "stone" ? "石材" : r === "food" ? "灯実" : "灯貨"}${cap ? ` <span>/ ${cap}</span>` : ""}</small></div>`;
          })
          .join("");
      else
        for (const r of ["wood", "stone", "food", "coin"] as Resource[]) {
          const chip = el("resources").querySelector<HTMLElement>(
            `[data-resource="${r}"]`,
          )!;
          const cap =
            r === "coin"
              ? null
              : r === "food"
                ? Math.floor(st.capacity / 2)
                : st.capacity;
          chip.querySelector("strong")!.textContent = String(s.resources[r]);
          chip.classList.toggle("full", !!cap && s.resources[r] >= cap);
          const capLabel = chip.querySelector("small span");
          if (capLabel) capLabel.textContent = `/ ${cap}`;
        }
      this.lastResources = key;
    }
    el("hp").style.width = `${(s.hp / st.hp) * 100}%`;
    el("hp-value").textContent = `${Math.ceil(s.hp)} / ${st.hp}`;
    el("chapter").textContent = s.won
      ? "ALL CLEAR"
      : `島 ${Math.min(s.zone + 1, 3)} / 3`;
    const names = [
      "芽渡り橋をつくろう",
      "霧払い門を復旧しよう",
      "暁の灯台に光をともそう",
    ];
    const goalKey = JSON.stringify([
      this.model.guidance,
      s.zone,
      s.progress,
      s.resources,
      s.won,
      Math.round(this.model.player.x / 30),
      Math.round(this.model.player.y / 30),
    ]);
    if (goalKey !== this.lastGoal) {
      this.lastGoal = goalKey;
      if (s.won)
        el("goal").innerHTML =
          "<b>三つの島に、灯りが戻った！</b><small>探索と強化を続けられます</small>";
      else {
        const b = buildingData[s.zone],
          p = s.progress[s.zone];
        const guide = this.model.guidance;
        const total = Object.values(b.cost).reduce((a, n) => a + n, 0),
          done = Object.values(p).reduce((a, n) => a + n, 0);
        const dx = guide.target.x - this.model.player.x,
          dy = guide.target.y - this.model.player.y;
        const sx = dx * 0.91 - dy * 0.414,
          sy = dx * 0.414 + dy * 0.91;
        const arrows = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];
        const arrow =
          arrows[(Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) + 8) % 8];
        const building = guide.kind === "build";
        const title = building
          ? "橋へ素材を届けよう"
          : `${resourceData[guide.kind as Resource].name}をあと${guide.remaining}集めよう`;
        el("goal").innerHTML =
          `<b>${arrow} ${building && s.zone > 0 ? "建築地点へ素材を届けよう" : title}</b><small>${names[s.zone].replace("をつくろう", "").replace("を復旧しよう", "").replace("に光をともそう", "")} · ${Math.min(100, Math.round((done / total) * 100))}%${s.zone > 0 ? ` · 精霊${Math.min(2, s.zone)}体がお手伝い` : " · 光る目印へ"}</small><i class="goal-progress" style="--progress:${Math.min(100, (done / total) * 100)}%"></i>`;
      }
    }
    const ready =
      s.levels.gather === 0 && s.resources.coin >= cost(s, "gather");
    el("shop-toggle").querySelector("small")!.textContent = ready
      ? "木を一撃で切れる！"
      : "灯貨で装備を強化";
    const show = started && (s.zone > 0 || s.resources.coin > 0);
    el("shop-toggle").classList.toggle(
      "upgrade-ready",
      (Object.keys(upgradeData) as Upgrade[]).some(
        (u) => s.levels[u] < 5 && s.resources.coin >= cost(s, u),
      ),
    );
    this.shopShown = show;
    el("shop").hidden = !show;
    if (!show && this.shopOpen) this.toggleShop(false);
    const sk = JSON.stringify([s.levels, s.resources.coin]);
    if (show && sk !== this.lastShop) {
      this.lastShop = sk;
      const symbols = {
        attack: "⚔",
        gather:
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 21 9-14M10 4l8 2 3 5-8-2Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>',
        speed: "→",
        health: "♡",
        capacity: "▤",
      };
      el("upgrades").innerHTML = (Object.keys(upgradeData) as Upgrade[])
        .map(
          (u) =>
            `<button class="${u === "gather" && s.levels.gather === 0 ? "recommended" : ""}" data-u="${u}" ${s.resources.coin < cost(s, u) || s.levels[u] >= 5 ? "disabled" : ""}><i>${symbols[u]}</i><span><b>${upgradeData[u].name}${u === "gather" && s.levels.gather === 0 ? " · おすすめ" : ""}<em>Lv.${s.levels[u]}</em></b><small>${upgradeData[u].description}</small></span><strong>${s.levels[u] >= 5 ? "MAX" : `✦ ${cost(s, u)}`}</strong></button>`,
        )
        .join("");
    }
    el("save-status").textContent = "この端末に自動保存";
  }
}
