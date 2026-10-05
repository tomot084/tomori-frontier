import { it, expect } from "vitest";
import { fresh, KEY, load } from "../src/data";
import { GameModel } from "../src/simulation";
const run = (m: GameModel, ms: number, x = 0, y = 0) => {
  for (let t = 0; t < ms; t += 20) m.step(20, { x, y });
};
it("retains the exact v1 save schema, placements and original progression values", () => {
  const s = fresh();
  s.zone = 1;
  s.resources.wood = 17;
  s.resources.coin = 31;
  s.progress[1].stone = 12;
  s.levels.gather = 2;
  s.x = 640;
  s.y = 1060;
  s.hp = 61;
  s.time = 88;
  const m = new GameModel(load(JSON.stringify(s)));
  expect(m.snapshot()).toEqual(s);
  expect(KEY).toBe("tomori-frontier-v1");
  expect(m.nodes).toHaveLength(53);
  expect(m.enemies).toHaveLength(14);
  expect(m.nodes[0]).toMatchObject({ x: 140, y: 390, kind: "wood" });
});
it("normalizes diagonal movement and blocks unopened crossings", () => {
  const m = new GameModel(fresh());
  run(m, 1000, 1, 1);
  expect(Math.hypot(m.player.x - 450, m.player.y - 360)).toBeCloseTo(130, 4);
  m.player = { x: 450, y: 680 };
  run(m, 2000, 0, 1);
  expect(m.player.y).toBe(691);
});
it("gathers, attracts real drops, and stops at resource capacity", () => {
  const m = new GameModel(fresh());
  m.player = { x: 140, y: 390 };
  run(m, 3200);
  expect(m.s.resources.wood).toBe(5);
  expect(m.nodes[0].dead).toBeGreaterThan(0);
  expect(m.events.some((e) => e.type === "death")).toBe(true);
  const full = new GameModel({
    ...fresh(),
    resources: { wood: 20, stone: 0, food: 0, coin: 0 },
  });
  full.player = { x: 140, y: 390 };
  run(full, 3000);
  expect(full.nodes[0].hp).toBe(6);
  expect(full.s.resources.wood).toBe(20);
});
it("automatically builds, opens the next island, fights and awards currency", () => {
  const s = fresh();
  s.resources.wood = 20;
  s.resources.stone = 10;
  const m = new GameModel(s);
  m.player = { x: 450, y: 682 };
  run(m, 5000);
  expect(s.zone).toBe(1);
  expect(s.resources.wood).toBe(0);
  m.player = { x: 180, y: 870 };
  run(m, 3800);
  expect(s.kills).toBeGreaterThan(0);
  expect(s.resources.coin).toBeGreaterThanOrEqual(5);
  expect(m.events.some((e) => e.type === "complete")).toBe(true);
});
it("heals safely at workshops and returns on defeat without losing materials", () => {
  const m = new GameModel(fresh());
  m.s.zone = 1;
  m.s.hp = 5;
  m.player = { x: 690, y: 940 };
  m.enemies[0].x = 690;
  m.enemies[0].y = 940;
  run(m, 1000);
  expect(m.s.hp).toBeGreaterThan(20);
  m.s.resources.wood = 13;
  m.s.hp = 1;
  m.player = { x: 180, y: 870 };
  m.enemies[0].x = 180;
  m.enemies[0].y = 870;
  m.enemies[0].cool = 0;
  run(m, 20);
  expect(m.player).toEqual({ x: 450, y: 330 });
  expect(m.s.resources.wood).toBe(13);
  expect(m.s.hp).toBe(80);
});

it("emits pickup rewards only when a real drop fits the inventory", () => {
  const m = new GameModel(fresh());
  m.spawn(m.player, "wood", 2);
  for (const drop of m.drops) {
    drop.age = 0.4;
    drop.x = m.player.x;
    drop.y = m.player.y;
  }
  run(m, 20);
  expect(m.s.resources.wood).toBe(2);
  expect(m.events.filter((e) => e.type === "pickup")).toHaveLength(2);
  expect(
    m.events
      .filter((e) => e.type === "pickup")
      .every((e) => e.kind === "wood" && e.count === 1),
  ).toBe(true);
  m.s.resources.wood = 20;
  m.events.length = 0;
  m.spawn(m.player, "wood", 1);
  m.drops[0].age = 0.4;
  run(m, 20);
  expect(m.s.resources.wood).toBe(20);
  expect(m.events.some((e) => e.type === "pickup")).toBe(false);
  expect(m.drops).toHaveLength(1);
});

