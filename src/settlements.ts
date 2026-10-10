import { contentIds, workshopKeys, type ContentId } from "./content";
import { gatherableData, stats, type Resource } from "./data";
import type { GameModel, Point } from "./simulation";
export interface Settler extends Point {
  id: ContentId;
  phase: "search" | "walk" | "work" | "deliver" | "rest";
  heading: number;
  cargo: number;
  kind: "wood" | "stone" | "food" | "plank" | "brick";
  targetId: string;
  clock: number;
  zone: number;
  destination: "build" | "market";
}
/** Saved inventories own reserved cargo. Reloading restarts jobs, never discards the payload. */
export class Settlements {
  workers: Settler[] = [
    "orchard",
    "lumberCamp",
    "minerCamp",
    "splitter",
    "kiln",
  ].map((id) => ({
    id: id as ContentId,
    x: 0,
    y: 0,
    phase: "search",
    heading: 0,
    cargo: 0,
    kind:
      id === "minerCamp"
        ? "stone"
        : id === "orchard"
          ? "food"
          : id === "splitter"
            ? "plank"
            : id === "kiln"
              ? "brick"
              : "wood",
    targetId: "",
    clock: 0,
    zone: 0,
    destination: "market",
  }));
  kilnClock = 0;
  kilnWorking = false;
  intakeClock = 0;
  gardenCycle = 0;
  bossActive = false;
  bossClock = 0;
  danger: Point & { until: number } = { x: 0, y: 0, until: 0 };
  constructor(private game: GameModel) {}
  place(id: ContentId) {
    return this.game.stage.contents.find((c) => c.id === id)!;
  }
  owned(id: ContentId) {
    const p = this.game.stage.contents.find((c) => c.id === id);
    return (
      !!p && this.game.investments.content(id) && this.game.s.zone >= p.unlock
    );
  }
  get stock() {
    const e = this.game.investments.economy;
    if (!e.workshops)
      e.workshops = Object.fromEntries(workshopKeys.map((k) => [k, 0]));
    return e.workshops;
  }
  enemySpeed(enemy: Point) {
    if (
      this.game.raid.active &&
      this.owned("snare") &&
      Math.hypot(
        enemy.x - this.game.stage.raid!.x,
        enemy.y - this.game.stage.raid!.y,
      ) < 210
    )
      return 0.4;
    return this.owned("snare") &&
      Math.hypot(
        enemy.x - this.place("snare").x,
        enemy.y - this.place("snare").y,
      ) < 140
      ? 0.4
      : 1;
  }
  walk(w: Settler, to: Point, dt: number) {
    const dx = to.x - w.x,
      dy = to.y - w.y,
      d = Math.hypot(dx, dy);
    w.heading = Math.atan2(dx, -dy);
    const move = Math.min(d, dt * 155 * this.game.investments.workerSpeed);
    if (d) {
      w.x += (dx / d) * move;
      w.y += (dy / d) * move;
    }
    return d < 12;
  }
  // All couriers cross island gaps at the actual bridge centre.
  travel(w: Settler, to: Point, dt: number) {
    const crossing = this.game.stage.buildings
      .slice(0, 2)
      .find(
        (b) => (w.y < b.y - 35 && to.y > b.y) || (w.y > b.y + 35 && to.y < b.y),
      );
    if (crossing && Math.abs(w.x - 450) > 8)
      return this.walk(w, { x: 450, y: w.y }, dt) && false;
    return this.walk(w, to, dt);
  }
  harvest(w: Settler, dt: number) {
    const g = this.game,
      home = this.place(w.id),
      kind = w.kind as "wood" | "stone";
    if (w.phase === "search") {
      if (w.id === "lumberCamp" && (this.stock.wood ?? 0)) {
        w.cargo = this.stock.wood!;
        w.phase = "deliver";
        return;
      }
      if ((this.stock[kind] ?? 0) >= 1950) return;
      let nearest = Infinity,
        target;
      for (const n of g.nodes) {
        if (
          n.dead ||
          n.kind !== kind ||
          n.zone !==
            this.game.stage.areas.findIndex(
              (a) => home.y >= a.start && home.y <= a.end,
            ) ||
          Math.hypot(n.x - g.player.x, n.y - g.player.y) < 80 ||
          this.workers.some((other) => other !== w && other.targetId === n.id)
        )
          continue;
        const d = Math.hypot(n.x - w.x, n.y - w.y);
        if (d < nearest) {
          target = n;
          nearest = d;
        }
      }
      if (!target) return;
      w.targetId = target.id;
      w.phase = "walk";
    }
    if (w.phase === "walk" || w.phase === "work") {
      const node = g.nodes.find((n) => n.id === w.targetId);
      if (!node || node.dead) {
        w.targetId = "";
        w.phase = "search";
        return;
      }
      if (w.phase === "walk") {
        if (this.walk(w, node, dt)) {
          w.phase = "work";
          w.clock = 0;
        }
      } else {
        w.clock += dt;
        if (w.clock >= 0.6) {
          w.clock = 0;
          node.hp -= 3;
          g.event("hit", node, { id: node.id, kind });
          g.burst(node, kind === "wood" ? 0xe4b577 : 0xbcd9db, 2);
          if (node.hp <= 0) {
            w.cargo =
              gatherableData[kind].yield + g.investments.resourceBonus(kind);
            this.stock[kind] = (this.stock[kind] ?? 0) + w.cargo;
            node.dead = g.time + gatherableData[kind].respawn * 1000;
            g.event("death", node, { id: node.id, kind });
            g.investments.transfer(node, w, kind, 0.3, 1.1);
            w.targetId = "";
            w.phase = "deliver";
          }
        }
      }
    } else if (w.phase === "deliver") {
      const to = kind === "wood" ? g.stage.layout.inputPoint : home;
      if (!this.travel(w, to, dt)) return;
      w.clock += dt;
      if (kind === "stone") {
        w.cargo = 0;
        w.phase = "rest";
        w.clock = 0;
      } else if (w.clock >= 0.1 && g.investments.production.input < 10000) {
        w.clock = 0;
        if ((this.stock.wood ?? 0) > 0) {
          this.stock.wood!--;
          g.investments.production.input++;
          g.investments.transfer(w, to, "wood", 1.1);
        }
        if (--w.cargo <= 0) {
          w.phase = "rest";
          w.clock = 0;
        }
      }
    } else {
      w.clock += dt;
      if (w.clock > 0.8) {
        w.phase = "search";
        w.clock = 0;
      }
    }
  }
  orchard(w: Settler, dt: number) {
    const home = this.place("orchard");
    if ((this.stock.food ?? 0) >= 2000) return;
    const plant = {
      x: home.x - 45 + (this.gardenCycle % 3) * 35,
      y: home.y - 35,
    };
    if (w.phase === "search" || w.phase === "walk") {
      w.phase = "walk";
      if (this.walk(w, plant, dt)) {
        w.phase = "work";
        w.clock = 0;
      }
    } else if (w.phase === "work") {
      w.clock += dt;
      if (w.clock >= 3) {
        w.cargo = 3;
        this.stock.food = (this.stock.food ?? 0) + 3;
        w.phase = "deliver";
        this.game.investments.transfer(plant, w, "food", 0.6, 1);
      }
    } else if (this.walk(w, home, dt)) {
      w.cargo = 0;
      w.phase = "search";
      this.gardenCycle++;
    }
  }
  courier(w: Settler, dt: number) {
    const g = this.game,
      p = g.investments.production,
      e = g.investments.economy;
    const kiln = w.id === "kiln",
      from = kiln ? this.place("kiln") : g.stage.layout.outputPoint;
    if (w.phase === "search") {
      if (!this.travel(w, from, dt)) return;
      const available = kiln
        ? (this.stock.brick ?? 0)
        : p.output - g.investments.hauler.cargo;
      if (!available) return;
      w.cargo = Math.min(6, available);
      w.destination = kiln ? "market" : (e.boardRoute ?? "build");
      w.zone = g.s.zone;
      w.phase = "deliver";
    } else if (w.phase === "deliver") {
      const build =
        w.destination === "build" && w.zone < 3 && w.zone === g.s.zone;
      const target = build
        ? { x: 450, y: g.stage.buildings[w.zone].y - 45 }
        : g.stage.layout.marketPoint;
      if (!this.travel(w, target, dt)) return;
      w.clock += dt;
      if (w.clock < 0.12) return;
      w.clock = 0;
      if (kiln) {
        if (!(this.stock.brick ?? 0)) {
          w.cargo = 0;
          w.phase = "rest";
          return;
        }
        this.stock.brick!--;
        p.uncollected += 8;
        g.investments.transfer(w, g.stage.layout.customerPoint, "brick", 1.1);
        g.investments.transfer(
          g.stage.layout.customerPoint,
          g.stage.layout.tillPoint,
          "coin",
          1.1,
        );
        e.sold++;
        g.investments.servedAt = g.time;
      } else if (p.output > 0) {
        if (
          build &&
          g.s.progress[w.zone].wood < g.stage.buildings[w.zone].cost.wood
        ) {
          p.output--;
          g.s.progress[w.zone].wood++;
          g.event("deposit", w, { kind: "wood", index: w.zone });
          g.investments.transfer(w, target, "plank", 1.1);
          g.rewardConstruction(w.zone);
          g.finishConstruction(w.zone);
        } else {
          if (e.stock >= g.investments.storageCapacity) return;
          p.output--;
          e.stock++;
          g.investments.transfer(w, g.stage.layout.marketPoint, "plank", 1.1);
        }
      }
      if (--w.cargo <= 0) {
        w.phase = "rest";
        w.cargo = 0;
      }
    } else if (this.travel(w, from, dt)) w.phase = "search";
  }
  step(dt: number) {
    const g = this.game,
      i = g.investments,
      e = i.economy;
    for (const treasure of g.stage.treasures) {
      if (
        treasure.zone > g.s.zone ||
        e.discoveries?.includes(treasure.id) ||
        Math.hypot(g.player.x - treasure.x, g.player.y - treasure.y) > 45
      )
        continue;
      (e.discoveries ??= []).push(treasure.id);
      g.spawn(treasure, "coin", treasure.coin);
      g.spawn(treasure, "food", 6);
      g.burst(treasure, 0xffdd83, 8);
      g.pop(treasure, "宝箱発見！");
      g.event("save", treasure);
    }
    if (!contentIds.some((id) => this.owned(id))) return;
    const stock = this.stock;
    for (const w of this.workers) {
      if (!this.owned(w.id)) continue;
      if (!w.x) Object.assign(w, this.place(w.id));
      if (w.id === "lumberCamp" || w.id === "minerCamp") this.harvest(w, dt);
      else if (w.id === "orchard") this.orchard(w, dt);
      else this.courier(w, dt);
    }
    this.intakeClock += dt;
    if (this.intakeClock >= 0.12) {
      this.intakeClock = 0;
      if (
        this.owned("kiln") &&
        Math.hypot(
          g.player.x - this.place("kiln").x,
          g.player.y - this.place("kiln").y,
        ) < 75
      ) {
        for (const [kind, key, max] of [
          ["wood", "kilnWood", 50],
          ["stone", "kilnStone", 100],
        ] as [Resource, string, number][]) {
          if (g.s.resources[kind] && (stock[key] ?? 0) < max) {
            g.s.resources[kind]--;
            stock[key] = (stock[key] ?? 0) + 1;
            i.transfer(g.player, this.place("kiln"), kind, 1.2, 0.6);
          }
        }
      }
      for (const [id, kind] of [
        ["orchard", "food"],
        ["minerCamp", "stone"],
      ] as [ContentId, Resource][]) {
        const reserved = this.workers.find((w) => w.id === id)!.cargo;
        if (
          !this.owned(id) ||
          Math.hypot(
            g.player.x - this.place(id).x,
            g.player.y - this.place(id).y,
          ) > 75
        )
          continue;
        const cap =
          kind === "food"
            ? Math.floor(stats(g.s).capacity / 2)
            : stats(g.s).capacity;
        const take = Math.max(
          0,
          Math.min(4, (stock[kind] ?? 0) - reserved, cap - g.s.resources[kind]),
        );
        if (take) {
          stock[kind] = (stock[kind] ?? 0) - take;
          g.s.resources[kind] += take;
          i.transfer(this.place(id), g.player, kind, 0.6, 1.2);
          g.event("pickup", g.player, { kind, count: take });
        }
      }
    }
    this.kilnWorking =
      this.owned("kiln") &&
      (stock.kilnWood ?? 0) > 0 &&
      (stock.kilnStone ?? 0) >= 2 &&
      (stock.brick ?? 0) < 100;
    if (this.kilnWorking) {
      this.kilnClock += dt;
      if (this.kilnClock >= 3) {
        this.kilnClock = 0;
        stock.kilnWood!--;
        stock.kilnStone! -= 2;
        stock.brick = (stock.brick ?? 0) + 1;
        g.burst(this.place("kiln"), 0xf0b57e, 3);
        i.transfer(
          this.place("kiln"),
          { x: this.place("kiln").x, y: this.place("kiln").y + 40 },
          "brick",
          1,
          0.5,
        );
      }
    }
    if (this.owned("shrine") && !g.raid.active) {
      const place = this.place("shrine"),
        boss = g.enemies.at(-1)!;
      if (!this.bossActive) {
        Object.assign(boss, {
          type: 5,
          hp: 90,
          zone: place.unlock,
          x: place.x,
          y: place.y - 65,
          homeX: place.x,
          homeY: place.y - 65,
          dead: e.bossDefeated ? Number.MAX_SAFE_INTEGER : 0,
        });
        this.bossActive = true;
      }
      if (
        !boss.dead &&
        Math.hypot(boss.x - g.player.x, boss.y - g.player.y) < 220 &&
        !g.atCamp
      ) {
        this.bossClock += dt;
        if (this.bossClock > 4) {
          this.bossClock = 0;
          Object.assign(this.danger, g.player, { until: g.time + 1200 });
        }
        if (this.danger.until && g.time >= this.danger.until) {
          if (
            Math.hypot(g.player.x - this.danger.x, g.player.y - this.danger.y) <
            75
          ) {
            g.s.hp = Math.max(1, g.s.hp - 12);
            g.pop(g.player, "−12", 0xff8d7c);
          }
          g.burst(this.danger, 0xf0a36e, 10);
          this.danger.until = 0;
        }
      } else if (boss.dead || g.atCamp) this.danger.until = 0;
    }
  }
  metrics() {
    return {
      stage: this.game.stage.id,
      stock: this.game.investments.economy.workshops ?? {},
      workers: this.workers,
      boss: this.bossActive,
      danger: this.danger,
      discoveries: this.game.investments.economy.discoveries ?? [],
    };
  }
}
