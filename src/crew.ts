import { buildingData, gatherableData } from "./data";
import type { GameModel, Point } from "./simulation";
export interface LanternWorker extends Point {
  id: number;
  active: boolean;
  zone: number;
  phase: "search" | "walk" | "harvest" | "deliver" | "rest";
  kind: "wood" | "stone";
  cargo: number;
  targetId: string;
  clock: number;
  heading: number;
}
/** Building unlocks a visible harvesting/delivery loop; player inventory is never spent. */
export class LanternCrew {
  workers: LanternWorker[] = [0, 1].map((id) => ({
    id,
    active: false,
    zone: -1,
    phase: "search",
    kind: "wood",
    x: 690,
    y: 940,
    cargo: 0,
    targetId: "",
    clock: 0,
    heading: 0,
  }));
  constructor(private game: GameModel) {}
  step(dt: number) {
    const g = this.game,
      zone = g.s.zone;
    for (const w of this.workers) {
      if (g.s.zone !== zone) break;
      w.active = zone > w.id && zone < 3;
      if (!w.active) continue;
      if (w.zone !== zone) {
        Object.assign(w, {
          zone,
          x: 690,
          y: 940 + (zone - 1) * 550,
          phase: "search",
          cargo: 0,
          clock: 0,
          targetId: "",
        });
      }
      const b = buildingData[zone],
        progress = g.s.progress[zone];
      const walk = (p: Point) => {
        const dx = p.x - w.x,
          dy = p.y - w.y,
          d = Math.hypot(dx, dy);
        w.heading = Math.atan2(dx, -dy);
        const amount = Math.min(d, dt * 155);
        if (d > 0) {
          w.x += (dx / d) * amount;
          w.y += (dy / d) * amount;
        }
        return d < 12;
      };
      if (w.phase === "search" || w.phase === "rest") {
        w.clock -= dt;
        if (w.clock > 0) continue;
        const kinds = (["wood", "stone"] as const)
          .filter((k) => progress[k] < b.cost[k])
          .sort((a, c) => progress[a] / b.cost[a] - progress[c] / b.cost[c]);
        if (w.id === 1 && kinds.includes("stone"))
          kinds.sort((k) => (k === "stone" ? -1 : 1));
        const nodes = g.nodes.filter(
          (n) =>
            kinds.includes(n.kind as "wood" | "stone") &&
            n.kind !== "food" &&
            n.zone === zone &&
            !n.dead &&
            Math.hypot(n.x - g.player.x, n.y - g.player.y) > 115 &&
            !this.workers.some(
              (other) => other !== w && other.active && other.targetId === n.id,
            ),
        );
        nodes.sort(
          (a, c) =>
            kinds.indexOf(a.kind as "wood" | "stone") -
              kinds.indexOf(c.kind as "wood" | "stone") ||
            Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(c.x - w.x, c.y - w.y),
        );
        const n = nodes[0];
        if (!n) {
          w.phase = "rest";
          w.clock = 1;
          continue;
        }
        w.targetId = n.id;
        w.kind = n.kind as "wood" | "stone";
        w.phase = "walk";
      }
      if (w.phase === "walk" || w.phase === "harvest") {
        const n = g.nodes.find((n) => n.id === w.targetId)!;
        if (n.dead) {
          w.phase = "search";
          w.targetId = "";
          continue;
        }
        if (w.phase === "walk") {
          if (walk(n)) {
            w.phase = "harvest";
            w.clock = 0;
          }
        } else {
          w.clock += dt;
          if (w.clock >= (w.kind === "wood" ? 1.8 : 2.3)) {
            n.hp = 0;
            n.dead = g.time + gatherableData[n.kind].respawn * 1000;
            w.cargo = gatherableData[n.kind].yield;
            g.event("death", n, { id: n.id, kind: n.kind });
            g.burst(n, w.kind === "wood" ? 0xe4b577 : 0xbcd9db, 5);
            w.targetId = "";
            w.phase = "deliver";
            w.clock = 0;
          }
        }
      } else if (w.phase === "deliver" && walk({ x: 450, y: b.y - 45 })) {
        w.clock += dt;
        if (w.clock >= 0.18) {
          w.clock = 0;
          if (progress[w.kind] < b.cost[w.kind]) {
            progress[w.kind]++;
            g.event("deposit", w, { kind: w.kind, index: zone });
            g.rewardConstruction(zone);
            g.finishConstruction(zone);
          } else g.spawn(w, w.kind, 1);
          if (--w.cargo <= 0) {
            w.phase = "rest";
            w.clock = 0.8;
            g.event("save", w);
          }
        }
      }
    }
  }
}
