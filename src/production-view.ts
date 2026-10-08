import "@babylonjs/core/Meshes/thinInstanceMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Art, palette, worldPoint } from "./models";
import {
  inputPoint,
  outputPoint,
  sawPoint,
  tillPoint,
  marketPoint,
} from "./investments";
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
    private art: Art,
    private game: GameModel,
    overlay: HTMLElement,
  ) {
    this.sources = {
      wood: art.log("production-log-source"),
      plank: art.box(
        "production-plank-source",
        0,
        0,
        0,
        1.1,
        0.16,
        0.36,
        palette.cut,
      ),
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
      const cols = kind === "coin" ? 5 : 4;
      for (let i = 0; i < 100; i++) {
        const row = Math.floor(i / cols);
        Matrix.Translation(
          ((i % cols) - (cols - 1) / 2) * (kind === "wood" ? 0.46 : 0.38),
          (kind === "coin" ? 1.05 : 1.1) +
            Math.floor(row / 4) * (kind === "wood" ? 0.42 : 0.18),
          ((row % 4) - 1.5) * (kind === "coin" ? 0.24 : 0.36),
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
        // Fixed cut ends are a material sample, separate from live stock.
        for (let i = 0; i < 6; i++) {
          const log = art.log("cradle-material-sample");
          log.scaling.setAll(1.65);
          log.rotation.y = Math.PI / 2;
          log.position.set(
            ((i % 3) - 1) * 0.48,
            0.44 + Math.floor(i / 3) * 0.43,
            -0.3,
          );
          fittings.push(log);
        }
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
        for (let i = 0; i < 5; i++)
          fittings.push(
            art.box(
              "lumber-material-sample",
              0,
              0.37 + i * 0.15,
              -0.28,
              1.95,
              0.12,
              0.38,
              palette.cut,
            ),
          );
        for (const x of [-0.65, 0.65])
          fittings.push(
            art.box(
              "lumber-binding",
              x,
              0.69,
              -0.28,
              0.08,
              0.8,
              0.41,
              palette.teal,
            ),
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
    for (const kind of ["wood", "plank", "coin", "stone", "food"])
      for (let i = 0; i < 24; i++) {
        const mesh = this.sources[kind].createInstance(`flow-${kind}-${i}`);
        mesh.setEnabled(false);
        mesh.isPickable = false;
        this.flights.push({
          mesh,
          kind,
          age: 99,
          from: Vector3.Zero(),
          to: Vector3.Zero(),
          life: 0.4,
        });
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
    const belt = art.box("teal-belt", 0, 0.72, 0, 4.8, 0.3, 1.85, palette.teal);
    belt.parent = this.conveyor;
    const slatSource = art.box(
      "belt-slat-source",
      0,
      0.9,
      0,
      0.09,
      0.05,
      1.75,
      palette.cut,
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
      const m = art.box("belt-rail", 0, 0.9, z, 4.95, 0.18, 0.12, palette.gold);
      m.parent = this.conveyor;
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
        0.55,
        0.045,
        0.11,
        palette.gold,
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
    this.saw = art.cylinder(
      "working-saw",
      0,
      0,
      0,
      0.8,
      0.8,
      0.18,
      palette.stoneLight,
      16,
    );
    this.saw.rotation.x = Math.PI / 2;
    this.saw.position.copyFrom(worldPoint(sawPoint.x, sawPoint.y + 6, 1.35));
    for (let i = 0; i < 10; i++) {
      const tooth = art.box(
        "saw-tooth",
        0,
        0,
        0,
        0.13,
        0.16,
        0.14,
        palette.cream,
      );
      tooth.position.set(
        Math.sin((i * Math.PI) / 5) * 0.8,
        0,
        Math.cos((i * Math.PI) / 5) * 0.8,
      );
      tooth.parent = this.saw;
    }
  }
  event(e: GameEvent) {
    if (e.type !== "flow") return;
    if (
      this.game.investments.production.conveyor &&
      e.kind === "wood" &&
      e.x === inputPoint.x &&
      e.toX === sawPoint.x
    )
      return;
    const f = this.flights.find((f) => f.kind === e.kind && f.age >= f.life);
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
      const height =
        1.1 +
        Math.floor(Math.min(99, count) / 16) *
          (pile.kind === "wood" ? 0.6 : 0.23);
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
    const p = this.game.investments.production,
      e = this.game.investments.economy;
    const counts = [
      p.input,
      Math.max(0, p.output - this.game.investments.hauler.cargo),
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
    this.saw.scaling.setAll(working ? 1 + Math.sin(time * 28) * 0.05 : 1);
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
