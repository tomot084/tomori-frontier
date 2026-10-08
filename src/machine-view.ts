import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Art, palette, worldPoint, color } from "./models";
import { turretPoint, drillPoint, towerPoint } from "./investments";
import type { GameModel, Point } from "./simulation";
import type { Machine } from "./data";
interface Site {
  id: Machine;
  at: Point;
  zone: number;
  foundation: Mesh;
  root: TransformNode;
  owned: boolean;
  builtAt: number;
}
/** Static merged chassis, small moving parts, and fixed instance pools; no extra shadow casters. */
export class MachineView {
  sites: Site[] = [];
  head: TransformNode;
  barrels: TransformNode[] = [];
  muzzle: Mesh[] = [];
  antenna: Mesh;
  piston: Mesh;
  drill: Mesh;
  crown: TransformNode;
  ring: Mesh;
  bullets: InstancedMesh[] = [];
  stones: InstancedMesh[] = [];
  crates: InstancedMesh[] = [];
  labels: HTMLElement[] = [];
  constructor(
    private art: Art,
    private game: GameModel,
    overlay: HTMLElement,
  ) {
    const a = art;
    for (const [id, at, zone] of [
      ["turret", turretPoint, 1],
      ["drill", drillPoint, 1],
      ["collector", towerPoint, 2],
    ] as [Machine, Point, number][]) {
      const parts = [
        a.box(`${id}-foundation`, 0, 0.12, 0, 2.7, 0.24, 2.7, palette.stone),
      ];
      for (const x of [-1, 1])
        for (const z of [-1, 1]) {
          parts.push(
            a.cylinder(
              "construction-bolt",
              x,
              0.36,
              z,
              0.09,
              0.09,
              0.3,
              palette.gold,
            ),
          );
        }
      if (id === "turret") {
        parts.push(
          a.cylinder(
            "unfinished-turret-ring",
            0,
            0.33,
            0,
            0.82,
            1,
            0.25,
            palette.ink,
          ),
        );
        parts.push(
          a.box(
            "barrel-blueprint",
            0,
            0.55,
            0.5,
            0.24,
            0.24,
            1.6,
            palette.stoneLight,
          ),
        );
      } else if (id === "drill") {
        for (const x of [-0.7, 0.7])
          parts.push(
            a.box("drill-anchor-frame", x, 0.5, 0, 0.15, 0.8, 1.7, palette.ink),
          );
        parts.push(
          a.box(
            "drill-guide-rail",
            1.2,
            0.32,
            0,
            1.8,
            0.13,
            0.2,
            palette.stoneLight,
          ),
        );
      } else {
        parts.push(
          a.cylinder(
            "unfinished-tower-socket",
            0,
            0.55,
            0,
            0.44,
            0.7,
            0.8,
            palette.ink,
          ),
        );
        for (const x of [-0.6, 0.6])
          parts.push(
            a.box(
              "tower-folded-mast",
              x,
              0.32,
              0,
              0.18,
              0.15,
              1.9,
              palette.teal,
            ),
          );
      }
      const foundation = a.merge(`planned-${id}`, parts);
      foundation.position.copyFrom(worldPoint(at.x, at.y));
      const root = new TransformNode(`built-${id}`, a.scene);
      root.position.copyFrom(worldPoint(at.x, at.y));
      const owned = !!game.investments.machine(id);
      this.sites.push({
        id,
        at,
        zone,
        foundation,
        root,
        owned,
        builtAt: -10000,
      });
      const label = document.createElement("div");
      label.className = "line-label";
      overlay.append(label);
      this.labels.push(label);
    }
    const turret = this.sites[0].root;
    const base = a.merge("turret-chassis", [
      a.cylinder("turret-plinth", 0, 0.28, 0, 1.2, 1.45, 0.5, palette.stone),
      a.cylinder("turret-column", 0, 0.79, 0, 0.58, 0.85, 0.7, palette.teal),
      a.cylinder("turret-bearing", 0, 1.17, 0, 0.88, 0.88, 0.14, palette.gold),
    ]);
    base.parent = turret;
    this.head = new TransformNode("rotating-turret", a.scene);
    this.head.parent = turret;
    this.head.position.y = 1.3;
    const housing = a.merge("turret-head", [
      a.box("gun-housing", 0, 0, 0, 1.45, 0.65, 1, palette.teal),
      a.box("turret-roof", 0, 0.39, 0, 1.65, 0.14, 1.2, palette.cream),
      a.box("lamp-sight", 0, 0.25, 0.53, 0.26, 0.18, 0.13, palette.gold),
    ]);
    housing.parent = this.head;
    for (let k = 0; k < 2; k++) {
      const node = new TransformNode(`gun-${k}`, a.scene);
      node.parent = this.head;
      const barrel = a.merge(`barrel-${k}`, [
        a.box("gun-barrel", 0, 0, 0.83, 0.32, 0.32, 1.6, palette.ink),
        a.box("barrel-band", 0, 0, 1.25, 0.39, 0.39, 0.18, palette.gold),
        a.box("barrel-muzzle", 0, 0, 1.64, 0.19, 0.19, 0.05, 0x172b36),
      ]);
      barrel.parent = node;
      const flash = a.sphere(
        "muzzle-flash",
        0,
        0,
        1.86,
        0.65,
        0.65,
        0.85,
        palette.gold,
      );
      flash.parent = node;
      this.muzzle.push(flash);
      this.barrels.push(node);
    }
    this.antenna = a.merge("range-antenna", [
      a.box("antenna-mast", 0.65, 0.75, -0.25, 0.1, 1.2, 0.1, palette.gold),
      a.box(
        "antenna-crossbar",
        0.65,
        1.23,
        -0.25,
        0.8,
        0.09,
        0.09,
        palette.cream,
      ),
      a.sphere(
        "antenna-light",
        0.65,
        1.45,
        -0.25,
        0.23,
        0.23,
        0.23,
        palette.gold,
      ),
    ]);
    this.antenna.parent = this.head;
    const miner = this.sites[1].root;
    const machine = a.merge("drill-chassis", [
      a.box("drill-feet", 0, 0.2, 0, 2.3, 0.4, 1.85, palette.ink),
      a.box("drill-engine", -0.3, 0.95, 0, 1.6, 1.3, 1.3, palette.teal),
      a.box("drill-roof", -0.3, 1.7, 0, 1.85, 0.2, 1.6, palette.gold),
      a.box("stone-output-bin", 0, 0.38, -1.2, 1.8, 0.65, 0.6, palette.wood),
      a.box("drill-exhaust", -0.8, 1.75, 0.45, 0.2, 0.9, 0.2, palette.ink),
    ]);
    machine.parent = miner;
    this.piston = a.box(
      "mining-piston",
      0.9,
      0.95,
      0,
      1.3,
      0.24,
      0.24,
      palette.stoneLight,
    );
    this.piston.parent = miner;
    this.drill = a.cylinder(
      "rotating-drill-bit",
      1.55,
      0.95,
      0,
      0.02,
      0.35,
      0.65,
      palette.ink,
    );
    this.drill.rotation.z = -Math.PI / 2;
    this.drill.parent = miner;
    const tower = this.sites[2].root;
    const body = a.merge("recovery-tower", [
      a.cylinder("tower-foot", 0, 0.3, 0, 1, 1.25, 0.6, palette.stone),
      a.cylinder("tower-mast", 0, 1.5, 0, 0.3, 0.55, 2.4, palette.teal),
      a.cylinder("tower-collar", 0, 2.7, 0, 0.8, 0.8, 0.2, palette.gold),
      a.sphere("tower-lantern", 0, 3, 0, 0.9, 0.9, 0.9, palette.gold),
      a.cylinder("tower-roof", 0, 3.55, 0, 0, 1, 0.5, palette.teal),
    ]);
    body.parent = tower;
    this.crown = new TransformNode("tower-intake-rotor", a.scene);
    this.crown.parent = tower;
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const fin = a.box(
        "intake-fin",
        Math.cos(angle) * 0.9,
        2.55,
        Math.sin(angle) * 0.9,
        0.5,
        0.16,
        0.22,
        palette.cream,
      );
      fin.rotation.y = -angle;
      fin.parent = this.crown;
    }
    this.ring = MeshBuilder.CreateTorus(
      "visible-recovery-radius",
      { diameter: 12, thickness: 0.04, tessellation: 64 },
      a.scene,
    );
    const glow = new StandardMaterial("recovery-glow", a.scene);
    glow.diffuseColor = color(palette.teal);
    glow.emissiveColor = color(0x528b80);
    glow.alpha = 0.65;
    this.ring.material = glow;
    this.ring.parent = tower;
    this.ring.position.y = 0.1;
    this.ring.isPickable = false;
    const bullet = a.sphere(
      "bullet-source",
      0,
      0,
      0,
      0.26,
      0.26,
      0.6,
      palette.gold,
    );
    bullet.setEnabled(false);
    for (let k = 0; k < game.machines.shots.length; k++) {
      const instance = bullet.createInstance(`pooled-turret-bullet-${k}`);
      instance.isPickable = false;
      instance.setEnabled(false);
      this.bullets.push(instance);
    }
    for (const [kind, count, pool, parent] of [
      ["stone", 24, this.stones, miner],
      ["wood", 24, this.crates, tower],
    ] as [string, number, InstancedMesh[], TransformNode][]) {
      const source =
        kind === "stone"
          ? a.resource("stone", "mined-stone-source")
          : a.box("tower-crate-source", 0, 0, 0, 0.5, 0.5, 0.5, palette.wood);
      source.setEnabled(false);
      for (let k = 0; k < count; k++) {
        const item = source.createInstance(`${kind}-stored-${k}`);
        item.parent = parent;
        item.isPickable = false;
        item.position.set(
          ((k % 4) - 1.5) * 0.35,
          0.5 + Math.floor(k / 8) * 0.28,
          kind === "stone"
            ? -1.2 + Math.floor((k % 8) / 4) * 0.22
            : -1.7 - Math.floor((k % 8) / 4) * 0.4,
        );
        item.setEnabled(false);
        pool.push(item);
      }
    }
  }
  update(
    place: (element: HTMLElement, at: Vector3, visible: boolean) => unknown,
  ) {
    const g = this.game,
      m = g.machines,
      i = g.investments;
    for (let k = 0; k < this.sites.length; k++) {
      const site = this.sites[k],
        owned = !!i.machine(site.id),
        distance = Math.hypot(g.player.x - site.at.x, g.player.y - site.at.y);
      if (owned && !site.owned) site.builtAt = g.time;
      site.owned = owned;
      const visible = site.zone <= g.s.zone && distance < 550;
      site.foundation.setEnabled(visible && !owned);
      site.root.setEnabled(visible && owned);
      const phase = Math.max(0, Math.min(1, (g.time - site.builtAt) / 700));
      site.root.scaling.setAll(0.15 + phase * 0.85);
      this.labels[k].textContent = owned
        ? site.id === "drill"
          ? `石材 ${i.economy.drillStock ?? 0} / 500`
          : site.id === "collector"
            ? `保管 ${Object.values(i.economy.towerStock ?? {}).reduce((a, n) => a + (n ?? 0), 0)}`
            : "自動砲台"
        : `${["自動砲台 150", "自動採掘機 120", "資源回収塔 140"][k]}灯貨`;
      place(
        this.labels[k],
        worldPoint(site.at.x, site.at.y + 44, 0.3),
        visible && distance < 90,
      );
    }
    this.head.rotation.y = m.heading;
    const twin = !!i.machine("turretTwin");
    this.barrels[0].position.x = twin ? -0.38 : 0;
    this.barrels[1].position.x = 0.38;
    this.barrels[1].setEnabled(twin);
    this.barrels[1].rotation.y = m.twinHeading - m.heading;
    this.antenna.setEnabled(!!i.machine("turretReach"));
    const recoil = Math.max(0, 1 - (g.time - m.firedAt) / 120);
    this.barrels.forEach((b) => (b.position.z = -recoil * 0.18));
    this.muzzle.forEach((f) => f.setEnabled(g.time - m.firedAt < 85));
    if (this.sites[1].root.isEnabled()) {
      const stroke = m.drillWorking
        ? Math.sin((m.drillClock / 0.8) * Math.PI * 2) * 0.18
        : 0;
      this.piston.position.x = 0.9 + stroke;
      this.drill.position.x = 1.55 + stroke;
      this.drill.rotation.y = m.drillWorking ? g.time / 55 : 0;
      const amount = i.economy.drillStock ?? 0;
      this.stones.forEach((stone, k) =>
        stone.setEnabled(k < Math.min(24, Math.ceil(amount / 4))),
      );
    }
    if (this.sites[2].root.isEnabled()) {
      this.crown.rotation.y = g.time / 800;
      this.ring.visibility = 0.7 + Math.sin(g.time / 400) * 0.2;
      const amount = Object.values(i.economy.towerStock ?? {}).reduce(
        (a, n) => a + (n ?? 0),
        0,
      );
      this.crates.forEach((crate, k) =>
        crate.setEnabled(k < Math.min(24, Math.ceil(amount / 10))),
      );
    }
    for (let k = 0; k < this.bullets.length; k++) {
      const shot = m.shots[k],
        bullet = this.bullets[k];
      bullet.setEnabled(
        shot.active &&
          Math.hypot(shot.x - g.player.x, shot.y - g.player.y) < 550,
      );
      if (!shot.active) continue;
      bullet.position.copyFrom(worldPoint(shot.x, shot.y, 1.3));
      bullet.rotation.y = Math.atan2(shot.vx, -shot.vy);
    }
  }
}
