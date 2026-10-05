import { describe, it, expect } from "vitest";
import {
  fresh,
  stats,
  cost,
  deposit,
  complete,
  upgrade,
  load,
} from "../src/data";
describe("progression", () => {
  it("never deposits missing resources or more than required", () => {
    const s = fresh();
    expect(deposit(s, 0, "wood")).toBe(false);
    s.resources.wood = 25;
    for (let i = 0; i < 30; i++) deposit(s, 0, "wood");
    expect(s.resources.wood).toBe(5);
    expect(s.progress[0].wood).toBe(20);
    expect(complete(s, 0)).toBe(false);
    s.resources.stone = 10;
    for (let i = 0; i < 10; i++) deposit(s, 0, "stone");
    expect(complete(s, 0)).toBe(true);
  });
  it("charges increasing costs and changes all five stats", () => {
    const s = fresh(),
      before = stats(s);
    expect(upgrade(s, "attack")).toBe(false);
    s.resources.coin = 500;
    for (const u of [
      "attack",
      "gather",
      "speed",
      "health",
      "capacity",
    ] as const) {
      const c = cost(s, u),
        coins = s.resources.coin;
      expect(upgrade(s, u)).toBe(true);
      expect(s.resources.coin).toBe(coins - c);
      expect(cost(s, u)).toBeGreaterThan(c);
    }
    const after = stats(s);
    expect(after.attack).toBeGreaterThan(before.attack);
    expect(after.gather).toBeLessThan(before.gather);
    expect(after.speed).toBeGreaterThan(before.speed);
    expect(after.hp).toBeGreaterThan(before.hp);
    expect(after.capacity).toBeGreaterThan(before.capacity);
  });
  it("restores partial construction and upgrades, rejects broken saves", () => {
    const s = fresh();
    s.progress[1].stone = 13;
    s.zone = 1;
    s.levels.speed = 2;
    s.resources.coin = 33;
    expect(load(JSON.stringify(s))).toEqual(s);
    for (const raw of [
      "broken",
      "{}",
      JSON.stringify({ ...s, zone: 99 }),
      JSON.stringify({ ...s, resources: { coin: -2 } }),
    ])
      expect(load(raw)).toEqual(fresh());
  });
});
it("caps upgrade levels and keeps currency on rejected purchases", () => {
  const s = fresh();
  s.resources.coin = 10000;
  for (let i = 0; i < 5; i++) expect(upgrade(s, "capacity")).toBe(true);
  const saved = JSON.stringify(s);
  expect(upgrade(s, "capacity")).toBe(false);
  expect(JSON.stringify(s)).toBe(saved);
  expect(stats(s).capacity).toBe(70);
});
