import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Art, palette, worldPoint, color } from "./models";

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
    art: Art,
    private game: GameModel,
    overlay: HTMLElement,
  ) {
    const { turretPoint, drillPoint, towerPoint } = game.stage.layout;
    const a = art;
    for (const [id, at] of [
      ["turret", turretPoint],
      ["drill", drillPoint],
      ["collector", towerPoint],
    ] as [Machine, Point][]) {
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
        zone: game.investments.offer(id).unlock,
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
      a.cylinder("turret-plinth", 0, 0.28, 0, 1.20, 1.45, 0.50, 0x596e76, 16),
      a.cylinder("turret-column", 0, 0.79, 0, 0.62, 0.90, 0.70, 0x925048, 12),
      a.cylinder("turret-bearing", 0, 1.17, 0, 0.91, 0.91, 0.18, 0xe5aa54, 16),
    ]);
    base.parent = turret;
    this.head = new TransformNode("rotating-turret", a.scene);
    this.head.parent = turret;
    this.head.position.y = 1.3;
    const armor = a.cylinder("turret-cast-armor", 0, 0.12, 0, 0.66, 0.90, 0.72, 0xb76548, 12);
    armor.scaling.z = 0.8;
    const hatch = a.cylinder("turret-hatch", 0, 0.49, -0.10, 0.39, 0.48, 0.12, 0xe3a55c);
    const housing = a.merge("turret-head", [
      armor,
      hatch,
      a.box("armored-front", 0, 0.02, 0.51, 1.45, 0.60, 0.26, 0x4d606c),
      a.box("optical-sight", 0, 0.44, 0.47, 0.40, 0.26, 0.43, 0x354f58),
      a.box("sight-lens", 0, 0.46, 0.69, 0.25, 0.14, 0.07, 0xffe698),
    ]);
    housing.parent = this.head;
    for (let k = 0; k < 2; k++) {
      const node = new TransformNode(`gun-${k}`, a.scene);
      node.parent = this.head;
      const sleeve = a.cylinder("cannon-sleeve", 0, 0, 0.66, 0.23, 0.30, 0.58, 0x596e79, 16);
      sleeve.rotation.x = Math.PI / 2;
      const bore = a.cylinder("cannon-bore-bottom", 0, 0, 0.93, 0.18, 0.18, 0.02, 0x172b36, 16);
      bore.rotation.x = Math.PI / 2;
      // The muzzle profile turns back inside the barrel to form a recessed bore.
      const muzzleProfile = [
        [0.23, 0.91], [0.21, 1.05], [0.21, 1.15], [0.29, 1.23],
        [0.29, 1.36], [0.25, 1.42], [0.17, 1.42], [0.15, 1.36], [0.15, 0.92],
      ];
      const muzzle = MeshBuilder.CreateLathe(
        "cannon-muzzle",
        { shape: muzzleProfile.map(([radius, z]) => new Vector3(radius, z, 0)), tessellation: 20 },
        a.scene,
      );
      muzzle.rotation.x = Math.PI / 2;
      const barrel = a.merge(`barrel-${k}`, [sleeve, bore, a.tint(muzzle, 0xc39555)]);
      barrel.parent = node;
      const flash = a.sphere(
        "muzzle-flash", 0, 0, 1.56, 0.65, 0.65, 0.85, palette.gold,
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
    const gearbox = a.cylinder("drill-gearbox", -0.18, 0.95, 0, 0.58, 0.68, 1.62, 0xe1a64b);
    gearbox.rotation.z = -Math.PI / 2;
    const guide = a.cylinder("piston-guide", 0.61, 0.95, 0, 0.32, 0.48, 0.37, 0x556b78);
    guide.rotation.z = -Math.PI / 2;
    const drillParts = [
      gearbox,
      guide,
      a.box("rear-motor", -0.85, 0.93, 0, 0.51, 1.23, 1.30, 0x556b78),
      a.box("bin-floor", 0, 0.35, -1.30, 1.70, 0.18, 0.75, 0x435e72),
      a.box("bin-front-lip", 0, 0.47, -1.64, 1.72, 0.23, 0.11, 0x799ba9),
      a.cylinder("drill-exhaust", -0.89, 1.62, 0.43, 0.11, 0.17, 0.70, palette.ink),
      a.cylinder("exhaust-rim", -0.89, 1.98, 0.43, 0.16, 0.12, 0.12, 0x799ba9),
    ];
    for (const side of [-1, 1]) {
      drillParts.push(
        a.box("anchored-skid", 0, 0.19, side * 0.72, 2.30, 0.38, 0.38, palette.ink),
        a.box("motor-bracket", -0.49, 0.58, side * 0.52, 0.65, 0.68, 0.28, 0xd08a37),
        a.box("bin-end-wall", side * 0.84, 0.49, -1.3, 0.12, 0.28, 0.68, 0x547f93),
      );
      for (const x of [-0.34, -0.08, 0.18]) {
        const vane = a.box("cooling-vane", x, 1.16, side * 0.57, 0.10, 0.38, 0.14, 0xf4cc76);
        vane.rotation.z = -0.24;
        drillParts.push(vane);
      }
    }
    const machine = a.merge("drill-chassis", drillParts);
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
    // Build along the X axis once, then spin along that axis while mining.
    const tip = a.cylinder("drill-core", 0, 0, 0, 0.025, 0.27, 1.04, 0x435e72, 16);
    tip.rotation.z = -Math.PI / 2;
    const hub = a.cylinder("drill-hub", -0.47, 0, 0, 0.31, 0.29, 0.19, 0x829daa, 16);
    hub.rotation.z = -Math.PI / 2;
    const innerEdge: Vector3[] = [];
    const cuttingEdge: Vector3[] = [];
    const backEdge: Vector3[] = [];
    for (let segment = 0; segment <= 60; segment++) {
      const progress = segment / 60;
      const angle = progress * Math.PI * 5;
      const x = -0.45 + progress * 0.90;
      const radius = 0.41 - progress * 0.35;
      const y = Math.cos(angle), z = Math.sin(angle);
      innerEdge.push(new Vector3(x + 0.035, y * radius * 0.48, z * radius * 0.48));
      cuttingEdge.push(new Vector3(x, y * radius, z * radius));
      backEdge.push(new Vector3(x - 0.035, y * radius * 0.48, z * radius * 0.48));
    }
    const blade = MeshBuilder.CreateRibbon(
      "helical-cutting-blade",
      { pathArray: [innerEdge, cuttingEdge, backEdge], sideOrientation: Mesh.DOUBLESIDE },
      a.scene,
    );
    this.drill = a.merge("rotating-drill-bit", [tip, hub, a.tint(blade, 0xbad4da)]);
    this.drill.position.set(1.55, 0.95, 0);
    this.drill.parent = miner;
    const tower = this.sites[2].root;
    const lanternProfile = [[0.37, 2.75], [0.56, 2.91], [0.56, 3.31], [0.37, 3.48]];
    const lantern = MeshBuilder.CreateLathe(
      "tower-lantern-glass",
      { shape: lanternProfile.map(([radius, y]) => new Vector3(radius, y, 0)), tessellation: 8 },
      a.scene,
    ).convertToFlatShadedMesh();
    const towerParts = [
      a.cylinder("tower-foot", 0, 0.27, 0, 0.94, 1.23, 0.54, palette.stone),
      a.cylinder("tower-conduit", 0, 1.60, 0, 0.21, 0.28, 2.14, 0x295b70),
      a.cylinder("tower-platform", 0, 2.42, 0, 0.76, 0.57, 0.27, 0x347f9a),
      a.cylinder("lantern-base", 0, 2.72, 0, 0.59, 0.66, 0.17, 0xd0a95e),
      a.tint(lantern, 0x9cf1df),
      a.cylinder("lantern-eaves", 0, 3.51, 0, 0.69, 0.71, 0.12, 0xd0a95e),
      a.cylinder("tower-roof", 0, 3.72, 0, 0.15, 0.70, 0.35, 0x347f9a),
      a.cylinder("roof-finial", 0, 3.93, 0, 0.05, 0.14, 0.18, palette.gold),
    ];
    for (let corner = 0; corner < 4; corner++) {
      const angle = Math.PI / 4 + corner * Math.PI / 2;
      const x = Math.cos(angle), z = Math.sin(angle);
      const foot = a.box("tower-anchor", x * 0.92, 0.35, z * 0.92, 0.34, 0.43, 0.43, 0x596e76);
      foot.rotation.y = -angle;
      const frame = a.box("tower-splayed-leg", x * 0.67, 1.39, z * 0.67, 0.17, 2.05, 0.22, 0x347f9a);
      frame.rotation.set(0, -angle, 0.23);
      towerParts.push(
        foot,
        frame,
        a.cylinder("lantern-cage-rib", x * 0.56, 3.11, z * 0.56, 0.055, 0.055, 0.74, 0x587f82),
      );
    }
    const body = a.merge("recovery-tower", towerParts);
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
        : `${["自動砲台", "自動採掘機", "資源回収塔"][k]} ${i.offer(site.id).price}灯貨`;
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
      if (m.drillWorking) this.drill.rotation.x = g.time / 55;
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
