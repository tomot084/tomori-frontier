import { it, expect } from "vitest";
import { fresh, load, stats } from "../src/data";
import { getStage, frostStage, stages } from "../src/stages";
import { GameModel } from "../src/simulation";
const run = (g: GameModel, ms: number) => {
  for (let t = 0; t < ms; t += 20) {
    g.step(20, { x: 0, y: 0 });
    g.events.length = 0;
  }
};
const game = (zone = 2) => {
  const s = fresh();
  s.zone = zone;
  s.resources.coin = 1000;
  const g = new GameModel(s);
  g.player = { x: 690, y: 940 };
  return g;
};
it("builds independent jobs with prerequisites and does not force the manual sawmill into automation", () => {
  const g = game(0);
  expect(g.investments.buy("lumberCamp")).toBe(false);
  expect(g.investments.buy("splitter")).toBe(false);
  expect(g.investments.buy("orchard")).toBe(true);
  g.investments.production.input = 10;
  run(g, 5000);
  expect(g.investments.production.output).toBe(0);
  expect(g.investments.content("orchard")).toBe(true);
});
it("garden worker visibly walks and produces conserved saved food, then hands it to a nearby player", () => {
  const g = game();
  g.investments.buy("orchard");
  run(g, 20000);
  expect(g.settlements.stock.food).toBeGreaterThan(0);
  const before = g.settlements.stock.food!;
  const saved = new GameModel(load(JSON.stringify(g.snapshot())));
  expect(saved.settlements.stock.food).toBe(before);
  g.player = { ...g.settlements.place("orchard") };
  run(g, 500);
  expect(g.s.resources.food).toBeGreaterThan(0);
});
it("dedicated lumber camp harvests real trees and feeds INPUT while the player fights elsewhere", () => {
  const g = game();
  g.investments.buy("lumberCamp");
  run(g, 45000);
  expect(g.investments.production.input).toBeGreaterThan(0);
  expect(g.investments.production.output).toBe(0);
  expect(
    g.nodes.some((n) => n.kind === "wood" && n.zone === 1 && n.dead > 0),
  ).toBe(true);
});
it("miner works with real rocks and keeps reservations reloadable instead of losing carried stone", () => {
  const g = game();
  g.investments.buy("minerCamp");
  run(g, 30000);
  expect(g.settlements.stock.stone).toBeGreaterThan(0);
  const restored = new GameModel(load(JSON.stringify(g.snapshot())));
  expect(restored.settlements.stock.stone).toBe(g.settlements.stock.stone);
  const w = restored.settlements.workers.find((w) => w.id === "minerCamp")!;
  expect(w.cargo).toBe(0);
});
it("kiln needs real wood and stone, turns them into bricks, and earns revenue only on delivery", () => {
  const g = game();
  g.investments.buy("kiln");
  const stock = g.settlements.stock;
  stock.kilnWood = 3;
  stock.kilnStone = 6;
  run(g, 2500);
  expect(stock.brick).toBe(0);
  expect(stock.kilnWood).toBe(3);
  run(g, 1000);
  expect(stock.kilnWood).toBe(2);
  expect(stock.kilnStone).toBe(4);
  expect(stock.brick).toBe(1);
  const restored = new GameModel(load(JSON.stringify(g.snapshot())));
  run(restored, 60000);
  expect(restored.investments.production.uncollected).toBe(24);
  expect(restored.settlements.stock.brick).toBe(0);
  expect(restored.s.resources.coin).toBe(840);
});
it("a branch courier delivers real output to construction and switches to market after completing a gate", () => {
  const g = game(1);
  g.investments.buy("conveyor");
  g.investments.buy("splitter");
  g.investments.production.output = 8;
  g.s.progress[1].wood = 52;
  g.s.progress[1].stone = 0;
  run(g, 45000);
  expect(g.s.progress[1].wood).toBe(55);
  expect(g.investments.production.output + g.investments.economy.stock).toBe(5);
  g.investments.economy.boardRoute = "market";
  run(g, 45000);
  expect(g.investments.economy.stock).toBe(5);
});
it("snare slows movement without dealing automatic damage", () => {
  const a = game(),
    b = game();
  b.investments.buy("snare");
  const at = b.settlements.place("snare");
  expect(b.settlements.enemySpeed(at)).toBe(0.4);
  expect(a.settlements.enemySpeed(at)).toBe(1);
  expect(b.settlements.enemySpeed({ x: 0, y: 0 })).toBe(1);
});
it("treasures open once, keep their discovery IDs, and cannot be farmed through reload", () => {
  const g = game();
  const t = g.stage.treasures[0];
  g.player = { ...t };
  run(g, 1000);
  expect(g.investments.economy.discoveries).toContain(t.id);
  const coins = g.s.resources.coin;
  const restored = new GameModel(load(JSON.stringify(g.snapshot())));
  run(restored, 1000);
  expect(restored.s.resources.coin).toBe(coins);
});
it("a guardian uses one existing enemy slot, gives a real defeat reward and stays defeated after reload", () => {
  const g = game();
  g.investments.buy("shrine");
  run(g, 20);
  const boss = g.enemies.at(-1)!;
  expect(boss.type).toBe(5);
  expect(g.enemies).toHaveLength(96);
  g.damageEnemy(boss, 90);
  expect(g.investments.economy.bossDefeated).toBe(true);
  expect(
    g.drops.filter((d) => d.kind === "coin").reduce((n, d) => n + d.amount, 0),
  ).toBe(120);
  const restored = new GameModel(load(JSON.stringify(g.snapshot())));
  run(restored, 20);
  expect(restored.enemies.at(-1)!.dead).toBe(Number.MAX_SAFE_INTEGER);
});
it("crosses into a real second stage, preserves global equipment, and restores each world's economy", () => {
  const g = game();
  g.investments.buy("portal");
  g.investments.buy("drill");
  g.s.progress[1].wood = 17;
  g.investments.economy.drillStock = 45;
  g.player = { ...g.settlements.place("portal") };
  const next = g.travel()!;
  expect(next.stage).toBe("frost");
  expect(next.zone).toBe(0);
  expect(next.economy!.machines?.drill).toBeUndefined();
  expect(next.resources).toEqual(g.s.resources);
  expect(next.levels).toEqual(g.s.levels);
  const remote = new GameModel(load(JSON.stringify(next)));
  expect(remote.stage).toBe(frostStage);
  expect(remote.enemies.some((e) => e.type === 3)).toBe(true);
  expect(remote.investments.tiles.find((t) => t.id === "turret")!.x).toBe(550);
  remote.player = { ...remote.settlements.place("portal") };
  const back = remote.travel()!;
  expect(back.stage).toBe("frontier");
  expect(back.progress[1].wood).toBe(17);
  expect(back.economy!.drillStock).toBe(45);
  expect(back.economy!.machines!.drill).toBe(1);
});
it("uses stage-specific construction costs and blocks travel away from the restored portal", () => {
  const g = game();
  expect(g.travel()).toBeNull();
  g.investments.buy("portal");
  expect(g.travel()).toBeNull();
  const s = fresh();
  s.stage = "frost";
  s.resources.wood = 20;
  const remote = new GameModel(s);
  remote.player = { x: 450, y: 682 };
  run(remote, 5000);
  expect(remote.s.zone).toBe(0);
  expect(remote.s.progress[0].wood).toBe(20);
  expect(remote.stage.buildings[0].cost.wood).toBe(45);
  expect(stats(remote.s).capacity).toBe(500);
  expect(getStage("unknown").id).toBe("frontier");
});
it("bounds new save inventories, ignores unknown content and discards fake discovery IDs", () => {
  const s = fresh();
  s.economy!.content = { kiln: 1, orchard: 99, fake: 1 } as any;
  s.economy!.workshops = { brick: 999999, stone: -2 };
  s.economy!.discoveries = ["fake", "mist-east", "mist-east"];
  const restored = load(JSON.stringify(s));
  expect(restored.economy!.content).toEqual({ kiln: 1, orchard: 0 });
  expect(restored.economy!.workshops!.brick).toBe(2000);
  expect(restored.economy!.workshops!.stone).toBe(0);
  expect(restored.economy!.discoveries).toEqual(["mist-east"]);
});

