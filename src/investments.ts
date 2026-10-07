import { cost, stats, freshProduction, type Economy, type Perk } from "./data";
import type { GameModel, Point } from "./simulation";
export type Investment =
  | "tool"
  | "basket"
  | "carrier"
  | "market"
  | "waiter"
  | "conveyor"
  | "hauler"
  | "sawyer"
  | Perk;
export const investmentTiles: {
  id: Investment;
  name: string;
  x: number;
  y: number;
  color: number;
}[] = [
  { id: "tool", name: "道具工房", x: 230, y: 280, color: 0x57a9ad },
  { id: "basket", name: "背かご", x: 390, y: 210, color: 0xc79d67 },
  { id: "carrier", name: "木こり", x: 570, y: 240, color: 0x88b4c9 },
  { id: "market", name: "灯材市場", x: 610, y: 500, color: 0xe2b35f },
  { id: "waiter", name: "販売係", x: 600, y: 365, color: 0xb7a0ca },
  { id: "sawmill", name: "製材所", x: 380, y: 430, color: 0xb88952 },
  { id: "quarry", name: "石切り場", x: 180, y: 560, color: 0x789ca8 },
  { id: "depot", name: "預かり倉庫", x: 360, y: 590, color: 0x93aa71 },
  { id: "cart", name: "運搬車", x: 725, y: 205, color: 0xba986d },
  { id: "magnet", name: "回収灯", x: 380, y: 615, color: 0x79bdb1 },
  { id: "bounty", name: "討伐掲示板", x: 535, y: 965, color: 0xca947b },
];
investmentTiles.push(
  { id: "conveyor", name: "搬送ベルト", x: 470, y: 320, color: 0x579e99 },
  { id: "hauler", name: "運搬係", x: 700, y: 430, color: 0x86aec1 },
  { id: "sawyer", name: "製材担当", x: 300, y: 330, color: 0xc98d60 },
);
export const inputPoint = { x: 465, y: 430 };
export const sawPoint = { x: 380, y: 430 };
export const outputPoint = { x: 295, y: 430 };
export const tillPoint = { x: 650, y: 560 };
export const investmentGroups = ["すべて", "採集", "運営", "探索"] as const;
export type InvestmentGroup = (typeof investmentGroups)[number];
export const investmentGroup = (id: Investment): InvestmentGroup =>
  ["tool", "basket", "sawmill", "quarry", "magnet"].includes(id)
    ? "採集"
    : id === "bounty"
      ? "探索"
      : "運営";
const perks: Record<
  Perk,
  { base: number; effect: (level: number) => string; benefit: string }
