import { describe, it, expect } from "vitest";
import { fresh, load, KEY } from "../src/data";
import { GameModel } from "../src/simulation";
function game(equipment = false) {
  const s = fresh();
  s.zone = 2;
  s.levels.attack = 1;
  s.economy!.machines = equipment
    ? { turret: 1, turretReach: 1, turretTwin: 1 }
    : {};
  s.economy!.content = equipment ? { snare: 1 } : {};
  const g = new GameModel(s);
  Object.assign(g.player, g.stage.raid!);
  return g;
}
function play(g: GameModel, move: boolean, seconds = 100) {
  for (let k = 0; k < (seconds * 1000) / 40 && g.raid.active; k++) {
    const targets = g.enemies.filter((e) => g.raid.owns(e) && !e.dead);
    targets.sort(
      (a, b) =>
        Math.hypot(a.x - g.player.x, a.y - g.player.y) -
        Math.hypot(b.x - g.player.x, b.y - g.player.y),
    );
    const target = targets[0];
    const distance = target
      ? Math.hypot(target.x - g.player.x, target.y - g.player.y)
      : 0;
    g.step(
      40,
      move && target && distance > 48
        ? {
            x: (target.x - g.player.x) / distance,
            y: (target.y - g.player.y) / distance,
          }
        : { x: 0, y: 0 },
    );
    g.events.splice(0);
  }
}
describe("opt-in defense raids", () => {
  it("requires the unlocked nearby beacon and earned harder tier", () => {
    const g = new GameModel(fresh());
    expect(g.raid.start()).toBe(false);
    g.s.zone = 1;
    expect(g.raid.start()).toBe(false);
    Object.assign(g.player, g.stage.raid!);
    expect(g.raid.start(2)).toBe(false);
    expect(g.raid.start()).toBe(true);
    expect(g.raid.start()).toBe(false);
  });
  it("idle center fails while moving interception wins three weak waves", () => {
    const idle = game();
    idle.raid.start();
    play(idle, false);
    expect(idle.raid.result).toBe("failed");
    const active = game();
    active.raid.start();
    play(active, true);
    expect(active.raid.result).toBe("victory");
    expect(active.s.kills).toBe(60);
    expect(active.s.economy!.raidClears).toBe(1);
  });
  it("real machinery helps without removing the player's role", () => {
    const idle = game(true);
    idle.raid.start();
    play(idle, false);
    expect(idle.raid.result).toBe("failed");
    expect(idle.machines.fired).toBeGreaterThan(0);
    const active = game(true);
    active.raid.start();
    play(active, true);
    expect(active.raid.result).toBe("victory");
    expect(active.machines.hits).toBeGreaterThan(0);
  });
  it("restores borrowed actors and protects guardian on cancellation", () => {
    const g = game();
    g.enemies[0].dead = 5000;
    const originals = structuredClone(g.enemies);
    g.raid.start();
    play(g, true, 5);
    g.raid.finish("cancelled");
    expect(g.enemies.at(-1)).toEqual(originals.at(-1));
    expect(g.enemies[0].dead - g.time).toBe(5000);
    expect(g.enemies.map((e) => e.type)).toEqual(originals.map((e) => e.type));
    expect(g.enemies.length).toBe(96);
    expect(g.machines.shots.every((s) => !s.active)).toBe(true);
  });
  it("saves only sanitized stage-local completion and pays firstclear once", () => {
    const g = game();
    g.raid.start();
    play(g, true);
    const first = g.drops
      .filter((d) => d.kind === "coin")
      .reduce((s, d) => s + d.amount, 0);
    const restored = new GameModel(load(JSON.stringify(g.snapshot())));
    expect(restored.raid.active).toBe(false);
    expect(restored.s.economy!.raidClears).toBe(1);
    expect(KEY).toBe("tomori-frontier-v1");
    Object.assign(g.player, g.stage.raid!);
    g.drops.splice(0);
    g.raid.start();
    g.raid.finish("victory");
    expect(g.drops.length).toBe(0);
    expect(
      first + (restored.s.economy!.raidReward ?? 0),
    ).toBeGreaterThanOrEqual(30);
    const raw = g.snapshot();
    raw.economy!.raidClears = 99;
    expect(load(JSON.stringify(raw)).economy!.raidClears).toBe(2);
    expect(new GameModel(load(JSON.stringify(fresh()))).raid.active).toBe(
      false,
    );
  });
  it("archives completions across travel and interrupts safely", () => {
    const g = game();
    g.investments.economy.raidClears = 1;
    g.investments.economy.content = { portal: 1 };
    const portal = g.stage.contents.find((c) => c.id === "portal")!;
    Object.assign(g.player, portal);
    const next = g.travel()!;
    expect(next.worlds!.frontier!.economy.raidClears).toBe(1);
    expect(next.economy!.raidClears).toBeUndefined();
    const remote = new GameModel(load(JSON.stringify(next)));
    Object.assign(
      remote.player,
      remote.stage.contents.find((c) => c.id === "portal")!,
    );
    expect(remote.travel()!.economy!.raidClears).toBe(1);
    Object.assign(g.player, g.stage.raid!);
    g.raid.start();
    g.player.y = 300;
    g.step(40, { x: 0, y: 0 });
    expect(g.raid.result).toBe("cancelled");
  });
  it("keeps pools bounded under maximum cargo and simultaneous raid drops", () => {
    const g = game(true);
    g.s.levels.capacity = 3;
    g.s.resources.wood = 10000;
    g.s.resources.stone = 10000;
    g.raid.start();
    for (let k = 0; k < 180; k++)
      g.spawn(g.player, k % 2 ? "food" : "coin", 20);
    play(g, true);
    expect(g.drops.length).toBeLessThanOrEqual(128);
    expect(g.enemies.length).toBe(96);
    expect(g.machines.shots.length).toBe(24);
    expect(g.s.resources.wood).toBe(10000);
  });
});

