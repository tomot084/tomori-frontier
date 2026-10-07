import { it, expect } from "vitest";
import { fresh, load } from "../src/data";
import { GameModel } from "../src/simulation";
import {
  inputPoint,
  outputPoint,
  marketPoint,
  tillPoint,
} from "../src/investments";
const run = (g: GameModel, ms: number) => {
  for (let t = 0; t < ms; t += 20) g.step(20, { x: 0, y: 0 });
};
it("unloads one log per tick, processes only with a person or conveyor, and carries output to sale then collection", () => {
  const g = new GameModel(fresh());
  g.s.resources.wood = 30;
  g.player = { ...inputPoint };
  run(g, 100);
  expect(g.s.resources.wood).toBe(29);
  expect(
    g.investments.production.input + g.investments.production.processing,
  ).toBe(1);
  run(g, 3400);
  expect(g.s.resources.wood).toBe(0);
  const p = g.investments.production;
  expect(p.input + p.processing + p.output).toBe(30);
  g.player = { x: 450, y: 200 };
  const before = p.output;
  run(g, 5000);
  expect(p.output).toBe(before);
  p.conveyor = true;
  run(g, 20000);
  expect(p.output).toBe(30);
  g.player = { ...outputPoint };
  run(g, 2000);
  expect(p.carried).toBe(20);
  expect(p.output).toBe(10);
  g.player = { ...marketPoint };
  run(g, 3500);
  expect(g.investments.economy.sold).toBe(20);
  expect(g.s.resources.coin + p.uncollected + (p.collecting ?? 0)).toBe(40);
  g.player = { ...tillPoint };
  run(g, 3500);
  expect(p.uncollected).toBe(0);
  expect(g.s.resources.coin).toBe(40);
  expect(
    g.events.filter((e) => e.type === "flow" && e.kind === "wood").length,
  ).toBeGreaterThanOrEqual(30);
});
it("reload preserves in-process timber, output, carried boards, coins and investments without resetting legacy progress", () => {
  const s = fresh();
  s.resources.wood = 17;
  s.progress[0].wood = 8;
  s.economy!.production = {
    input: 37,
    output: 51,
    carried: 12,
    processing: 1,
    clock: 0.7,
    conveyor: true,
    hauler: true,
    sawyer: true,
    uncollected: 28,
    collecting: 0,
    collectionClock: 0,
  };
  const restored = load(JSON.stringify(s));
  expect(restored.resources).toEqual(s.resources);
  expect(restored.progress).toEqual(s.progress);
  expect(restored.economy!.production).toEqual(s.economy!.production);
  const old = fresh();
  delete old.economy!.production;
  expect(load(JSON.stringify(old)).economy!.production?.input).toBe(0);
  const bad = JSON.parse(JSON.stringify(s));
  bad.economy.production.input = -5;
  bad.economy.production.clock = "bad";
  bad.economy.production.output = 1e20;
  expect(load(JSON.stringify(bad)).economy!.production).toMatchObject({
    input: 0,
    output: 0,
    clock: 0,
  });
});
it("hauler reservations do not duplicate or lose boards across pickup, capacity stalls or reload", () => {
  const g = new GameModel(fresh());
  g.player = { x: 450, y: 200 };
  g.investments.production.hauler = true;
  g.investments.production.output = 12;
  g.investments.economy.waiter = true;
  run(g, 600);
  const h = g.investments.hauler;
  expect(h.cargo).toBe(6);
  expect(g.investments.production.output).toBe(12);
  const restored = new GameModel(load(JSON.stringify(g.snapshot())));
  run(restored, 40000);
  expect(
    restored.investments.production.output +
      restored.investments.economy.stock +
      restored.investments.economy.sold,
  ).toBe(12);
  expect(restored.investments.economy.sold).toBe(12);
  expect(restored.investments.production.uncollected).toBe(24);
});
it("full OUTPUT pauses production without consuming or discarding INPUT", () => {
  const g = new GameModel(fresh()),
    p = g.investments.production;
  p.input = 30;
  p.output = 60;
  p.conveyor = true;
  run(g, 2000);
  expect(p.input).toBe(30);
  expect(p.output).toBe(60);
  expect(p.processing).toBe(0);
});

it("seller never pays for a reserved board before reaching the customer, even with an elapsed sale clock", () => {
  const g = new GameModel(fresh());
  g.player = { x: 450, y: 290 };
  g.investments.economy.waiter = true;
  g.investments.economy.stock = 5;
  g.investments.saleClock = 10;
  run(g, 20);
  expect(g.investments.waiter.cargo).toBe(5);
  expect(g.investments.economy.sold).toBe(0);
  expect(g.investments.economy.stock).toBe(5);
  run(g, 800);
  expect(g.investments.economy.sold).toBe(0);
  run(g, 1500);
  expect(g.investments.economy.sold).toBe(5);
  expect(g.investments.production.uncollected).toBe(10);
});
