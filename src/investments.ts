import { cost, stats, type Economy, type Perk } from "./data";
import type { GameModel, Point } from "./simulation";
export type Investment =
  "tool" | "basket" | "carrier" | "market" | "waiter" | Perk;
export const investmentTiles: {
  id: Investment;
  name: string;
  x: number;
  y: number;
  color: number;
}[] = [
  { id: "tool", name: "道具工房", x: 230, y: 280, color: 0x57a9ad },
  { id: "basket", name: "背かご", x: 390, y: 210, color: 0xc79d67 },
  { id: "carrier", name: "運搬精霊", x: 570, y: 240, color: 0x88b4c9 },
  { id: "market", name: "灯材市場", x: 610, y: 500, color: 0xe2b35f },
  { id: "waiter", name: "配達係", x: 600, y: 365, color: 0xb7a0ca },
  { id: "sawmill", name: "製材所", x: 230, y: 430, color: 0xb88952 },
  { id: "quarry", name: "石切り場", x: 180, y: 560, color: 0x789ca8 },
  { id: "depot", name: "預かり倉庫", x: 400, y: 500, color: 0x93aa71 },
  { id: "cart", name: "運搬車", x: 725, y: 205, color: 0xba986d },
  { id: "magnet", name: "回収灯", x: 380, y: 615, color: 0x79bdb1 },
  { id: "bounty", name: "討伐掲示板", x: 535, y: 965, color: 0xca947b },
];
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
    effect: (l) => `木の採集量 +${2 * l} → +${2 + 2 * l}（仲間も対象）`,
    benefit: "同じ木から多く採りたい",
  },
  quarry: {
    base: 10,
    effect: (l) => `石の採集量 +${2 * l} → +${2 + 2 * l}（仲間も対象）`,
    benefit: "建築の石不足を解消したい",
  },
  depot: {
    base: 6,
    effect: (l) => `市場の預かり容量 ${30 + 20 * l} → ${50 + 20 * l}`,
    benefit: "配達係へ大量に預けたい",
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
      ? this.level("sawmill") * 2
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
        effect: `素材容量 ${stats(s).capacity} → ${stats(s).capacity + 10}`,
        benefit: "往復を減らしたい",
      };
    if (id === "carrier")
      return {
        unlock: 0,
        price: e.carriers === 0 ? 8 : 16,
        level: e.carriers,
        max: 2,
        effect: `自動で採集 → ${e.route === "market" ? "市場" : "建築"}へ運搬`,
        benefit: "建築支援・市場への集荷を任せたい",
      };
    if (id === "waiter")
      return {
        unlock: 0,
        price: 6,
        level: +e.waiter,
        max: 1,
        effect: "預けた木をお客さんへ自動配達",
        benefit: "まとめて預けて採集に戻りたい",
      };
    return {
      unlock: 0,
      price: 6 * (e.market + 1),
      level: e.market,
      max: 3,
      effect: `木5個の売値 ${4 + e.market} → ${5 + e.market} 灯貨`,
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
      id === "carrier" || id === "waiter" ? "仲間が加入！" : "設備を強化！",
    );
    g.event("save", tile);
    return true;
  }
  /** Deliberate market action: walking past never consumes construction materials. */
  supply() {
    const g = this.game,
      e = this.economy;
    if (
      Math.hypot(g.player.x - marketPoint.x, g.player.y - marketPoint.y) > 100
    )
      return false;
    if (!e.waiter) {
      if (e.stock >= 5) e.stock -= 5;
      else if (g.s.resources.wood >= 5) g.s.resources.wood -= 5;
      else return false;
      this.sale(g.player);
    } else {
      const amount = Math.min(
        this.storageCapacity - e.stock,
        g.s.resources.wood,
      );
      if (amount <= 0) return false;
      g.s.resources.wood -= amount;
      e.stock += amount;
      g.pop(marketPoint, `木 ${amount} を預けた`);
      g.burst(marketPoint, 0xe4b577, 6);
    }
    g.event("save", marketPoint);
    return true;
  }
  sale(at: Point) {
    const g = this.game,
      e = this.economy,
      income = 4 + e.market;
    g.s.resources.coin += income;
    e.sold += 5;
    this.servedAt = g.time;
    g.event("pickup", at, { kind: "coin", count: income });
    g.burst(at, 0xffdc88, 8);
    g.event("save", at);
  }
  step(dt: number) {
    const w = this.waiter,
      e = this.economy;
    w.active = e.waiter;
    if (!w.active) return;
    if (w.phase === "rest") {
      if (e.stock < 5) return;
      // Reserve the stock only upon completed delivery, so reload cannot lose cargo.
      w.cargo = 5;
      w.phase = "deliver";
    }
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
    if (d > 10) return;
    if (w.phase === "deliver") {
      e.stock -= 5;
      this.sale(customerPoint);
      w.cargo = 0;
      w.phase = "return";
    } else w.phase = "rest";
  }
}