describe("defense transactions and outcomes", () => {
  it("keeps the exact first reward through immediate and partial reload, cap and repeat", () => {
    let g = game();
    g.raid.start();
    // Finish directly to isolate the reward transaction from ordinary enemy drops.
    g.raid.finish("victory");
    const coins = g.s.resources.coin;
    expect(g.s.economy!.raidReward).toBe(30);
    g = new GameModel(load(JSON.stringify(g.snapshot())));
    for (const e of g.enemies) e.dead = Number.MAX_SAFE_INTEGER;
    g.step(80, { x: 0, y: 0 });
    expect(g.s.resources.coin - coins).toBe(0); // dt clamps to60ms
    g.step(40, { x: 0, y: 0 });
    expect(g.s.resources.coin - coins).toBe(3);
    expect(g.s.economy!.raidReward).toBe(27);
    g = new GameModel(load(JSON.stringify(g.snapshot())));
    for (const e of g.enemies) e.dead = Number.MAX_SAFE_INTEGER;
    for (let k = 0; k < 100; k++) g.step(40, { x: 0, y: 0 });
    expect(g.s.resources.coin - coins).toBe(30);
    expect(g.s.economy!.raidReward).toBe(0);
    g.raid.start();
    g.raid.finish("victory");
    expect(g.s.economy!.raidReward).toBe(0);
    g.investments.economy.raidReward = 30;
    g.s.resources.coin = 99999;
    g.step(60, { x: 0, y: 0 });
    g.step(60, { x: 0, y: 0 });
    expect(g.s.economy!.raidReward).toBe(30);
    g.investments.economy.content = { portal: 1 };
    Object.assign(
      g.player,
      g.stage.contents.find((c) => c.id === "portal")!,
    );
    expect(g.travel()!.worlds!.frontier!.economy.raidReward).toBe(30);
  });
  it.each(["failed", "victory"] as const)(
    "restores original actors on %s and leaves guardian untouched",
    (result) => {
      const g = game(true);
      g.enemies.at(-1)!.type = 5;
      g.enemies.at(-1)!.hp = 90;
      g.enemies.at(-1)!.x = g.player.x;
      g.enemies.at(-1)!.y = g.player.y;
      const original = structuredClone(g.enemies);
      g.raid.start();
      play(g, true, 8);
      g.raid.finish(result);
      expect(g.enemies.at(-1)!.hp).toBe(90);
      expect(
        g.enemies.map((e) => ({
          id: e.id,
          type: e.type,
          hp: e.hp,
          x: e.x,
          y: e.y,
        })),
      ).toEqual(
        original.map((e) => ({
          id: e.id,
          type: e.type,
          hp: e.hp,
          x: e.x,
          y: e.y,
        })),
      );
    },
  );
  it("harder tier needs wider interception and machinery improves the standard margin", () => {
    const base = game();
    base.s.levels.attack = 0;
    base.raid.start();
    play(base, true);
    expect(base.raid.result).toBe("victory");
    const equipped = game(true);
    equipped.s.levels.attack = 0;
    equipped.raid.start();
    play(equipped, true);
    expect(equipped.raid.result).toBe("victory");
    const hard = game(true);
    hard.s.economy!.raidClears = 1;
    hard.s.levels.attack = 1;
    hard.raid.start(2);
    play(hard, true);
    expect(equipped.raid.hp).toBeGreaterThan(base.raid.hp);
    expect(hard.raid.result).toBe("victory");
    expect(hard.raid.hp).toBeLessThan(equipped.raid.hp);
  });
});
