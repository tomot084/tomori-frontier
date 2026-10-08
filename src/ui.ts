import { upgradeLimit } from "./data";
import {
  buildingData,
  resourceData,
  stats,
  cost,
  upgradeData,
  type Resource,
  type Upgrade,
} from "./data";
import { GameModel, camps } from "./simulation";
import {
  investmentTiles,
  marketPoint,
  investmentGroups,
  investmentGroup,
  type InvestmentGroup,
  type Investment,
} from "./investments";
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
  investmentFilter: InvestmentGroup = "すべて";
  investmentOpen = false;
  selectedInvestment: Investment | null = null;
  investmentKey = "";
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
    el("investment-filters").onclick = (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "button[data-filter]",
      );
      if (button) {
        this.investmentFilter = button.dataset.filter as InvestmentGroup;
        this.investmentKey = "";
        this.update(true);
      }
    };
    el("crew-routing").onclick = (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "button[data-route]",
      );
      if (button) {
        model.investments.setRoute(button.dataset.route as "build" | "market");
        this.investmentKey = "";
        this.update(true);
      }
    };
    el("invest-toggle").onclick = () => this.openInvestments(null);
    el("invest-return").onclick = () => {
      model.investments.focus = null;
      this.closeInvestments();
    };
    el("invest-close").onclick = () => this.closeInvestments();
    el("tile-action").onclick = () =>
      this.openInvestments(this.model.investments.nearest?.id ?? null);
    el("investment-options").onclick = (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "button[data-investment]",
      );
      if (!button || button.disabled) return;
      const id = button.dataset.investment as Investment;
      const tile = investmentTiles.find((t) => t.id === id)!;
      const nearby =
        Math.hypot(tile.x - model.player.x, tile.y - model.player.y) < 100;
      if (!nearby) {
        model.investments.focus = id;
        this.closeInvestments();
        this.toast(`${tile.name}へ。光る目印をたどろう`);
      } else if (model.investments.buy(id)) {
        this.closeInvestments();
        model.investments.focus = null;
        this.toast(`${tile.name}に投資した！`);
        this.investmentKey = "";
        this.update(true);
      }
    };
    el("market-action").onclick = (event) => {
      if (
        (event.target as Element).closest("button") &&
        model.investments.supply()
      ) {
        this.investmentKey = "";
        this.closeInvestments();
        this.update(true);
      }
    };
    el("shop-toggle").onclick = () => this.toggleShop();
    el("shop-close").onclick = () => this.toggleShop(false);
    el("upgrades").onclick = (e) => {
      const button = (e.target as Element).closest<HTMLButtonElement>(
        "button[data-u]",
      );
      if (button && !button.disabled) buy(button.dataset.u as Upgrade);
    };
  }
  openInvestments(id: Investment | null) {
    this.toggleShop(false);
    this.selectedInvestment = id;
    this.investmentFilter = "すべて";
    this.investmentOpen = true;
    this.investmentKey = "";
    el("investment-panel").hidden = false;
    this.update(true);
  }
  closeInvestments() {
    this.investmentOpen = false;
    el("investment-panel").hidden = true;
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
      "次の島へ。新しい資源と戦闘で灯貨を稼ごう",
      "採集量が増加！ 育てた道具と仲間で開拓を進めよう",
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
    const system = this.model.investments,
      economy = system.economy;
    const nearest = system.nearest;
    el("invest-toggle").hidden =
      !started || this.investmentOpen || this.shopOpen;
    const campDistance = Math.min(
      ...camps
        .slice(0, s.zone + 1)
        .map((p) =>
          Math.hypot(p.x - this.model.player.x, p.y - this.model.player.y),
        ),
    );
    const targetDistance = nearest
      ? Math.hypot(
          nearest.x - this.model.player.x,
          nearest.y - this.model.player.y,
        )
      : Infinity;
    const atWorkshop = campDistance < 95 && campDistance < targetDistance;
    el("tile-action").hidden =
      !started ||
      this.investmentOpen ||
      this.shopOpen ||
      !nearest ||
      atWorkshop;
    if (nearest) {
      const offer = system.offer(nearest.id);
      el("tile-action").innerHTML =
        `<b>${nearest.name}</b><small>${nearest.id === "market" ? "市場を見る" : nearest.id === "sawmill" ? "強化を見る" : offer.level >= offer.max ? "詳細を見る" : `${offer.price}灯貨 · ${["carrier", "waiter", "hauler", "sawyer"].includes(nearest.id) ? "雇用を見る" : "投資する"}`}</small>`;
    }
    el("invest-return").hidden = !system.focus;
    const investmentKey = JSON.stringify([
      economy,
      s.levels,
      s.resources,
      nearest?.id,
      system.production,
      this.selectedInvestment,
      this.investmentFilter,
    ]);
    if (this.investmentOpen && investmentKey !== this.investmentKey) {
      this.investmentKey = investmentKey;
      const catalog = [...investmentTiles].sort(
        (a, b) =>
          [
            "conveyor",
            "hauler",
            "sawyer",
            "tool",
            "sawmill",
            "carrier",
            "quarry",
            "market",
            "cart",
            "basket",
            "waiter",
            "depot",
            "magnet",
            "bounty",
          ].indexOf(a.id) -
          [
            "conveyor",
            "hauler",
            "sawyer",
            "tool",
            "sawmill",
            "carrier",
            "quarry",
            "market",
            "cart",
            "basket",
            "waiter",
            "depot",
            "magnet",
            "bounty",
          ].indexOf(b.id),
      );
      const items = this.selectedInvestment
        ? investmentTiles.filter((t) => t.id === this.selectedInvestment)
        : catalog.filter(
            (t) =>
              this.investmentFilter === "すべて" ||
              investmentGroup(t.id) === this.investmentFilter,
          );
      el("investment-filters").hidden = !!this.selectedInvestment;
      el("investment-filters").innerHTML = investmentGroups
        .map(
          (group) =>
            `<button data-filter="${group}" aria-pressed="${group === this.investmentFilter}">${group}</button>`,
        )
        .join("");
      el("crew-routing").innerHTML =
        this.selectedInvestment === "carrier" && economy.carriers > 0
          ? `<div class="market-card"><b>木こりの届け先</b><p>建築を進めるか、製材所に丸太を集めるか。進行中の仕事を届け終えてから切り替えます。</p><div class="route-options"><button data-route="build" aria-pressed="${economy.route !== "market"}">建築へ</button><button data-route="market" aria-pressed="${economy.route === "market"}">市場へ</button></div>${economy.route === "market" && !economy.waiter ? "<p>運搬係と販売係を雇うと、板材を市場へ運んで販売できます。</p>" : ""}</div>`
          : "";
      el("investment-options").innerHTML = items
        .map((t) => {
          const o = system.offer(t.id),
            nearby =
              Math.hypot(t.x - this.model.player.x, t.y - this.model.player.y) <
              100;
          const max = o.level >= o.max,
            locked = s.zone < o.unlock;
          return `<article class="investment-card" style="--tile-color:#${t.color.toString(16)}"><div><b>${t.name}<em>${t.id === "carrier" ? `${o.level}人` : ["waiter", "hauler", "sawyer"].includes(t.id) ? (o.level ? "雇用済" : "未雇用") : `Lv.${o.level}`}</em></b><span>${o.effect}</span><small>${o.benefit}</small></div><button data-investment="${t.id}" ${locked || max || (nearby && s.resources.coin < o.price) ? "disabled" : ""}>${locked ? `✦ ${o.price}<small>橋の完成で解放</small>` : max ? "MAX" : nearby ? `✦ ${o.price} で${["carrier", "waiter", "hauler", "sawyer"].includes(t.id) ? "雇う" : "強化"}` : `✦ ${o.price}<small>タイルへ行く ↗</small>`}</button></article>`;
        })
        .join("");
      const atMarket =
        Math.hypot(
          this.model.player.x - marketPoint.x,
          this.model.player.y - marketPoint.y,
        ) < 100;
      const p = system.production;
      el("market-action").innerHTML =
        this.selectedInvestment === "market"
          ? `<div class="market-card"><b>板材1 → ✦ ${2 + economy.market}<span>販売済 ${economy.sold}枚</span></b><p>製材所のOUTPUTで板材を拾って市場へ。市場に立つと1枚ずつ販売。金庫へ近づいて灯貨を回収。</p><p>運ぶ板材 ${p.carried} · 市場在庫 ${economy.stock} · 未回収 ✦ ${p.uncollected}</p><button id="market-supply" ${!atMarket || (!p.carried && !economy.stock) ? "disabled" : ""}>市場の板材を販売する</button></div>`
          : this.selectedInvestment === "sawmill"
            ? `<div class="market-card"><b>丸太 → 板材 → 灯貨</b><p>右のINPUTへ近づくと1本ずつ投入。最初は製材所のそばで作業し、左のOUTPUTから板材を運びます。</p><p>INPUT ${p.input} · 製材中 ${p.processing} · OUTPUT ${p.output} / ${system.outputCapacity}</p></div>`
            : "";
    }
    const key =
      JSON.stringify(s.resources) + st.capacity + system.production.carried;
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
          if (r === "wood")
            chip.querySelector("small")!.innerHTML =
              `丸太<span>/${st.capacity}</span> 板${system.production.carried}`;
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
    const goalKey = JSON.stringify([
      this.model.guidance,
      s.zone,
      s.progress,
      s.resources,
      s.won,
      system.focus,
      economy.carriers,
      economy.route,
      system.production.input,
      system.production.output,
      system.production.carried,
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
        const focused = investmentTiles.find((t) => t.id === system.focus);
        const title = building
          ? s.zone === 0 &&
            economy.sold < 5 &&
            guide.target.x === 465 &&
            guide.target.y === 430
            ? "製材所INPUTへ丸太を届けよう"
            : "橋へ素材を届けよう"
          : `${resourceData[guide.kind as Resource].name}をあと${guide.remaining}集めよう`;
        el("goal").innerHTML =
          `<b>${arrow} ${focused ? `${focused.name}タイルへ行こう` : building && s.zone > 0 ? "建築地点へ素材を届けよう" : title}</b><small>${Math.min(100, Math.round((done / total) * 100))}%</small><i class="goal-progress" style="--progress:${Math.min(100, (done / total) * 100)}%"></i>`;
      }
    }
    const line = system.production;
    if (
      !system.focus &&
      s.zone === 0 &&
      (line.carried ||
        line.input ||
        line.output ||
        line.processing ||
        s.resources.wood >= 10)
    ) {
      el("goal").innerHTML =
        `<b>${line.uncollected ? "市場の金庫へ → 灯貨を回収" : line.carried ? "板材を市場へ → 灯貨を回収" : line.output ? "OUTPUTの板材を拾って市場へ" : line.input || line.processing ? "丸太 → 製材 → 板材" : "丸太を製材所INPUTへ運ぼう"}</b>`;
    }
    const ready =
      s.levels.gather === 0 && s.resources.coin >= cost(s, "gather");
    el("shop-toggle").querySelector("small")!.textContent = ready
      ? "装備に投資できる"
      : "灯貨で装備を強化";
    const show =
      started && !this.investmentOpen && (atWorkshop || this.shopOpen);
    el("shop-toggle").classList.toggle(
      "upgrade-ready",
      (Object.keys(upgradeData) as Upgrade[]).some(
        (u) => s.levels[u] < upgradeLimit(u) && s.resources.coin >= cost(s, u),
      ),
    );
    el("shop-toggle").hidden = !show || this.shopOpen;
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
            `<button data-u="${u}" ${s.resources.coin < cost(s, u) || s.levels[u] >= upgradeLimit(u) ? "disabled" : ""}><i>${symbols[u]}</i><span><b>${upgradeData[u].name}<em>Lv.${s.levels[u]}</em></b><small>${upgradeData[u].description}</small></span><strong>${s.levels[u] >= upgradeLimit(u) ? "MAX" : `✦ ${cost(s, u)}`}</strong></button>`,
        )
        .join("");
    }
    el("save-status").textContent = "この端末に自動保存";
  }
}