it("guides the first handful to construction, then funds a visibly stronger tool", () => {
  const m = new GameModel(fresh());
  expect(m.guidance.kind).toBe("wood");
  expect(m.guidance.remaining).toBe(5);
  m.player = { ...m.guidance.target };
  for (let t = 0; t < 3000 && m.s.resources.wood < 5; t += 20) run(m, 20);
  expect(m.s.resources.wood).toBeGreaterThanOrEqual(5);
  expect(m.guidance.kind).toBe("build");
  m.player = { x: 450, y: 682 };
  run(m, 900);
  expect(m.s.progress[0].wood).toBe(5);
  expect(m.s.resources.coin).toBe(4);
  expect(m.guidance.kind).toBe("wood");
  m.player = { ...m.guidance.target };
  for (let t = 0; t < 3000 && m.s.resources.wood < 5; t += 20) run(m, 20);
  m.player = { x: 450, y: 682 };
  run(m, 900);
  expect(m.s.progress[0].wood).toBe(10);
  expect(m.s.resources.coin).toBe(8);
  expect(m.purchase("gather")).toBe(true);
  const target = m.nodes.find((n) => !n.dead && n.kind === "wood")!;
  m.player = { x: target.x, y: target.y };
  run(m, 550);
  expect(target.dead).toBeGreaterThan(0);
  const old = JSON.stringify(m.snapshot());
  expect(load(old)).toEqual(m.snapshot());
});

it("construction unlocks real helper harvesting and delivery without spending player inventory", () => {
  const s = fresh();
  const m = new GameModel(s);
  run(m, 10000);
  expect(m.crew.workers.some((w) => w.active)).toBe(false);
  s.resources.wood = 20;
  s.resources.stone = 10;
  m.player = { x: 450, y: 682 };
  run(m, 5000);
  expect(s.zone).toBe(1);
  m.player = { x: 690, y: 940 };
  const inventory = { ...s.resources };
  run(m, 35000);
  expect(s.progress[1].wood + s.progress[1].stone).toBeGreaterThanOrEqual(5);
  for (const kind of ["wood", "stone", "food"] as const)
    expect(s.resources[kind]).toBe(inventory[kind]);
  expect(s.resources.coin).toBeGreaterThanOrEqual(inventory.coin);
  expect(m.crew.workers.filter((w) => w.active)).toHaveLength(1);
  expect(m.events.some((e) => e.type === "deposit" && e.index === 1)).toBe(
    true,
  );
  expect(s.zone).toBe(1); // Food must still be gathered and delivered by the player.
});

it("helpers can finish a funded gate, unlock a second helper and resume from existing saves", () => {
  const s = fresh();
  s.zone = 1;
  s.progress[0] = { wood: 20, stone: 10, food: 0 };
  s.progress[1] = { wood: 55, stone: 40, food: 8 };
  s.x = 690;
  s.y = 940;
  const m = new GameModel(s);
  run(m, 18000);
  expect(s.zone).toBe(2);
  expect(s.progress[1].stone).toBe(45);
  expect(m.crew.workers.filter((w) => w.active)).toHaveLength(2);
  expect(
    m.events.filter((e) => e.type === "complete" && e.index === 1),
  ).toHaveLength(1);
  const restored = new GameModel(load(JSON.stringify(m.snapshot())));
  run(restored, 100);
  expect(restored.crew.workers.filter((w) => w.active)).toHaveLength(2);
  const progressBefore = { ...restored.s.progress[2] };
  run(restored, 30000);
  expect(
    restored.s.progress[2].wood + restored.s.progress[2].stone,
  ).toBeGreaterThan(progressBefore.wood + progressBefore.stone);
  expect(restored.s.progress[1]).toEqual({ wood: 55, stone: 45, food: 8 });
});

it("partial construction rewards survive reload without paying a milestone twice", () => {
  const s = fresh();
  s.zone = 1;
  s.progress[0] = { wood: 20, stone: 10, food: 0 };
  s.progress[1].wood = 26;
  s.resources.wood = 1;
  s.x = 450;
  s.y = 1232;
  const m = new GameModel(s);
  run(m, 20);
  expect(s.progress[1].wood).toBe(27);
  expect(s.resources.coin).toBe(3);
  const resumed = new GameModel(load(JSON.stringify(m.snapshot())));
  resumed.s.resources.wood = 1;
  run(resumed, 20);
  expect(resumed.s.progress[1].wood).toBe(28);
  expect(resumed.s.resources.coin).toBe(3);
});
