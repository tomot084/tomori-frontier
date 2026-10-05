import { it, expect } from "vitest";
import { fresh, load, stats } from "../src/data";
import { GameModel } from "../src/simulation";
import { marketPoint } from "../src/investments";
const run = (g: GameModel, ms: number) => {
  for (let t = 0; t < ms; t += 20) g.step(20, { x: 0, y: 0 });
};
it("supports tool-first, carrier-first and market-first investments with distinct effects", () => {
  for (const id of ["tool", "carrier", "market"] as const) {
    const g = new GameModel(fresh());
    g.s.resources.coin = 8;
    expect(g.investments.buy(id)).toBe(true);
    expect(g.s.resources.coin).toBe(
      id === "tool" ? 1 : id === "carrier" ? 0 : 2,
    );
    expect(
      id === "tool"
        ? g.s.levels.gather
        : id === "carrier"
          ? g.s.economy!.carriers
          : g.s.economy!.market,
    ).toBe(1);
  }
});
it("selling is deliberate, spends exactly five wood, and market upgrades improve actual revenue", () => {
  const g = new GameModel(fresh());
  g.s.resources.wood = 20;
  g.player = { ...marketPoint };
  run(g, 1000);
  expect(g.s.resources.wood).toBe(20);
  expect(g.s.resources.coin).toBe(0);
  expect(g.investments.supply()).toBe(true);
  expect(g.s.resources.wood).toBe(15);
  expect(g.s.resources.coin).toBe(4);
  g.investments.supply();
  expect(g.investments.buy("market")).toBe(true);
  expect(g.s.resources.coin).toBe(2);
  g.investments.supply();
  expect(g.s.resources.coin).toBe(7);
  expect(g.s.economy!.sold).toBe(15);
  g.player = { x: 450, y: 360 };
  expect(g.investments.supply()).toBe(false);
});
it("waiter carries reserved stock, pays only on arrival, and reload does not lose or duplicate cargo", () => {
  const g = new GameModel(fresh());
  g.s.resources.coin = 6;
  g.s.resources.wood = 20;
  g.player = { ...marketPoint };
  expect(g.investments.buy("waiter")).toBe(true);
  g.investments.supply();
  run(g, 100);
  expect(g.investments.waiter.cargo).toBe(5);
  expect(g.s.economy!.stock).toBe(20);
  expect(g.s.resources.coin).toBe(0);
  const resumed = new GameModel(load(JSON.stringify(g.snapshot())));
  run(resumed, 18000);
  expect(resumed.s.economy!.stock).toBe(0);
  expect(resumed.s.economy!.sold).toBe(20);
  expect(resumed.s.resources.coin).toBe(16);
});
it("capacity investment reduces round trips without forcing a tool upgrade, and purchases cannot overdraft", () => {
  const g = new GameModel(fresh());
  g.s.resources.coin = 5;
  expect(g.investments.buy("basket")).toBe(true);
  expect(stats(g.s).capacity).toBe(30);
  expect(g.s.levels.gather).toBe(0);
  expect(g.investments.buy("carrier")).toBe(false);
  expect(g.s.resources.coin).toBe(0);
});
it("legacy automatic companions migrate as owned while new games require hiring", () => {
  const s = fresh();
  s.zone = 2;
  delete s.economy;
  expect(load(JSON.stringify(s)).economy!.carriers).toBe(2);
  expect(fresh().economy!.carriers).toBe(0);
});

