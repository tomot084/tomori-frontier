import { gatherableData, resourceData, stats, type Resource } from "./data";
import { drillPoint, turretPoint, towerPoint } from "./investments";
import type { GameModel, Enemy } from "./simulation";
export interface Shot {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}
/** A fixed projectile pool; collision along the travelled segment prevents tunnelling. */
export class WorldMachines {
  shots: Shot[] = Array.from({ length: 24 }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
  }));
  heading = 0;
  twinHeading = 0;
  fireClock = 0;
  firedAt = -1000;
  fired = 0;
  hits = 0;
  kills = 0;
  drillClock = 0;
  drillWorking = false;
  drilledAt = -1000;
  collectClock = 0;
  constructor(private game: GameModel) {}
  get range() {
    return this.game.investments.machine("turretReach") ? 250 : 180;
  }
  fire(target: Enemy, side: number) {
    const shot = this.shots.find((s) => !s.active);
    if (!shot) return;
    const angle = Math.atan2(
      target.x - turretPoint.x,
      -(target.y - turretPoint.y),
    );
    const dx = Math.sin(angle),
      dy = -Math.cos(angle);
    Object.assign(shot, {
      active: true,
      x: turretPoint.x + dx * 44 + Math.cos(angle) * side,
      y: turretPoint.y + dy * 44 + Math.sin(angle) * side,
      vx: dx * 560,
      vy: dy * 560,
      life: 0.65,
    });
    this.firedAt = this.game.time;
    this.fired++;
    if (
      Math.hypot(this.game.player.x - shot.x, this.game.player.y - shot.y) < 550
    )
      this.game.event("shot", shot, { kind: "enemy" });
    this.game.burst({ x: shot.x, y: shot.y }, 0xffdd83, 2);
  }
  step(dt: number) {
    const g = this.game,
      i = g.investments,
      e = i.economy;
    const capacity = stats(g.s).capacity;
    for (const s of this.shots) {
      if (!s.active) continue;
      const nx = s.x + s.vx * dt,
        ny = s.y + s.vy * dt;
      let struck: Enemy | undefined,
        best = Infinity;
      const sx = nx - s.x,
        sy = ny - s.y,
        length = sx * sx + sy * sy;
      for (const enemy of g.enemies) {
        if (enemy.dead || enemy.zone > g.s.zone) continue;
        const t = Math.max(
          0,
          Math.min(
            1,
            ((enemy.x - s.x) * sx + (enemy.y - s.y) * sy) / Math.max(1, length),
          ),
        );
        if (
          t < best &&
          Math.hypot(enemy.x - s.x - sx * t, enemy.y - s.y - sy * t) < 15
        ) {
          struck = enemy;
          best = t;
        }
      }
      s.x = nx;
      s.y = ny;
      s.life -= dt;
      if (struck) {
        g.damageEnemy(struck, 2);
        this.hits++;
        if (struck.dead) this.kills++;
      }
      if (struck || s.life <= 0) s.active = false;
    }
    if (i.machine("turret") && g.s.zone >= 1) {
      this.fireClock += dt;
      let target: Enemy | undefined,
        second: Enemy | undefined,
        nearest = Infinity,
        next = Infinity;
      for (const enemy of g.enemies) {
        if (enemy.dead || enemy.zone !== 1) continue;
        const distance = Math.hypot(
          enemy.x - turretPoint.x,
          enemy.y - turretPoint.y,
        );
        if (distance >= this.range) continue;
        if (distance < nearest) {
          second = target;
          next = nearest;
          target = enemy;
          nearest = distance;
        } else if (distance < next) {
          second = enemy;
          next = distance;
        }
      }
      if (second)
        this.twinHeading = Math.atan2(
          second.x - turretPoint.x,
          -(second.y - turretPoint.y),
        );
      if (target) {
        const angle = Math.atan2(
          target.x - turretPoint.x,
          -(target.y - turretPoint.y),
        );
        const diff = Math.atan2(
          Math.sin(angle - this.heading),
          Math.cos(angle - this.heading),
        );
        this.heading += Math.sign(diff) * Math.min(Math.abs(diff), dt * 5);
        if (this.fireClock >= 0.65 && Math.abs(diff) < 0.18) {
          this.fireClock = 0;
          this.fire(target, i.machine("turretTwin") ? -10 : 0);
          if (i.machine("turretTwin") && second) this.fire(second, 10);
        }
      }
    }
    const rock = g.nodes.find((n) => n.id === "node-1-13");
    this.drillWorking = !!(
      i.machine("drill") &&
      rock &&
      !rock.dead &&
      (e.drillStock ?? 0) +
        gatherableData.stone.yield +
        i.resourceBonus("stone") <=
        500
    );
    if (this.drillWorking && rock) {
      this.drillClock += dt;
      if (this.drillClock >= 0.8) {
        this.drillClock = 0;
        rock.hp -= 3;
        g.event("hit", rock, { id: rock.id, kind: "stone" });
        g.burst(rock, resourceData.stone.color, 3);
        if (rock.hp <= 0) {
          const amount = gatherableData.stone.yield + i.resourceBonus("stone");
          e.drillStock = Math.min(500, (e.drillStock ?? 0) + amount);
          rock.dead = g.time + gatherableData.stone.respawn * 1000;
          g.event("death", rock, { id: rock.id, kind: "stone" });
          for (let k = 0; k < 3; k++)
            i.transfer(rock, drillPoint, "stone", 0.8, 0.45 + k * 0.22);
          this.drilledAt = g.time;
        }
      }
    }
    if (i.machine("collector")) {
      e.towerStock ??= {};
      for (let k = g.drops.length - 1; k >= 0; k--) {
        const d = g.drops[k],
          stored = e.towerStock[d.kind] ?? 0;
        const distance = Math.hypot(d.x - towerPoint.x, d.y - towerPoint.y);
        if (d.age < 0.3 || distance > 240 || stored >= 2000) continue;
        const playerCap =
          d.kind === "coin"
            ? 99999
            : d.kind === "food"
              ? Math.floor(capacity / 2)
              : capacity;
        const toPlayer = Math.hypot(d.x - g.player.x, d.y - g.player.y);
        if (
          g.s.resources[d.kind] < playerCap &&
          toPlayer <= Math.min(distance, 230 + i.level("magnet") * 40)
        )
          continue;
        // Pull in the real pickups; no invisible periodic resource grant.
        const travel = Math.min(distance, dt * 420);
        d.x += ((towerPoint.x - d.x) / Math.max(1, distance)) * travel;
        d.y += ((towerPoint.y - d.y) / Math.max(1, distance)) * travel;
        if (distance < 18) {
          const amount = Math.min(d.amount, 2000 - stored);
          e.towerStock[d.kind] = stored + amount;
          d.amount -= amount;
          if (!d.amount) g.drops.splice(k, 1);
          g.burst(towerPoint, resourceData[d.kind].color, 1);
        }
      }
    }
    this.collectClock += dt;
    if (this.collectClock < 0.08) return;
    this.collectClock = 0;
    const receive = (
      kind: Resource,
      stored: number,
      at: { x: number; y: number },
    ) => {
      if (Math.hypot(g.player.x - at.x, g.player.y - at.y) > 75) return 0;
      const cap =
        kind === "coin"
          ? 99999
          : kind === "food"
            ? Math.floor(capacity / 2)
            : capacity;
      const n = Math.min(stored, cap - g.s.resources[kind], 4);
      if (n <= 0) return 0;
      g.s.resources[kind] += n;
      i.transfer(at, g.player, kind, 0.7);
      g.event("pickup", g.player, { kind, count: n });
      return n;
    };
    if (i.machine("drill"))
      e.drillStock =
        (e.drillStock ?? 0) - receive("stone", e.drillStock ?? 0, drillPoint);
    if (i.machine("collector"))
      for (const kind of Object.keys(resourceData) as Resource[]) {
        const stock = e.towerStock?.[kind] ?? 0;
        e.towerStock![kind] = stock - receive(kind, stock, towerPoint);
      }
  }
  metrics() {
    return {
      fired: this.fired,
      hits: this.hits,
      kills: this.kills,
      heading: this.heading,
      projectiles: this.shots.filter((s) => s.active).length,
      pool: this.shots.length,
      drillWorking: this.drillWorking,
      drillStock: this.game.investments.economy.drillStock ?? 0,
      towerStock: this.game.investments.economy.towerStock ?? {},
    };
  }
}
