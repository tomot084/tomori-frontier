import type { GameModel, Enemy } from "./simulation";
import { enemyData } from "./data";
export type RaidResult = "victory" | "failed" | "cancelled";
/** Temporary encounter borrows the existing actor pool; only best completed tier is saved. */
export class DefenseRaid {
  active = false;
  tier = 1;
  wave = 0;
  hp = 100;
  countdown = 0;
  defeated = 0;
  result: RaidResult | null = null;
  private collectClock = 0;
  private backups: Enemy[] = [];
  private actors = new Set<Enemy>();
  private lanes = new Map<Enemy, number>();
  constructor(private game: GameModel) {}
  owns(e: Enemy) {
    return this.active && this.actors.has(e);
  }
  get near() {
    const g = this.game,
      at = g.stage.raid;
    return (
      !!at &&
      g.s.zone >= at.unlock &&
      Math.hypot(g.player.x - at.x, g.player.y - at.y) < 115
    );
  }
  get laneNames() {
    const lanes = this.game.stage.raid?.lanes ?? [];
    const indices =
      this.wave === 1 ? [0] : this.wave === 2 ? [1, 2] : [0, 1, 2];
    return indices
      .map((i) => lanes[i]?.name)
      .filter(Boolean)
      .join("・");
  }
  start(tier = 1) {
    const g = this.game;
    if (
      this.active ||
      !this.near ||
      ![1, 2].includes(tier) ||
      (tier === 2 && !(g.investments.economy.raidClears ?? 0))
    )
      return false;
    this.tier = tier;
    this.wave = 1;
    this.hp = 100;
    this.defeated = 0;
    this.result = null;
    this.active = true;
    this.backups = g.enemies.slice(0, -1).map((e) => ({
      ...e,
      dead: e.dead ? Math.max(1, e.dead - g.time) : 0,
      cool: Math.max(0, e.cool - g.time),
    }));
    this.actors = new Set(g.enemies.slice(0, -1));
    for (const e of this.actors) e.dead = Number.MAX_SAFE_INTEGER;
    g.settlements.danger.until = 0;
    for (const shot of g.machines.shots) shot.active = false;
    g.investments.focus = null;
    this.countdown = 4;
    g.toast("灯標を守ろう！ 外周の敵を迎撃。中央で待つだけでは守れない");
    return true;
  }
  finish(result: RaidResult) {
    if (!this.active) return;
    const g = this.game;
    this.active = false;
    this.result = result;
    this.backups.forEach((backup, i) =>
      Object.assign(g.enemies[i], backup, {
        dead: backup.dead ? g.time + backup.dead : 0,
        cool: g.time + Math.max(1200, backup.cool),
      }),
    );
    for (const e of g.enemies.slice(0, -1))
      if (!e.dead) g.event("respawn", e, { id: e.id });
    for (const shot of g.machines.shots) shot.active = false;
    this.actors.clear();
    this.lanes.clear();
    this.backups = [];
    if (result === "victory") {
      const best = g.investments.economy.raidClears ?? 0;
      if (this.tier > best) {
        g.investments.economy.raidClears = this.tier;
        g.investments.economy.raidReward = Math.min(
          80,
          (g.investments.economy.raidReward ?? 0) + (this.tier === 1 ? 30 : 50),
        );
      }
      g.toast("防衛成功！ 戦利品を回収して次の設備へ。灯標で再挑戦できる");
      g.burst(g.stage.raid!, 0xffdd83, 16);
    } else
      g.toast(
        result === "failed"
          ? "灯標の光が消えた。設備は無事！ 外周を迎撃して再挑戦"
          : "防衛を中断。設備と素材は無事。灯標で再挑戦できる",
      );
    g.event("save", g.player);
  }
  private spawnWave() {
    const g = this.game,
      at = g.stage.raid!;
    const count = [12, 20, 28][this.wave - 1] + (this.tier - 1) * 8;
    const indices =
      this.wave === 1 ? [0] : this.wave === 2 ? [1, 2] : [0, 1, 2];
    this.lanes.clear();
    const actors = [...this.actors];
    for (let i = 0; i < count; i++) {
      const lane = indices[i % indices.length],
        origin = at.lanes[lane],
        e = actors[i];
      const type = i % 4 === 0 ? 2 : 0; // weak crowds stay readable in both worlds
      Object.assign(e, {
        x: origin.x + ((i % 3) - 1) * 16,
        y: origin.y + ((Math.floor(i / indices.length) % 4) - 1.5) * 16,
        type,
        hp: enemyData[type].hp,
        dead: 0,
        cool: 0,
        zone: at.unlock,
      });
      this.lanes.set(e, lane);
      g.event("respawn", e, { id: e.id });
    }
    g.toast(`第${this.wave}波！ ${this.laneNames}から接近。外周で迎撃！`);
  }
  step(dt: number) {
    const reward = this.game.investments.economy.raidReward ?? 0;
    this.collectClock += dt;
    if (reward && this.near && this.collectClock >= 0.08) {
      const g = this.game,
        n = Math.min(3, reward, 99999 - g.s.resources.coin);
      if (n > 0) {
        g.investments.economy.raidReward = reward - n;
        g.s.resources.coin += n;
        g.investments.transfer(g.stage.raid!, g.player, "coin", 1.3);
        g.event("pickup", g.player, { kind: "coin", count: n });
      }
      this.collectClock = 0;
    }
    if (!this.active) return;
    const g = this.game,
      at = g.stage.raid!;
    if (Math.hypot(g.player.x - at.x, g.player.y - at.y) > 440) {
      this.finish("cancelled");
      return;
    }
    if (this.countdown > 0) {
      this.countdown -= dt;
      if (this.countdown <= 0) this.spawnWave();
      return;
    }
    let alive = 0;
    for (const [e] of this.lanes) {
      if (e.dead) continue;
      alive++;
      const distance = Math.hypot(e.x - at.x, e.y - at.y);
      const siegeRadius = this.tier === 1 ? 160 : 180;
      if (distance > siegeRadius) {
        const speed =
          (this.tier === 1 ? 94 : 112) * g.settlements.enemySpeed(e);
        const move = Math.min(distance - siegeRadius, speed * dt);
        e.x += ((at.x - e.x) / distance) * move;
        e.y += ((at.y - e.y) / distance) * move;
      } else if (g.time > e.cool) {
        e.cool = g.time + (this.tier === 1 ? 1300 : 1900);
        this.hp = Math.max(0, this.hp - (this.tier === 1 ? 1 : 2));
        g.event("flow", e, {
          toX: at.x,
          toY: at.y,
          kind: "coin",
          height: 0.8,
          toHeight: 1.4,
        });
      }
    }
    if (!this.hp) {
      this.finish("failed");
      return;
    }
    this.defeated = [...this.lanes.keys()].filter((e) => e.dead).length;
    if (!alive) {
      if (this.wave === 3) this.finish("victory");
      else {
        this.wave++;
        this.countdown = 4;
        this.lanes.clear();
      }
    }
  }
  metrics() {
    return {
      active: this.active,
      tier: this.tier,
      wave: this.wave,
      hp: this.hp,
      countdown: this.countdown,
      lanes: this.laneNames,
      alive: [...this.lanes.keys()].filter((e) => !e.dead).length,
      result: this.result,
      best: this.game.investments.economy.raidClears ?? 0,
    };
  }
}
