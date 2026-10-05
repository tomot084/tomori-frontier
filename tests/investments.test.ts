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
