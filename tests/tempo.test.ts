import { it, expect } from "vitest";
import { fresh, stats, load } from "../src/data";
import { GameModel } from "../src/simulation";
import { visualStack, stackBulk } from "../src/cargo";
import { inputPoint } from "../src/investments";
const run = (g: GameModel, ms: number) => {
  for (let t = 0; t < ms; t += 20) g.step(20, { x: 0, y: 0 });
};
it("clears a pack in three swings, keeps moving, then replaces the pack", () => {
  const s = fresh();
  s.zone = 1;
  const g = new GameModel(s);
  g.player = { x: 180, y: 870 };
  run(g, 1300);
  expect(s.kills).toBeGreaterThanOrEqual(8);
  expect(s.resources.coin).toBeGreaterThan(25);
  expect(s.hp).toBeGreaterThan(60);
  const before = g.player.x;
  g.step(60, { x: 1, y: 0 });
  expect(g.player.x - before).toBeCloseTo(stats(s).speed * 0.06);
  g.player = { x: 690, y: 940 };
  run(g, 8000);
  expect(g.enemies.filter((e) => e.zone === 1 && !e.dead)).toHaveLength(48);
});
it("preserves all reward units with a saturated visual pool and partially full inventory", () => {
  const g = new GameModel(fresh());
  for (let i = 0; i < 40; i++) g.spawn(g.player, "wood", 220);
  g.spawn(g.player, "coin", 80);
  expect(g.drops.length).toBeLessThanOrEqual(128);
  expect(
    g.drops.filter((d) => d.kind === "wood").reduce((n, d) => n + d.amount, 0),
  ).toBe(8800);
  g.s.resources.wood = 499;
  for (const d of g.drops) {
    d.age = 0.4;
    d.x = g.player.x;
    d.y = g.player.y;
  }
  run(g, 20);
  expect(g.s.resources.wood).toBe(500);
  expect(
    g.drops.filter((d) => d.kind === "wood").reduce((n, d) => n + d.amount, 0),
  ).toBe(8799);
  expect(g.s.resources.coin).toBe(80);
});
it("gathers hundreds per upgraded tree, restores 10000 units and represents each load distinctly", () => {
  const s = fresh();
  s.levels.gather = 5;
  s.levels.capacity = 3;
  const g = new GameModel(s);
  g.player = { x: 140, y: 390 };
  run(g, 1500);
  expect(s.resources.wood).toBeGreaterThanOrEqual(220);
  s.resources.wood = 10000;
  expect(load(JSON.stringify(g.snapshot())).resources.wood).toBe(10000);
  const stacks = [10, 100, 500, 1000, 5000, 10000].map(visualStack);
  expect(new Set(stacks).size).toBe(6);
  expect(stacks.at(-1)).toBe(100);
  g.player = { ...inputPoint };
  run(g, 15000);
  expect(s.resources.wood).toBe(0);
  const p = g.investments.production;
  expect(p.input + p.processing + p.output).toBe(10000);
});

it("NPC timber deliveries use the expanded INPUT limit without discarding cargo", () => {
  const s = fresh();
  s.economy!.carriers = 1;
  s.economy!.route = "market";
  const g = new GameModel(s);
  g.player = { x: 450, y: 200 };
  const p = g.investments.production;
  p.input = 9999;
  p.output = 60;
  const w = g.crew.workers[0];
  Object.assign(w, {
    zone: 0,
    destination: "market",
    phase: "deliver",
    x: inputPoint.x,
    y: inputPoint.y,
    cargo: 2,
    clock: 0.1,
  });
  run(g, 1000);
  expect(p.input).toBe(10000);
  expect(w.cargo).toBe(1);
  expect(p.output).toBe(60);
});

it("offscreen stacks still widen for 1000, 5000 and 10000 units", () => {
  expect(stackBulk(100)).toBe(1);
  expect(stackBulk(1000)).toBeGreaterThan(stackBulk(500));
  expect(stackBulk(5000)).toBeGreaterThan(stackBulk(1000));
  expect(stackBulk(10000)).toBeGreaterThan(stackBulk(5000) * 1.3);
  expect(stackBulk(100000)).toBe(2.3);
});
