import "@babylonjs/core/Meshes/thinInstanceMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Art, palette, worldPoint } from "./models";

import type { GameModel, GameEvent, Point } from "./simulation";
/** Fixed instance pools. Inventory and animated transfers never allocate geometry per item. */
export class ProductionView {
  sources: Record<string, Mesh>;
  piles: { mesh: Mesh; kind: string; at: Point }[] = [];
  flights: {
    mesh: InstancedMesh;
    kind: string;
    age: number;
    from: Vector3;
    to: Vector3;
    life: number;
  }[] = [];
  conveyor: TransformNode;
  slats: InstancedMesh[] = [];
  chevrons: InstancedMesh[] = [];
  lamps: Mesh[] = [];
  fastMotor: Mesh;
  beltTravel = 0;
  saw: Mesh;
  workpiece: InstancedMesh;
  finishedPiece: InstancedMesh;
  labels: HTMLElement[] = [];
  constructor(
    art: Art,
    private game: GameModel,
    overlay: HTMLElement,
  ) {
    const { inputPoint, outputPoint, sawPoint, tillPoint, marketPoint } =
      game.stage.layout;
    this.sources = {
      wood: art.log("production-log-source"),
      plank: art.plank("production-plank-source"),
      brick: art.brick("production-brick-source"),
      stone: art.resource("stone", "production-stone-source"),
      food: art.resource("food", "production-food-source"),
      coin: art.resource("coin", "production-coin-source"),
    };
    for (const m of Object.values(this.sources)) {
      m.setEnabled(false);
      m.receiveShadows = false;
    }
    for (const [kind, at] of [
      ["wood", inputPoint],
      ["plank", outputPoint],
      ["plank", { x: marketPoint.x - 40, y: marketPoint.y + 15 }],
      ["coin", tillPoint],
    ] as [string, Point][]) {
      const mesh = this.sources[kind].clone(`pile-${this.piles.length}`)!;
      mesh.makeGeometryUnique();
      mesh.isVisible = true;
      mesh.visibility = 1;
      const matrices = new Float32Array(100 * 16);
      const cols = kind === "coin" ? 5 : 2;
      for (let i = 0; i < 100; i++) {
        const row = Math.floor(i / cols);
        const along = kind === "coin" ? 0.38 : kind === "wood" ? 0.88 : 1.14;
        const across = kind === "coin" ? 0.24 : kind === "wood" ? 0.38 : 0.39;
        Matrix.Translation(
          ((i % cols) - (cols - 1) / 2) * along,
          (kind === "coin" ? 1.05 : 1.1) +
            Math.floor(row / 4) * (kind === "wood" ? 0.36 : 0.18),
          ((row % 4) - 1.5) * across,
        ).copyToArray(matrices, i * 16);
      }
      mesh.position.copyFrom(
        worldPoint(at.x, at.y - (kind === "wood" ? 50 : 0)),
      );
      if (kind === "wood") mesh.rotation.y = Math.PI / 2;
      if (kind === "coin") mesh.scaling.setAll(1.15);
      else mesh.scaling.setAll(kind === "wood" ? 1.45 : 1.25);
      mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
      mesh.thinInstanceCount = 0;
      mesh.setEnabled(false);
      mesh.alwaysSelectAsActiveMesh = true;
      this.piles.push({ mesh, kind, at });
      const fittings: Mesh[] = [];
      if (kind === "wood") {
        for (const x of [-1.05, 1.05]) {
          fittings.push(
            art.box(
              "log-cradle-foot",
              x,
              0.2,
              0,
              0.2,
              0.25,
              1.65,
              palette.wood,
            ),
          );
          for (const z of [-0.75, 0.75])
            fittings.push(
              art.box(
                "log-cradle-upright",
                x,
                0.68,
                z,
                0.17,
                1.2,
                0.17,
                palette.wood,
              ),
            );
        }
        // Keep empty stock racks honest: mark the intake without fake logs.
        fittings.push(
          art.box("raw-intake-marker", 0, 0.22, -0.84, 2.2, 0.18, 0.14, 0xd28d46),
        );
      } else if (kind === "plank") {
        for (const z of [-0.6, 0.6])
          fittings.push(
            art.box(
              "lumber-bearer",
              0,
              0.18,
              z,
              2.15,
              0.25,
              0.19,
              palette.wood,
            ),
          );
        // The live plank pile is the only inventory representation.
        // A contrasting end rail identifies the empty output rack.
        fittings.push(
          art.box("processed-output-marker", 0, 0.22, -0.84, 2.2, 0.18, 0.14, 0x218e91),
        );
      } else {
        fittings.push(
          art.box("coin-till", 0, 0.55, 0, 1.2, 1, 0.85, palette.teal),
        );
        fittings.push(
          art.box("till-slot", 0, 1.07, 0, 0.6, 0.04, 0.13, palette.ink),
        );
        const emblem = art.resource("coin", "till-coin-emblem");
        emblem.scaling.setAll(2.6);
        emblem.position.set(0, 0.68, -0.46);
        fittings.push(emblem);
      }
      const base = art.merge("stock-rack-" + kind, fittings);
      base.position.copyFrom(
        worldPoint(at.x, at.y - (kind === "wood" ? 50 : 0)),
      );
      const label = document.createElement("div");
      label.className = "line-label";
      overlay.append(label);
      this.labels.push(label);
    }
    this.workpiece = this.sources.wood.createInstance("belt-timber");
    this.workpiece.setEnabled(false);
    this.finishedPiece = this.sources.plank.createInstance(
      "sawn-board-on-outfeed",
    );
    this.finishedPiece.scaling.setAll(1.5);
    this.finishedPiece.setEnabled(false);
    // Small physical chevrons live on the roller table, never on a text floor panel.
    for (const offset of [-1.25, 1.25]) {
      for (const side of [-1, 1]) {
        const arrow = art.box(
          "feed-direction-inlay",
          offset,
          1.03,
          -0.46 + side * 0.075,
          0.25,
          0.035,
          0.055,
          palette.gold,
        );
        arrow.rotation.y = side * -0.65;
        arrow.position.addInPlace(worldPoint(sawPoint.x, sawPoint.y));
      }
    }
    this.conveyor = new TransformNode("purchased-conveyor", art.scene);
    const belt = art.merge("charcoal-belt", [
      art.box("rubber-belt", 0, 0.72, 0, 4.8, 0.30, 1.85, 0x293f48),
      art.box("belt-lower-return", 0, 0.36, 0, 4.58, 0.18, 1.60, 0x344c56),
      art.box("belt-steel-frame", 0, 0.51, -0.94, 4.65, 0.28, 0.19, 0x6e9299),
      art.box("belt-steel-frame", 0, 0.51, 0.94, 4.65, 0.28, 0.19, 0x6e9299),
      ...[-1.55, 0, 1.55].flatMap(x =>
        [-0.72, 0.72].flatMap(z => [
          art.box("belt-support-leg", x, 0.05, z, 0.22, 0.70, 0.24, 0x466975),
          art.box("belt-support-foot", x, -0.31, z, 0.45, 0.13, 0.38, 0x344851),
        ])),
    ]);
    belt.parent = this.conveyor;
    const slatSource = art.box(
      "belt-slat-source",
      0,
      0.9,
      0,
      0.13,
      0.05,
      1.75,
      0x749194,
    );
    slatSource.setEnabled(false);
    for (let i = 0; i < 24; i++) {
      const m = slatSource.createInstance(`belt-slat-${i}`);
      m.position.set(i * 0.2 - 2.3, 0.9, 0);
      m.parent = this.conveyor;
      m.isPickable = false;
      this.slats.push(m);
    }
    for (const z of [-1, 1]) {
      const rails = [art.box("belt-rail", 0, 0.9, z, 4.95, 0.20, 0.19, 0xe6a94b)];
      for (const x of [-2.0,-1.0,0,1.0,2.0])
        rails.push(art.cylinder("rail-bolt", x, 1.012, z, 0.065, 0.065, 0.045, 0x526e79, 8));
      const rail = art.merge("belt-side-rail", rails);
      rail.parent = this.conveyor;
    }
    // Wide roller chassis and repeated left-pointing chevrons make the feed readable at phone scale.
    for (const x of [-2.3, 2.3]) {
      const roller = art.cylinder(
        "conveyor-end-roller",
        x,
        0.72,
        0,
        0.23,
        0.23,
        1.85,
        palette.ink,
      );
      roller.rotation.x = Math.PI / 2;
      roller.parent = this.conveyor;
      for (const z of [-0.7, 0.7]) {
        const foot = art.box(
          "conveyor-leg",
          x,
          0.15,
          z,
          0.18,
          1.1,
          0.18,
          palette.stone,
        );
        foot.parent = this.conveyor;
      }
    }
    const arrowParts = [-1, 1].map((side) => {
      const arrow = art.box(
        "feed-chevron-half",
        0,
        0.94,
        side * 0.24,
        0.59,
        0.045,
        0.15,
        0xffdf8e,
      );
      arrow.rotation.y = side * -0.65;
      return arrow;
    });
    const arrowSource = art.merge("feed-chevron-source", arrowParts);
    arrowSource.setEnabled(false);
    for (let k = 0; k < 6; k++) {
      const arrow = arrowSource.createInstance(`moving-feed-chevron-${k}`);
      arrow.parent = this.conveyor;
      arrow.isPickable = false;
      this.chevrons.push(arrow);
    }
    for (const z of [-1.06, 1.06]) {
      const lamp = art.box(
        "belt-running-lamp",
        1.2,
        1.05,
        z,
        0.16,
        0.18,
        0.22,
        palette.gold,
      );
      lamp.parent = this.conveyor;
      this.lamps.push(lamp);
    }
    const fast = art.merge("fast-conveyor-motor", [
      art.box("belt-turbo-motor", 0, 0.6, 1.23, 1.2, 0.7, 0.5, palette.gold),
      art.box("motor-top", 0, 1.02, 1.23, 0.7, 0.12, 0.55, palette.ink),
      art.box("speed-stripe", 0, 0.66, 1.51, 0.85, 0.16, 0.04, palette.cream),
    ]);
    fast.parent = this.conveyor;
    this.fastMotor = fast;
    this.conveyor.position.copyFrom(worldPoint(sawPoint.x, inputPoint.y, 0.4));
    this.conveyor.setEnabled(false);
    // A single custom gear-shaped steel blade: sharply defined teeth, a
    // darker recessed hub, and silver face. No rotating individual meshes.
    const bladeParts = [
      art.cylinder("saw-disc", 0, 0, 0, 0.78, 0.78, 0.105, 0x839eaa, 32),
      art.cylinder("saw-face", 0, 0.060, 0, 0.70, 0.70, 0.018, 0xd1e6e7, 32),
      art.cylinder("saw-rear", 0, -0.060, 0, 0.70, 0.70, 0.018, 0xd1e6e7, 32),
      art.cylinder("saw-hub", 0, 0, 0, 0.27, 0.27, 0.17, 0x557482, 16),
      art.cylinder("saw-axle", 0, 0, 0, 0.115, 0.115, 0.22, 0x334c59, 12),
    ];
    for (let k = 0; k < 16; k++) {
      const angle = k * Math.PI * 2 / 16;
      const tooth = art.cylinder("saw-raked-tooth", Math.sin(angle) * 0.81, 0, Math.cos(angle) * 0.81,
        0.16, 0.16, 0.11, 0xe2edeb, 3);
      // Art.cylinder uses at least 12 sides. The angled narrow metal insert
      // below gives the tooth an identifiable cutting edge.
      const edge = art.box("saw-cutting-edge", Math.sin(angle + 0.04) * 0.87, 0,
        Math.cos(angle + 0.04) * 0.87, 0.11, 0.14, 0.20, 0xf4f6e9);
      edge.rotation.y = angle + 0.38;
      bladeParts.push(tooth, edge);
    }
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 2 / 5;
      bladeParts.push(art.cylinder("saw-hub-bolt", Math.sin(a) * 0.19, 0.095, Math.cos(a) * 0.19,
        0.055, 0.055, 0.04, 0xadc2c9, 8));
    }
    this.saw = art.merge("working-saw", bladeParts);
    this.saw.rotation.x = Math.PI / 2;
    this.saw.position.copyFrom(worldPoint(sawPoint.x, sawPoint.y + 6, 1.35));
  }
  event(e: GameEvent) {
    const { inputPoint, sawPoint } = this.game.stage.layout;
    if (e.type !== "flow") return;
    if (
      this.game.investments.production.conveyor &&
      e.kind === "wood" &&
      e.x === inputPoint.x &&
      e.toX === sawPoint.x
    )
      return;
    let f = this.flights.find((f) => f.kind === e.kind && f.age >= f.life);
    if (
      !f &&
      e.kind &&
      this.sources[e.kind] &&
      this.flights.filter((f) => f.kind === e.kind).length < 24
    ) {
      const mesh = this.sources[e.kind].createInstance(
        `flow-${e.kind}-${this.flights.length}`,
      );
      mesh.setEnabled(false);
      mesh.isPickable = false;
      f = {
        mesh,
        kind: e.kind,
        age: 99,
        from: Vector3.Zero(),
        to: Vector3.Zero(),
        life: 0.4,
      };
      this.flights.push(f);
    }
    if (!f) return;
    f.age = 0;
    f.from.copyFrom(worldPoint(e.x, e.y, e.height ?? 1));
    f.to.copyFrom(worldPoint(e.toX!, e.toY!, e.toHeight ?? 0.75));
    // Match visible packed stock tiers; simulation quantity is unchanged.
    for (const pile of this.piles) {
      const at = (x: number, y: number) =>
        Math.hypot(x - pile.at.x, y - pile.at.y) < 2;
      const index = this.piles.indexOf(pile);
      const count = [
        this.game.investments.production.input,
        this.game.investments.production.output,
        this.game.investments.economy.stock,
        this.game.investments.production.uncollected,
      ][index];
      const scale = pile.kind === "coin" ? 1.15 : pile.kind === "wood" ? 1.45 : 1.25;
      const height = scale * (
        (pile.kind === "coin" ? 1.05 : 1.1) +
        Math.floor(Math.min(99, count) / (pile.kind === "coin" ? 20 : 8)) *
          (pile.kind === "wood" ? 0.36 : 0.18)
      );
      if (at(e.x, e.y)) {
        f.from.y = height;
        if (pile.kind === "wood") f.from.z += 1.25;
      }
      if (at(e.toX!, e.toY!)) {
        f.to.y = height;
        if (pile.kind === "wood") f.to.z += 1.25;
      }
    }
    f.life = e.kind === "coin" ? 0.9 : 0.55;
    f.mesh.setEnabled(true);
  }
  update(
    dt: number,
    time: number,
    place: (element: HTMLElement, at: Vector3, visible: boolean) => unknown,
  ) {
    const { inputPoint, outputPoint, sawPoint } = this.game.stage.layout;
    const p = this.game.investments.production,
      e = this.game.investments.economy;
    const counts = [
      p.input,
      Math.max(0, p.output - this.game.investments.reservedOutput),
      Math.max(0, e.stock - this.game.investments.waiter.cargo),
      p.uncollected,
    ];
    for (let k = 0; k < this.piles.length; k++) {
      const pile = this.piles[k],
        count = Math.min(100, counts[k]);
      pile.mesh.setEnabled(
        count > 0 &&
          Math.hypot(
            this.game.player.x - pile.at.x,
            this.game.player.y - pile.at.y,
          ) < 500,
      );
      pile.mesh.thinInstanceCount = count;
      this.labels[k].textContent =
        `${["丸太", "板材", "市場の板材", "回収 灯貨"][k]} ${counts[k]}`;
      place(
        this.labels[k],
        worldPoint(pile.at.x, pile.at.y + 28, 0.2),
        Math.hypot(
          this.game.player.x - pile.at.x,
          this.game.player.y - pile.at.y,
        ) < 78 && counts[k] > 0,
      );
    }
    this.conveyor.setEnabled(p.conveyor);
    const working =
      !!p.processing &&
      (p.conveyor ||
        p.sawyer ||
        Math.hypot(
          this.game.player.x - sawPoint.x,
          this.game.player.y - sawPoint.y,
        ) < 130);
    if (working)
      this.beltTravel +=
        dt * (this.game.investments.machine("fastbelt") ? 2.8 : 1.4);
    this.fastMotor.setEnabled(!!this.game.investments.machine("fastbelt"));
    for (const lamp of this.lamps) lamp.setEnabled(working);
    for (let k = 0; k < this.chevrons.length; k++)
      this.chevrons[k].position.x =
        ((((k * 0.8 - this.beltTravel) % 4.8) + 4.8) % 4.8) - 2.4;
    for (let i = 0; i < this.slats.length; i++)
      this.slats[i].position.x =
        ((((i * 0.2 - this.beltTravel) % 4.8) + 4.8) % 4.8) - 2.4;
    this.workpiece.setEnabled(
      !!p.processing &&
        Math.hypot(
          this.game.player.x - sawPoint.x,
          this.game.player.y - sawPoint.y,
        ) < 500,
    );
    const beltPhase = Math.min(1, p.clock / 1.2);
    this.workpiece.position.copyFrom(
      worldPoint(
        inputPoint.x + (sawPoint.x - inputPoint.x) * beltPhase,
        inputPoint.y,
        p.conveyor ? 1.55 : 1.12,
      ),
    );
    this.workpiece.rotation.y = 0;
    this.workpiece.scaling.setAll(1.6);
    this.finishedPiece.setEnabled(!!p.processing && beltPhase > 0.45);
    this.finishedPiece.position.copyFrom(
      worldPoint(
        sawPoint.x +
          (outputPoint.x - sawPoint.x) * Math.max(0, (beltPhase - 0.45) / 0.55),
        sawPoint.y,
        p.conveyor ? 1.5 : 1.08,
      ),
    );
    if (working) this.saw.rotate(Vector3.Up(), dt * 12, 0);
    // Steel blades rotate but do not pulse in size.
    for (const f of this.flights) {
      if (f.age >= f.life) {
        f.mesh.setEnabled(false);
        continue;
      }
      f.age += dt;
      const t = Math.min(1, f.age / f.life);
      Vector3.LerpToRef(f.from, f.to, t, f.mesh.position);
      f.mesh.position.y += Math.sin(t * Math.PI) * 0.9;
      f.mesh.rotation.y = t * 1.8;
      f.mesh.scaling.setAll(f.kind === "coin" ? 1.6 : 1.5);
    }
  }
  metrics() {
    return {
      input: this.game.investments.production.input,
      output: this.game.investments.production.output,
      coins: this.game.investments.production.uncollected,
      flights: this.flights.filter((f) => f.age < f.life).length,
      piles: this.piles.map((p) => ({
        count: p.mesh.thinInstanceCount,
        buffer: !!p.mesh.getVertexBuffer("world0")?.getBuffer(),
      })),
      pooledInstances: this.piles.length * 100 + this.flights.length + 2,
      beltTravel: this.beltTravel,
      fastMotor: this.fastMotor.isEnabled(),
      working: this.lamps.some((lamp) => lamp.isEnabled()),
      conveyor: this.conveyor.isEnabled(),
    };
  }
}