it("production buildings improve real harvest yields for wood and stone", () => {
  for (const [perk, kind] of [
    ["sawmill", "wood"],
    ["quarry", "stone"],
  ] as const) {
    const g = new GameModel(fresh());
    g.s.resources.coin = 10;
    expect(g.investments.buy(perk)).toBe(true);
    const n = g.nodes.find((n) => n.kind === kind)!;
    g.player = { x: n.x, y: n.y };
    run(g, 4000);
    expect(g.s.resources[kind]).toBe(7);
  }
});
it("upgraded depot persists more than thirty wood and respects the new limit", () => {
  const g = new GameModel(fresh());
  g.s.resources.coin = 12;
  g.s.resources.wood = 50;
  g.player = { ...marketPoint };
  g.investments.buy("waiter");
  g.investments.buy("depot");
  expect(g.investments.storageCapacity).toBe(50);
  g.investments.supply();
  expect(load(JSON.stringify(g.snapshot())).economy!.stock).toBe(50);
});
it("a wider recovery light attracts drops outside the original radius", () => {
  const g = new GameModel(fresh());
  g.s.resources.coin = 5;
  g.investments.buy("magnet");
  g.spawn({ x: g.player.x + 190, y: g.player.y }, "coin", 1);
  const drop = g.drops[0];
  drop.age = 1;
  drop.x = g.player.x + 190;
  drop.y = g.player.y;
  run(g, 3000);
  expect(g.s.resources.coin).toBe(1);
});
it("bounties are gated by the bridge, then increase actual combat drops", () => {
  const g = new GameModel(fresh());
  g.s.resources.coin = 9;
  expect(g.investments.buy("bounty")).toBe(false);
  g.s.zone = 1;
  expect(g.investments.buy("bounty")).toBe(true);
  g.s.levels.attack = 5;
  for (const other of g.enemies.slice(1)) other.dead = 1e9;
  const enemy = g.enemies[0];
  g.player = { x: enemy.x, y: enemy.y };
  run(g, 4000);
  expect(g.s.resources.coin).toBe(7);
});
it("carrier market routing feeds a real autonomous harvest-delivery-sales loop", () => {
  const g = new GameModel(fresh());
  g.s.resources.coin = 14;
  g.investments.buy("carrier");
  g.investments.buy("waiter");
  g.investments.setRoute("market");
  g.player = { x: 450, y: 290 };
  run(g, 60000);
  expect(g.s.economy!.sold).toBeGreaterThanOrEqual(5);
  expect(g.s.resources.coin).toBeGreaterThanOrEqual(4);
  expect(g.s.progress[0]).toEqual({ wood: 0, stone: 0, food: 0 });
  expect(g.s.resources.wood).toBe(0);
  const restored = new GameModel(load(JSON.stringify(g.snapshot())));
  expect(restored.investments.economy.route).toBe("market");
});
it("changing carrier destination retains an already harvested load until delivered", () => {
  const g = new GameModel(fresh());
  g.s.resources.coin = 8;
  g.investments.buy("carrier");
  g.investments.setRoute("market");
  for (let t = 0; t < 30000 && !g.crew.workers[0].cargo; t += 20) run(g, 20);
  const w = g.crew.workers[0];
  expect(w.cargo).toBe(5);
  g.investments.setRoute("build");
  run(g, 100);
  expect(w.destination).toBe("market");
  run(g, 8000);
  expect(g.s.economy!.stock).toBe(5);
});
it("changing route during a stone job never converts stone into market wood", () => {
  const g = new GameModel(fresh());
  g.s.resources.coin = 8;
  g.s.progress[0].wood = 20;
  g.investments.buy("carrier");
  run(g, 500);
  expect(g.crew.workers[0].kind).toBe("stone");
  g.investments.setRoute("market");
  for (let t = 0; t < 20000 && g.s.progress[0].stone < 5; t += 20) run(g, 20);
  expect(g.s.progress[0].stone).toBe(5);
  expect(g.s.economy!.stock).toBe(0);
});
it("transport investments speed up real carrier travel", () => {
  const normal = new GameModel(fresh()),
    fast = new GameModel(fresh());
  for (const g of [normal, fast]) {
    g.s.economy!.carriers = 1;
    g.player = { x: 450, y: 290 };
  }
  fast.s.resources.coin = 8;
  fast.investments.buy("cart");
  run(normal, 800);
  run(fast, 800);
  const travel = (g: GameModel) =>
    Math.hypot(g.crew.workers[0].x - 570, g.crew.workers[0].y - 205);
  expect(travel(fast) / travel(normal)).toBeCloseTo(1.25, 3);
});
it("market-routed carrier stock can be sold manually without forcing waiter hiring", () => {
  const g = new GameModel(fresh());
  g.s.resources.coin = 8;
  g.investments.buy("carrier");
  g.investments.setRoute("market");
  run(g, 20000);
  expect(g.s.economy!.stock).toBeGreaterThanOrEqual(5);
  g.player = { ...marketPoint };
  const stock = g.s.economy!.stock;
  expect(g.investments.supply()).toBe(true);
  expect(g.s.economy!.stock).toBe(stock - 5);
  expect(g.s.resources.coin).toBe(4);
  expect(g.s.resources.wood).toBe(0);
});
