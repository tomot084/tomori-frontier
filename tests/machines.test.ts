import { it, expect } from "vitest";
import { fresh, load } from "../src/data";
import { GameModel } from "../src/simulation";
import { turretPoint, drillPoint, towerPoint } from "../src/investments";
const run = (g: GameModel, ms: number) => {
  for (let t = 0; t < ms; t += 20) {
    g.step(20, { x: 0, y: 0 });
    g.events.length = 0;
  }
};
const funded = (zone = 1) => {
  const g = new GameModel(fresh());
  g.s.zone = zone;
  g.s.resources.coin = 300;
  g.player = { x: 690, y: 940 };
  return g;
};
it("gates island machinery and requires the purchased chassis for upgrades", () => {
  const g = funded(0);
  expect(g.investments.buy("turret")).toBe(false);
  expect(g.investments.buy("turretTwin")).toBe(false);
  expect(g.investments.buy("fastbelt")).toBe(false);
  g.s.zone = 1;
  expect(g.investments.buy("collector")).toBe(false);
  expect(g.investments.buy("turretReach")).toBe(false);
  expect(g.investments.buy("turret")).toBe(true);
  expect(g.investments.buy("drill")).toBe(true);
  expect(g.investments.buy("fastbelt")).toBe(false);
  expect(g.s.resources.coin).toBe(30);
});
it("hits only after a projectile physically travels, then produces normal enemy drops", () => {
  const g = funded();
  for (const e of g.enemies) e.dead = 1e9;
  const e = g.enemies[0];
  Object.assign(e, { ...turretPoint, y: turretPoint.y - 140, hp: 6, dead: 0 });
  g.investments.buy("turret");
  run(g, 660);
  expect(g.machines.fired).toBe(1);
  expect(g.machines.shots.some((s) => s.active)).toBe(true);
  expect(e.hp).toBe(6);
  run(g, 200);
  expect(e.hp).toBe(4);
  run(g, 1400);
  expect(e.dead).toBeGreaterThan(g.time);
  expect(g.machines.kills).toBe(1);
  expect(g.s.kills).toBe(1);
  expect(
    g.drops.reduce((n, d) => n + (d.kind === "coin" ? d.amount : 0), 0),
  ).toBe(5);
});
it("projectile misses cannot deal remote damage, and a blocked shot never hits twice", () => {
  const g = funded();
  for (const e of g.enemies) e.dead = 1e9;
  const target = g.enemies[0];
  Object.assign(target, { x: 400, y: 860, hp: 6, dead: 0 });
  g.investments.buy("turret");
  run(g, 660);
  target.x = 800;
  run(g, 700);
  expect(target.hp).toBe(6);
  expect(g.machines.hits).toBe(0);
  const shot = g.machines.shots[0];
  Object.assign(shot, {
    active: true,
    x: 300,
    y: 800,
    vx: 560,
    vy: 0,
    life: 1,
  });
  Object.assign(target, { x: 307, y: 800 });
  g.machines.step(0.06);
  expect(target.hp).toBe(4);
  g.machines.step(0.06);
  expect(target.hp).toBe(4);
});
it("range antenna reaches another pack and twin barrels target two different enemies", () => {
  const g = funded();
  g.s.resources.coin = 1000;
  for (const e of g.enemies) e.dead = 1e9;
  const a = g.enemies[0],
    b = g.enemies[1];
  Object.assign(a, { x: 400, y: 780, hp: 30, dead: 0 });
  Object.assign(b, { x: 410, y: 780, hp: 30, dead: 0 });
  g.investments.buy("turret");
  run(g, 1500);
  expect(g.machines.fired).toBe(0);
  g.investments.buy("turretReach");
  g.investments.buy("turretTwin");
  run(g, 400);
  expect(g.machines.fired).toBe(2);
  expect(a.hp).toBe(28);
  expect(b.hp).toBe(28);
});
it("drill depletes and waits for a real rock, preserves its inventory, and lets players receive it", () => {
  const g = funded();
  g.investments.buy("drill");
  run(g, 2500);
  expect(g.investments.economy.drillStock).toBe(15);
  const rock = g.nodes.find((n) => n.id === "node-1-13")!;
  expect(rock.dead).toBeGreaterThan(g.time);
  run(g, 3000);
  expect(g.investments.economy.drillStock).toBe(15);
  const restored = new GameModel(load(JSON.stringify(g.snapshot())));
  expect(restored.investments.economy.drillStock).toBe(15);
  g.player = { ...drillPoint };
  run(g, 500);
  expect(g.s.resources.stone).toBeGreaterThan(0);
  expect(g.investments.economy.drillStock! + g.s.resources.stone).toBe(15);
});
it("tower physically pulls drops into saved storage, then delivers nearby without overfilling players", () => {
  const g = funded(2);
  g.player = { x: 690, y: 940 };
  g.investments.buy("collector");
  g.spawn({ x: towerPoint.x + 210, y: towerPoint.y }, "coin", 10);
  const d = g.drops[0];
  d.age = 1;
  d.vx = d.vy = 0;
  const x = d.x;
  run(g, 40);
  expect(d.x).toBeLessThan(x);
  run(g, 1000);
  expect(g.drops.length).toBe(0);
  expect(g.investments.economy.towerStock!.coin).toBe(10);
  const restored = new GameModel(load(JSON.stringify(g.snapshot())));
  expect(restored.investments.economy.towerStock).toEqual(
    g.investments.economy.towerStock,
  );
  const coins = g.s.resources.coin;
  g.player = { ...towerPoint };
  run(g, 300);
  expect(g.s.resources.coin).toBe(coins + 10);
});
it("fast conveyor doubles real production throughput while unowned automation leaves distant production idle", () => {
  const manual = funded(),
    belt = funded(),
    fast = funded();
  for (const g of [manual, belt, fast]) {
    g.investments.production.input = 40;
    g.s.resources.coin = 300;
  }
  belt.investments.buy("conveyor");
  fast.investments.buy("conveyor");
  fast.investments.buy("fastbelt");
  run(manual, 6000);
  run(belt, 6000);
  run(fast, 6000);
  expect(manual.investments.production.output).toBe(0);
  expect(belt.investments.production.output).toBe(10);
  expect(fast.investments.production.output).toBe(20);
});
it("machine save fields reject unknown IDs and bound malformed inventories; bullets remain transient", () => {
  const s = fresh();
  s.economy!.machines = { turret: 1, drill: 100, unknownMachine: 1 } as any;
  s.economy!.drillStock = -100;
  s.economy!.towerStock = { coin: 1e9, wood: NaN };
  const saved = load(JSON.stringify(s));
  expect(saved.economy!.machines).toEqual({ turret: 1, drill: 0 });
  expect(saved.economy!.drillStock).toBe(0);
  expect(saved.economy!.towerStock).toEqual({ coin: 2000, wood: 0 });
  const g = funded(2);
  g.s.resources.coin = 1000;
  for (const id of [
    "turret",
    "turretReach",
    "turretTwin",
    "drill",
    "collector",
  ] as const)
    g.investments.buy(id);
  run(g, 30000);
  expect(g.drops.length).toBeLessThanOrEqual(128);
  expect(g.machines.shots.length).toBe(24);
  expect(g.enemies.length).toBe(96);
  const restored = new GameModel(load(JSON.stringify(g.snapshot())));
  expect(restored.investments.economy).toEqual(g.investments.economy);
  expect(restored.machines.shots.every((s) => !s.active)).toBe(true);
});

it("nearby collectors and players choose one destination so pickups never stall between them", () => {
  const g = funded(2);
  g.investments.buy("collector");
  for (const e of g.enemies) e.dead = 1e9;
  g.player = { x: 450, y: 1740 };
  const coins = g.s.resources.coin;
  g.spawn({ x: 450, y: 1570 }, "coin", 10);
  for (const drop of g.drops) {
    drop.age = 1;
    drop.vx = drop.vy = 0;
  }
  run(g, 500);
  expect(g.investments.economy.towerStock!.coin).toBe(10);
  expect(g.s.resources.coin).toBe(coins);
  expect(g.drops.length).toBe(0);
});