> = {
  sawmill: {
    base: 10,
    effect: (l) => `製材速度 ${100 + l * 40}% → ${140 + l * 40}%`,
    benefit: "INPUTの丸太を速く板材にしたい",
  },
  quarry: {
    base: 10,
    effect: (l) => `石の採集量 +${2 * l} → +${2 + 2 * l}（仲間も対象）`,
    benefit: "建築の石不足を解消したい",
  },
  depot: {
    base: 6,
    effect: (l) =>
      `OUTPUT ${60 + 40 * l} → ${100 + 40 * l}枚 · 市場 ${30 + 20 * l} → ${50 + 20 * l}枚`,
    benefit: "板材を大量に積んで搬送の待ち時間に備えたい",
  },
  cart: {
    base: 8,
    effect: (l) => `仲間の移動速度 ${100 + 25 * l}% → ${125 + 25 * l}%`,
    benefit: "採集・配達の待ち時間を短くしたい",
  },
  magnet: {
    base: 5,
    effect: (l) => `資源の回収範囲 ${160 + 40 * l} → ${200 + 40 * l}`,
    benefit: "散った素材を遠くから回収したい",
  },
  bounty: {
    base: 9,
    effect: (l) => `敵1体の灯貨報酬 +${2 * l} → +${2 * l + 2}`,
    benefit: "戦闘で稼いで投資したい",
  },
};
export const marketPoint = investmentTiles[3];
export const customerPoint = { x: 610, y: 625 };
export class InvestmentSystem {
  focus: Investment | null = null;
  waiter: Point & {
    active: boolean;
    cargo: number;
    phase: "rest" | "deliver" | "return";
    heading: number;
  } = {
    x: marketPoint.x,
    y: marketPoint.y,
    active: false,
    cargo: 0,
    phase: "rest",
    heading: 0,
  };
  servedAt = -100;
  unloadClock = 0;
  saleClock = 0;
  collectClock = 0;
  manualSale = false;
  hauler = {
    x: outputPoint.x,
    y: outputPoint.y,
    cargo: 0,
    phase: "take" as "take" | "deliver" | "return",
    clock: 0,
    heading: 0,
  };
  get production() {
    return (this.economy.production ??= freshProduction());
  }
  get outputCapacity() {
    return 60 + this.level("depot") * 40;
  }
  constructor(private game: GameModel) {}
  get economy(): Economy {
    return (this.game.s.economy ??= {
      carriers: Math.min(2, this.game.s.zone),
      waiter: false,
      market: 0,
      stock: 0,
      sold: 0,
    });
  }
  get nearest() {
    return [...investmentTiles]
      .sort(
        (a, b) =>
          Math.hypot(a.x - this.game.player.x, a.y - this.game.player.y) -
          Math.hypot(b.x - this.game.player.x, b.y - this.game.player.y),
      )
      .find(
        (t) =>
          Math.hypot(t.x - this.game.player.x, t.y - this.game.player.y) < 90,
      );
  }
  level(id: Perk) {
    return this.economy.perks?.[id] ?? 0;
  }
  get storageCapacity() {
    return 30 + this.level("depot") * 20;
  }
  get workerSpeed() {
    return 1 + this.level("cart") * 0.25;
  }
  resourceBonus(kind: string) {
    return kind === "wood"
      ? 0
      : kind === "stone"
        ? this.level("quarry") * 2
        : 0;
  }
  setRoute(route: "build" | "market") {
    this.economy.route = route;
    this.game.event("save", this.game.player);
  }
  offer(id: Investment): {
    price: number;
    level: number;
    max: number;
    effect: string;
    benefit: string;
    unlock: number;
  } {
    const s = this.game.s,
      e = this.economy;
    if (["conveyor", "hauler", "sawyer"].includes(id)) {
      const key = id as "conveyor" | "hauler" | "sawyer";
      return {
        price: key === "conveyor" ? 24 : key === "hauler" ? 12 : 10,
        level: +this.production[key],
        max: 1,
        unlock: 0,
        effect:
          key === "conveyor"
            ? "ベルトが出現。離れていても製材し、速度2倍"
            : key === "hauler"
              ? "OUTPUTの板材を1枚ずつ拾い、市場まで運ぶ"
              : "製材所で働く。プレイヤーが離れても製材できる",
        benefit:
          key === "conveyor"
            ? "人力から連続生産へ"
            : key === "hauler"
              ? "往復を任せて採集に集中"
              : "安く生産を自動化したい",
      };
    }
    if (id in perks) {
      const perk = perks[id as Perk],
        level = this.level(id as Perk);
      return {
        price: Math.ceil(perk.base * 1.65 ** level),
        level,
        max: 3,
        effect: perk.effect(level),
        benefit: perk.benefit,
        unlock: id === "bounty" ? 1 : 0,
      };
    }
    if (id === "tool")
      return {
        unlock: 0,
        price: cost(s, "gather"),
        level: s.levels.gather,
        max: 5,
        effect:
          s.levels.gather === 0
            ? "木を2撃 → 1撃・採集速度 +25%"
            : "採集の威力と速度をアップ",
        benefit: "自分でたくさん採りたい",
      };
    if (id === "basket")
      return {
        unlock: 0,
        price: cost(s, "capacity"),
        level: s.levels.capacity,
        max: 5,
        effect: `素材容量 ${stats(s).capacity} → ${stats(s).capacity + 20}`,
        benefit: "往復を減らしたい",
      };
    if (id === "carrier")
      return {
        unlock: 0,
        price: e.carriers === 0 ? 8 : 16,
        level: e.carriers,
        max: 2,
        effect: `自動で採集 → ${e.route === "market" ? "製材所INPUT" : "建築"}へ運搬`,
        benefit: "建築支援・市場への集荷を任せたい",
      };
    if (id === "waiter")
      return {
        unlock: 0,
        price: 6,
        level: +e.waiter,
        max: 1,
        effect: "市場の板材を1枚ずつお客さんへ渡す",
        benefit: "まとめて預けて採集に戻りたい",
      };
    return {
      unlock: 0,
      price: 6 * (e.market + 1),
      level: e.market,
      max: 3,
      effect: `板材1枚の売値 ${2 + e.market} → ${3 + e.market} 灯貨`,
      benefit: "売上を増やして再投資したい",
    };
  }
  buy(id: Investment) {
    const g = this.game,
      offer = this.offer(id);
    if (
      offer.level >= offer.max ||
      g.s.resources.coin < offer.price ||
      g.s.zone < offer.unlock
    )
      return false;
    if (id === "tool" || id === "basket")
      return g.purchase(id === "tool" ? "gather" : "capacity");
    g.s.resources.coin -= offer.price;
    const e = this.economy;
    if (["conveyor", "hauler", "sawyer"].includes(id))
      this.production[id as "conveyor" | "hauler" | "sawyer"] = true;
    if (id === "carrier") e.carriers++;
    if (id === "waiter") e.waiter = true;
    if (id === "market") e.market++;
    if (id in perks) {
      e.perks ??= {};
      e.perks[id as Perk] = this.level(id as Perk) + 1;
    }
    const tile = investmentTiles.find((t) => t.id === id)!;
    g.event("upgrade", tile, { kind: id });
    g.burst(tile, 0xffdb85, 12);
    g.pop(
      tile,
      ["carrier", "waiter", "hauler", "sawyer"].includes(id)
        ? "仲間が加入！"
        : "設備を強化！",
    );
    g.event("save", tile);
    return true;
  }
  /** Market button starts a visible sequence; passing with raw logs never sells them. */
  supply() {
    if (
      Math.hypot(
        this.game.player.x - marketPoint.x,
        this.game.player.y - marketPoint.y,
      ) > 100
    )
      return false;
    if (!this.production.carried && !this.economy.stock) return false;
    this.manualSale = true;
    return true;
  }
  transfer(from: Point, to: Point, kind: string, height = 1, toHeight = 0.75) {
    this.game.event("flow", from, {
      kind,
      toX: to.x,
      toY: to.y,
      height,
      toHeight,
    });
  }
  sale(at: Point) {
    const income = 2 + this.economy.market;
    this.production.uncollected += income;
    this.economy.sold++;
    this.servedAt = this.game.time;
    for (let i = 0; i < income; i++) this.transfer(at, tillPoint, "coin", 1);
    this.game.event("save", at);
  }
  step(dt: number) {
    const g = this.game,
      p = this.production,
      e = this.economy;
    const near = (at: Point, radius = 65) =>
      Math.hypot(g.player.x - at.x, g.player.y - at.y) < radius;
    this.unloadClock += dt;
    const interval = g.s.resources.wood > 40 ? 0.065 : 0.095;
    if (
      near(inputPoint) &&
      g.s.resources.wood &&
      p.input < 200 &&
      this.unloadClock >= interval
    ) {
      this.unloadClock = 0;
      const height =
        1.4 + Math.floor((Math.min(100, g.s.resources.wood) - 1) / 2) * 0.425;
      g.s.resources.wood--;
      p.input++;
      this.transfer(
        g.player,
        inputPoint,
        "wood",
        height,
        0.48 + Math.floor((Math.min(100, p.input) - 1) / 3) * 0.3,
      );
    } else if (
      near(outputPoint, 48) &&
      p.output > this.hauler.cargo &&
      p.carried < stats(g.s).capacity &&
      this.unloadClock >= 0.09
    ) {
      this.unloadClock = 0;
      p.output--;
      p.carried++;
      this.transfer(
        outputPoint,
        g.player,
        "plank",
        0.5 + Math.floor(Math.min(100, p.output) / 3) * 0.22,
      );
    }
    const working = p.conveyor || p.sawyer || near(sawPoint, 130);
    if (
      working &&
      p.input > 0 &&
      !p.processing &&
      p.output < this.outputCapacity
    ) {
      p.input--;
      p.processing = 1;
      p.clock = 0;
      this.transfer(
        inputPoint,
        sawPoint,
        "wood",
        0.48 + Math.floor(Math.min(99, p.input) / 3) * 0.3,
      );
    }
    if (p.processing && working) {
      p.clock += dt * (1 + this.level("sawmill") * 0.4) * (p.conveyor ? 2 : 1);
      if (p.clock >= 1.2 && p.output < this.outputCapacity) {
        p.processing = 0;
        p.clock = 0;
        p.output++;
        this.transfer(
          sawPoint,
          outputPoint,
          "plank",
          0.8,
          0.48 + Math.floor((Math.min(100, p.output) - 1) / 3) * 0.22,
        );
        g.burst(sawPoint, 0xf0c588, 2);
      }
    }
    const h = this.hauler;
    if (p.hauler) {
      const target = h.phase === "deliver" ? marketPoint : outputPoint;
      const dx = target.x - h.x,
        dy = target.y - h.y,
        d = Math.hypot(dx, dy);
      h.heading = Math.atan2(dx, -dy);
      const move = Math.min(d, dt * 150 * this.workerSpeed);
      if (d) {
        h.x += (dx / d) * move;
        h.y += (dy / d) * move;
      }
      if (d < 12) {
        h.clock += dt;
        if (
          h.phase === "take" &&
          p.output > h.cargo &&
          h.clock >= 0.1 &&
          e.stock < this.storageCapacity
        ) {
          h.clock = 0;
          p.output--;
          h.cargo++;
          this.transfer(outputPoint, h, "plank", 0.8);
          // Cargo remains in saved output until delivery; reservations are excluded visually.
          p.output++;
          if (h.cargo >= Math.min(6, p.output)) h.phase = "deliver";
        } else if (h.phase === "take" && h.cargo > 0 && p.output <= h.cargo) {
          h.phase = "deliver";
        } else if (
          h.phase === "deliver" &&
          h.clock >= 0.1 &&
          e.stock < this.storageCapacity
        ) {
          h.clock = 0;
          h.cargo--;
          p.output--;
          e.stock++;
          this.transfer(h, marketPoint, "plank", 1.4);
          if (!h.cargo) h.phase = "return";
        } else if (h.phase === "return") h.phase = "take";
      }
    }
    this.saleClock += dt;
    if (near(marketPoint, 95) && p.carried && this.saleClock >= 0.1) {
      this.saleClock = 0;
      p.carried--;
      this.transfer(
        g.player,
        customerPoint,
        "plank",
        1.4 +
          Math.ceil(Math.min(100, g.s.resources.wood) / 2) * 0.425 +
          Math.floor(p.carried / 2) * 0.3,
      );
      this.sale(customerPoint);
    } else if (
      this.manualSale &&
      !e.waiter &&
      e.stock &&
      near(marketPoint, 100) &&
      this.saleClock >= 0.12
    ) {
      this.saleClock = 0;
      e.stock--;
      this.transfer(marketPoint, customerPoint, "plank", 1.1);
      this.sale(customerPoint);
      if (!e.stock) this.manualSale = false;
    }
    const w = this.waiter;
    w.active = e.waiter;
    if (w.active) {
      const target = w.phase === "deliver" ? customerPoint : marketPoint;
      const dx = target.x - w.x,
        dy = target.y - w.y,
        d = Math.hypot(dx, dy);
      w.heading = Math.atan2(dx, -dy);
      const move = Math.min(d, dt * 120 * this.workerSpeed);
      if (d) {
        w.x += (dx / d) * move;
        w.y += (dy / d) * move;
      }
      if (w.phase === "rest" && e.stock) {
        w.cargo = Math.min(5, e.stock);
        w.phase = "deliver";
      }
      if (
        Math.hypot(w.x - customerPoint.x, w.y - customerPoint.y) < 12 &&
        w.phase === "deliver" &&
        this.saleClock >= 0.12 &&
        e.stock
      ) {
        this.saleClock = 0;
        e.stock--;
        w.cargo--;
        this.transfer(w, customerPoint, "plank", 1.1);
        this.sale(customerPoint);
        if (!w.cargo || !e.stock) {
          w.cargo = 0;
          w.phase = "return";
        }
      } else if (d < 12 && w.phase === "return") w.phase = "rest";
    }
    this.collectClock += dt;
    if (near(tillPoint, 115) && p.uncollected && this.collectClock >= 0.06) {
      this.collectClock = 0;
      p.uncollected--;
      p.collecting = (p.collecting ?? 0) + 1;
      this.transfer(tillPoint, g.player, "coin", 0.5);
    }
    if (p.collecting) {
      p.collectionClock = (p.collectionClock ?? 0) + dt;
      if (p.collectionClock >= 0.5) {
        p.collectionClock -= 0.06;
        p.collecting--;
        g.s.resources.coin++;
        g.event("pickup", g.player, { kind: "coin", count: 1 });
        if (!p.collecting) p.collectionClock = 0;
      }
    }
  }
}