it("stage definitions can choose a subset of contents without changing simulation or mutating another world", () => {
  stages.variant = {
    ...frostStage,
    id: "variant",
    contents: [frostStage.contents.find((c) => c.id === "orchard")!],
    layout: {
      ...frostStage.layout,
      marketPoint: { x: 550, y: 520 },
      sawPoint: { x: 360, y: 420 },
    },
  };
  try {
    const s = fresh();
    s.stage = "variant";
    s.resources.coin = 100;
    const g = new GameModel(s);
    expect(g.investments.buy("kiln")).toBe(false);
    expect(g.travel()).toBeNull();
    expect(g.investments.tiles.find((t) => t.id === "market")!.x).toBe(550);
    expect(g.investments.buy("orchard")).toBe(true);
    run(g, 15000);
    expect(g.settlements.stock.food).toBeGreaterThan(0);
    expect(new GameModel(fresh()).stage.layout.marketPoint.x).toBe(610);
  } finally {
    delete stages.variant;
  }
});
it("existing hauler and branch courier share reservations and never sell or deliver an output twice", () => {
  const g = game();
  g.investments.buy("conveyor");
  g.investments.buy("splitter");
  g.investments.buy("hauler");
  g.investments.buy("waiter");
  g.investments.economy.boardRoute = "market";
  g.investments.economy.perks = { depot: 3 };
  g.investments.production.output = 100;
  run(g, 90000);
  expect(
    g.investments.production.output +
      g.investments.economy.stock +
      g.investments.economy.sold,
  ).toBe(100);
  expect(g.investments.production.uncollected).toBe(
    g.investments.economy.sold * 2,
  );
});

it("same machinery can be placed and priced in a later area without changing its behavior", () => {
  stages.variant = {
    ...frostStage,
    id: "variant",
    machineRules: { turret: { price: 200, unlock: 2 }, drill: { unlock: 2 } },
    drillNodeId: "node-2-13",
    layout: {
      ...frostStage.layout,
      turretPoint: { x: 400, y: 1550 },
      drillPoint: { x: 170, y: 1650 },
    },
  };
  try {
    const s = fresh();
    s.stage = "variant";
    s.zone = 2;
    s.resources.coin = 400;
    const g = new GameModel(s);
    g.player = { x: 690, y: 1490 };
    expect(g.investments.offer("turret").price).toBe(200);
    expect(g.investments.buy("turret")).toBe(true);
    expect(g.investments.buy("drill")).toBe(true);
    run(g, 14000);
    expect(g.machines.kills).toBeGreaterThan(0);
    expect(
      g.machines.drillWorking || g.investments.economy.drillStock! > 0,
    ).toBe(true);
    expect(g.nodes.find((n) => n.id === "node-2-13")!.x).toBe(235);
  } finally {
    delete stages.variant;
  }
});
