/** Engine-independent gameplay. Coordinates and save units remain identical to v1. */
import {
  buildingData,
  enemyData,
  gatherableData,
  resourceData,
  stats,
  deposit,
  complete,
  upgrade,
  type Resource,
  type Save,
  type Upgrade,
} from "./data";
import { LanternCrew } from "./crew";
import {
  InvestmentSystem,
  investmentTiles,
  customerPoint,
  inputPoint,
  outputPoint,
  sawPoint,
  tillPoint,
  marketPoint,
} from "./investments";
const capFor = (kind: string, capacity: number) =>
  kind === "food" ? Math.floor(capacity / 2) : capacity;
export interface Point {
  x: number;
  y: number;
}
export interface Gatherable extends Point {
  id: string;
  kind: "wood" | "stone" | "food";
  hp: number;
  dead: number;
  zone: number;
}
export interface Enemy extends Point {
  id: string;
  type: number;
  hp: number;
  dead: number;
  cool: number;
  homeX: number;
  homeY: number;
  zone: number;
}
export interface DropItem extends Point {
  id: string;
  kind: Resource;
  age: number;
  vx: number;
  vy: number;
}
export interface GameEvent extends Point {
  type:
    | "flow"
    | "pickup"
    | "swing"
    | "hit"
    | "pop"
    | "burst"
    | "death"
    | "respawn"
    | "deposit"
    | "complete"
    | "toast"
    | "save"
    | "upgrade";
  toX?: number;
  toY?: number;
  height?: number;
  toHeight?: number;
  id?: string;
  kind?: string;
  color?: number;
  text?: string;
  count?: number;
  index?: number;
}
export const camps: Point[] = [
  { x: 450, y: 290 },
  { x: 690, y: 940 },
  { x: 690, y: 1490 },
];
export class GameModel {
  readonly nodes: Gatherable[] = [];
  readonly enemies: Enemy[] = [];
  readonly drops: DropItem[] = [];
  readonly events: GameEvent[] = [];
  readonly crew = new LanternCrew(this);
  readonly investments = new InvestmentSystem(this);
  player: Point;
  time = 0;
  direction = 0;
  moving = 0;
  attackAt = 0;
  gatherAt = 0;
  depositAt = 0;
  saveAt = 0;
  foodAt = 0;
  hitUntil = 0;
  dropId = 0;
  constructor(public s: Save) {
    this.player = { x: s.x, y: s.y };
    for (let z = 0; z < 3; z++)
      for (let i = 0; i < 19; i++) {
        const kind = i % 5 === 3 ? "stone" : i % 5 === 4 ? "food" : "wood";
        const x = 140 + (i % 4) * 185 + ((i * 17) % 55),
          y = 390 + z * 550 + Math.floor(i / 4) * 62;
        if (z === 0 || Math.hypot(x - 690, y - (940 + (z - 1) * 550)) > 98)
          this.nodes.push({
            id: `node-${z}-${i}`,
            x,
            y,
            zone: z,
            kind,
            hp: gatherableData[kind].hp,
            dead: 0,
          });
      }
    // Keep the hub's investment pads free of trees; retain node IDs and resource supply.
    for (const n of this.nodes) {
      if (
        [...investmentTiles, customerPoint, inputPoint, outputPoint, sawPoint]
          .filter((t) => t.y >= 190 + n.zone * 550 && t.y < 730 + n.zone * 550)
          .some(
            (t) =>
              Math.hypot(n.x - t.x, n.y - t.y) <
              ([inputPoint, outputPoint, sawPoint].includes(t) ? 125 : 82),
          )
      ) {
        n.x = n.x < 450 ? 150 : 785;
        n.y = Math.min(610 + n.zone * 550, n.y + 38);
      }
    }
    // One existing harvest tree anchors the visible grove beside the raw-timber inlet.
    // Keep its identity, yield and respawn; only the hub composition changes.
    const inletTree = this.nodes.find((n) => n.id === "node-0-2")!;
    inletTree.x = 360;
    inletTree.y = 255;
    // Spread displaced hub nodes instead of stacking several trees at the same shoreline point.
    // IDs, yields and respawn rules stay intact; the first tutorial tree remains at its familiar position.
    const placed = [this.nodes.find((n) => n.id === "node-0-0")!, inletTree];
    const slots = Array.from({ length: 38 }, (_, i) => 80 + i * 20).flatMap(
      (x) => Array.from({ length: 23 }, (_, i) => ({ x, y: 195 + i * 20 })),
    );
    for (const n of this.nodes
      .filter((n) => n.zone === 0 && !placed.includes(n))
      .sort((a, b) => Number(b.kind === "wood") - Number(a.kind === "wood"))) {
      const clear = (at: Point) =>
        placed.every(
          (p) =>
            Math.hypot(p.x - at.x, p.y - at.y) >=
            (p.kind === "wood" && n.kind === "wood" ? 100 : 80),
        ) &&
        investmentTiles.every(
          (p) => Math.hypot(p.x - at.x, p.y - at.y) >= 60,
        ) &&
        [customerPoint, ...camps].every(
          (p) => Math.hypot(p.x - at.x, p.y - at.y) >= 82,
        ) &&
        Math.hypot(at.x - 450, at.y - buildingData[0].y) >= 100 &&
        [inputPoint, outputPoint, sawPoint].every(
          (p) => Math.hypot(p.x - at.x, p.y - at.y) >= 125,
        );
      if (!clear(n)) {
        const at = slots
          .filter(clear)
          .sort(
            (a, b) =>
              Math.hypot(a.x - n.x, a.y - n.y) -
              Math.hypot(b.x - n.x, b.y - n.y),
          )[0];
        if (at) {
          n.x = at.x;
          n.y = at.y;
        }
      }
      placed.push(n);
    }
    for (let z = 1; z <= 2; z++)
      for (let i = 0; i < 7; i++) {
        const type = i % 3,
          x = 180 + (i % 3) * 230,
          y = 870 + (z - 1) * 550 + Math.floor(i / 3) * 125;
        this.enemies.push({
          id: `enemy-${z}-${i}`,
          type,
          x,
          y,
          homeX: x,
          homeY: y,
          zone: z,
          hp: enemyData[type].hp,
          dead: 0,
          cool: 0,
        });
      }
  }
  event(type: GameEvent["type"], at: Point, extra: Partial<GameEvent> = {}) {
    this.events.push({ type, x: at.x, y: at.y, ...extra });
  }
  toast(text: string) {
    this.event("toast", this.player, { text });
  }
  pop(at: Point, text: string, color = 0xfff1b4) {
    const entity = at as Partial<Gatherable & Enemy>;
    this.event("pop", at, {
      text,
      color,
      id: entity.id,
      kind: entity.kind ?? (entity.type !== undefined ? "enemy" : undefined),
    });
  }
  burst(at: Point, color: number, count = 6) {
    this.event("burst", at, {
      color,
      count,
      kind: (at as Partial<Gatherable>).kind,
    });
  }
  get atCamp() {
    return camps.some(
      (c, i) =>
        i <= this.s.zone &&
        Math.hypot(c.x - this.player.x, c.y - this.player.y) < 85,
    );
  }
  get guidance(): {
    kind: "wood" | "stone" | "food" | "build" | "done";
    target: Point;
    remaining: number;
  } {
    if (this.investments.focus) {
      const tile = investmentTiles.find(
        (t) => t.id === this.investments.focus,
      )!;
      return { kind: "build", target: tile, remaining: 0 };
    }
    const line = this.investments.production;
    if (this.s.zone === 0 && this.investments.economy.sold < 5) {
      if (line.uncollected)
        return { kind: "build", target: tillPoint, remaining: 0 };
      if (line.carried)
        return { kind: "build", target: marketPoint, remaining: 0 };
      if (line.output)
        return { kind: "build", target: outputPoint, remaining: 0 };
      if (line.input || line.processing)
        return { kind: "build", target: sawPoint, remaining: 0 };
      if (this.s.resources.wood >= 5)
        return { kind: "build", target: inputPoint, remaining: 0 };
    }
    if (this.s.won || this.s.zone >= 3)
      return { kind: "done", target: this.player, remaining: 0 };
    const i = this.s.zone,
      b = buildingData[i],
      progress = this.s.progress[i],
      st = stats(this.s);
    const build = {
      kind: "build" as const,
      target: { x: 450, y: b.y },
      remaining: 0,
    };
    // Deliver the first handful: show tangible construction before a long shopping list.
    if (i === 0 && progress.wood < b.cost.wood && this.s.resources.wood >= 5)
      return build;
    for (const kind of ["wood", "stone", "food"] as const) {
      const cap = kind === "food" ? Math.floor(st.capacity / 2) : st.capacity;
      if (this.s.resources[kind] >= cap && progress[kind] < b.cost[kind])
        return build;
    }
    for (const kind of ["wood", "stone", "food"] as const) {
      let remaining = Math.max(
        0,
        b.cost[kind] - progress[kind] - this.s.resources[kind],
      );
      if (i === 0 && kind === "wood" && progress.wood < b.cost.wood)
        remaining = Math.min(remaining, Math.max(0, 5 - this.s.resources.wood));
      else
        remaining = Math.min(
          remaining,
          Math.max(0, capFor(kind, st.capacity) - this.s.resources[kind]),
        );
      if (!remaining) continue;
      const candidates = this.nodes.filter(
        (n) => n.kind === kind && !n.dead && n.zone <= i && n.y < b.y,
      );
      candidates.sort(
        (a, b) =>
          Math.hypot(a.x - this.player.x, a.y - this.player.y) -
          Math.hypot(b.x - this.player.x, b.y - this.player.y),
      );
      if (candidates.length) return { kind, target: candidates[0], remaining };
    }
    return build;
  }
  purchase(u: Upgrade) {
    if (!upgrade(this.s, u)) return false;
    this.event("upgrade", this.player, { kind: u });
    this.burst(this.player, 0xffdb85, 12);
    this.pop(this.player, "強化！");
    this.event("save", this.player);
    return true;
  }
  spawn(at: Point, kind: Resource, n: number) {
    for (let i = 0; i < n && this.drops.length < 64; i++)
      this.drops.push({
        id: `drop-${this.dropId++}`,
        x: at.x,
        y: at.y,
        kind,
        age: 0,
        vx: (Math.random() - 0.5) * 160,
        vy: -50 - Math.random() * 70,
      });
  }
  rewardConstruction(i: number) {
    const b = buildingData[i],
      total = Object.values(b.cost).reduce((a, n) => a + n, 0);
    const delivered = Object.values(this.s.progress[i]).reduce(
      (a, n) => a + n,
      0,
    );
    if (i === 0 && (delivered === 5 || delivered === 10)) {
      this.s.resources.coin += 4;
      this.pop({ x: 450, y: b.y }, "橋板完成！ +4 灯貨");
      this.burst({ x: 450, y: b.y }, 0xffdc88, 10);
      this.toast(
        delivered === 5
          ? "橋板ができた！ 灯貨は道具・背かご・雇用に使える"
          : "8灯貨獲得！ 採集を強化する？ 運搬係を雇う？",
      );
      this.event("save", this.player);
    } else if (
      i > 0 &&
      [0.25, 0.5, 0.75].some((ratio) => delivered === Math.ceil(total * ratio))
    ) {
      this.s.resources.coin += 3;
      this.pop(
        { x: 450, y: b.y },
        `${Math.round((delivered / total) * 100)}% +3 灯貨`,
      );
      this.toast(`${b.name}の復旧が進んだ！ +3灯貨で装備を強化`);
      this.event("save", this.player);
    }
  }
  finishConstruction(i: number) {
    if (this.s.zone !== i || !complete(this.s, i)) return;
    const b = buildingData[i];
    this.s.zone++;
    this.s.resources.coin += [8, 12, 20][i];
    this.event("complete", { x: 450, y: b.y }, { index: i });
    this.burst({ x: 450, y: b.y }, 0xffdc88, 20);
    this.toast(
      i === 0
        ? "橋が完成！ 新しい資源と敵がいる島へ"
        : i === 1
          ? "門が開いた！ 採集量アップ。投資の成果を次の島へ"
          : "三つの島に、暁の灯りが戻った！",
    );
    if (i === 2) this.s.won = true;
    this.event("save", this.player);
  }
  snapshot(): Save {
    return structuredClone({ ...this.s, x: this.player.x, y: this.player.y });
  }
  step(delta: number, input: Point) {
    const dt = Math.min(Math.max(delta, 0), 60) / 1000;
    this.time += dt * 1000;
    const time = this.time,
      p = this.player,
      st = stats(this.s);
    this.s.time += dt;
    let { x: dx, y: dy } = input;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    this.moving = Math.min(1, len);
    if (time > this.hitUntil) {
      p.x = Math.max(80, Math.min(820, p.x + dx * st.speed * dt));
      p.y = Math.max(
        190,
        Math.min(
          this.s.zone < 3 ? buildingData[this.s.zone].y - 39 : 1965,
          p.y + dy * st.speed * dt,
        ),
      );
      for (const b of buildingData.slice(0, Math.min(this.s.zone, 2)))
        if (Math.abs(p.y - b.y) < 38 && (p.x < 395 || p.x > 505))
          p.y = dy >= 0 ? b.y - 39 : b.y + 39;
    }
    if (len > 0.1) this.direction = Math.atan2(dx, -dy);
    if (time > this.gatherAt) {
      const n = this.nodes.find(
        (n) =>
          !n.dead &&
          n.zone <= this.s.zone &&
          n.y < buildingData[Math.min(this.s.zone, 2)].y &&
          Math.hypot(p.x - n.x, p.y - n.y) < 65 &&
          this.s.resources[n.kind] <
            (n.kind === "food" ? Math.floor(st.capacity / 2) : st.capacity),
      );
      if (n) {
        this.gatherAt = time + st.gather;
        this.event("swing", n, { kind: n.kind });
        const power = 3 * (1 + this.s.levels.gather);
        n.hp -= power;
        this.event("hit", n, { id: n.id, kind: n.kind });
        this.pop(n, `−${power}`);
        this.burst(n, resourceData[n.kind].color, 6);
        if (n.hp <= 0) {
          n.dead = time + gatherableData[n.kind].respawn * 1000;
          this.spawn(
            n,
            n.kind,
            gatherableData[n.kind].yield +
              (this.s.zone >= 2 ? 2 : 0) +
              this.investments.resourceBonus(n.kind),
          );
          this.event("death", n, { id: n.id, kind: n.kind });
          if (!this.s.resources.wood && n.kind === "wood")
            this.toast("丸太を集めた！ 製材所INPUTへ。橋にも使える");
        }
      }
    }
    for (const n of this.nodes)
      if (n.dead && time > n.dead) {
        n.dead = 0;
        n.hp = gatherableData[n.kind].hp;
        this.event("respawn", n, { id: n.id });
      }
    let nearest: Enemy | undefined,
      dist = Infinity;
    const safe = this.atCamp;
    for (const e of this.enemies) {
      if (e.zone > this.s.zone) continue;
      if (e.dead) {
        if (time > e.dead) {
          e.dead = 0;
          e.hp = enemyData[e.type].hp;
          e.x = e.homeX;
          e.y = e.homeY;
          this.event("respawn", e, { id: e.id });
        }
        continue;
      }
      const d = enemyData[e.type],
        distance = Math.hypot(e.x - p.x, e.y - p.y);
      if (distance < dist) {
        dist = distance;
        nearest = e;
      }
      if (distance < 145 && distance > d.range && !safe) {
        e.x += ((p.x - e.x) / distance) * d.speed * dt;
        e.y += ((p.y - e.y) / distance) * d.speed * dt;
      }
      if (distance < d.range + 6 && time > e.cool && !safe) {
        e.cool = time + 1200;
        this.s.hp -= d.attack;
        this.event("hit", p, { id: "player", kind: "enemy" });
        this.pop(p, `−${d.attack}`, 0xff8d7c);
        if (this.s.hp <= 0) {
          this.s.hp = st.hp;
          p.x = 450;
          p.y = 330;
          this.toast("灯が野営地へ運んだ。素材は無事！");
        }
      }
    }
    if (nearest && dist < 75 && time > this.attackAt) {
      this.attackAt = time + 650;
      const e = nearest;
      this.event("swing", e, { kind: "enemy" });
      e.hp -= st.attack;
      this.event("hit", e, { id: e.id, kind: "enemy" });
      this.hitUntil = time + 45;
      this.pop(e, `−${st.attack}`);
      this.burst(e, enemyData[e.type].color, 8);
      const angle = Math.atan2(e.y - p.y, e.x - p.x);
      e.x += Math.cos(angle) * 13;
      e.y += Math.sin(angle) * 13;
      if (e.hp <= 0) {
        e.dead = time + 24000;
        this.s.kills++;
        this.event("death", e, { id: e.id, kind: "enemy" });
        this.spawn(
          e,
          "coin",
          enemyData[e.type].drop + this.investments.level("bounty") * 2,
        );
        this.spawn(e, "food", 2);
        this.burst(e, 0xffdc88, 12);
        if (this.s.kills === 1)
          this.toast("灯貨を獲得！ 灯工房で道具を強化しよう");
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      const cap =
          d.kind === "coin"
            ? 99999
            : d.kind === "food"
              ? Math.floor(st.capacity / 2)
              : st.capacity,
        distance = Math.hypot(d.x - p.x, d.y - p.y);
      if (d.age < 0.3) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vy += 300 * dt;
      } else if (
        distance < 160 + this.investments.level("magnet") * 40 &&
        this.s.resources[d.kind] < cap
      ) {
        const move = Math.min(distance, dt * (180 + d.age * 80));
        d.x += ((p.x - d.x) / Math.max(1, distance)) * move;
        d.y += ((p.y - d.y) / Math.max(1, distance)) * move;
        if (distance < 15) {
          this.s.resources[d.kind]++;
          this.event("pickup", p, { kind: d.kind, count: 1 });
          this.drops.splice(i, 1);
          continue;
        }
      }
      if (d.age > 45) this.drops.splice(i, 1);
    }
    if (this.s.zone < 3 && time > this.depositAt) {
      const i = this.s.zone,
        b = buildingData[i];
      if (Math.hypot(p.x - 450, p.y - b.y) < 112) {
        this.depositAt = time + 140;
        const line = this.investments.production;
        if (line.carried && this.s.progress[i].wood < b.cost.wood) {
          line.carried--;
          this.s.progress[i].wood++;
          this.investments.transfer(
            p,
            { x: 450, y: b.y },
            "plank",
            1.4 + Math.floor(line.carried / 2) * 0.22,
          );
          this.rewardConstruction(i);
          this.finishConstruction(i);
          this.event("deposit", p, { kind: "wood", index: i });
        }
        const r = (["wood", "stone", "food"] as const).find((r) =>
          deposit(this.s, i, r),
        );
        if (r) {
          this.event("deposit", p, { kind: r, index: i });
          this.rewardConstruction(i);
          this.finishConstruction(i);
        }
      }
    }
    this.crew.step(dt);
    this.investments.step(dt);
    if (this.atCamp) this.s.hp = Math.min(st.hp, this.s.hp + 18 * dt);
    else if (
      this.s.hp < st.hp * 0.5 &&
      this.s.resources.food > 0 &&
      time > this.foodAt + 500
    ) {
      this.s.resources.food--;
      this.s.hp = Math.min(st.hp, this.s.hp + 15);
      this.pop(p, "実で回復", 0xb6e7aa);
      this.foodAt = time;
    }
    if (time > this.saveAt + 3000) {
      this.saveAt = time;
      this.event("save", p);
    }
  }
}
