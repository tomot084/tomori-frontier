import { cost, stats, type Economy } from "./data";
import type { GameModel, Point } from "./simulation";
export type Investment = "tool" | "basket" | "carrier" | "market" | "waiter";
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
];
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
    return investmentTiles.find(
      (t) =>
        Math.hypot(t.x - this.game.player.x, t.y - this.game.player.y) < 90,
    );
  }
  offer(id: Investment) {
    const s = this.game.s,
      e = this.economy;
    if (id === "tool")
      return {
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
        price: cost(s, "capacity"),
        level: s.levels.capacity,
        max: 5,
        effect: `素材容量 ${stats(s).capacity} → ${stats(s).capacity + 10}`,
        benefit: "往復を減らしたい",
      };
    if (id === "carrier")
      return {
        price: e.carriers === 0 ? 8 : 16,
        level: e.carriers,
        max: 2,
        effect: "自動で採集 → 建築へ運搬（5個ずつ）",
        benefit: "建築を任せて別の仕事をしたい",
      };
    if (id === "waiter")
      return {
        price: 6,
        level: +e.waiter,
        max: 1,
        effect: "預けた木をお客さんへ自動配達",
        benefit: "まとめて預けて採集に戻りたい",
      };
    return {
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
    if (offer.level >= offer.max || g.s.resources.coin < offer.price)
      return false;
    if (id === "tool" || id === "basket")
      return g.purchase(id === "tool" ? "gather" : "capacity");
    g.s.resources.coin -= offer.price;
    const e = this.economy;
    if (id === "carrier") e.carriers++;
    if (id === "waiter") e.waiter = true;
    if (id === "market") e.market++;
    const tile = investmentTiles.find((t) => t.id === id)!;
    g.event("upgrade", tile, { kind: id });
    g.burst(tile, 0xffdb85, 12);
    g.pop(tile, id === "market" ? "売値アップ！" : "仲間が加入！");
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
      if (g.s.resources.wood < 5) return false;
      g.s.resources.wood -= 5;
      this.sale(g.player);
    } else {
      const amount = Math.min(30 - e.stock, g.s.resources.wood);
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
    const move = Math.min(d, dt * 120);
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
