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
