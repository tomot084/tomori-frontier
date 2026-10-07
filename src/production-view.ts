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
  slats: Mesh[] = [];
  saw: Mesh;
  workpiece: InstancedMesh;
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
      const cols = kind === "coin" ? 5 : 3;
      for (let i = 0; i < 100; i++) {
        const row = Math.floor(i / cols);
        Matrix.Translation(
          ((i % cols) - (cols - 1) / 2) * 0.42,
          0.48 + row * (kind === "wood" ? 0.3 : 0.22),
          Math.sin(row * 2) * 0.045,
        ).copyToArray(matrices, i * 16);
      }
      mesh.position.copyFrom(worldPoint(at.x, at.y));
      if (kind === "coin") mesh.scaling.setAll(0.7);
      mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
      mesh.thinInstanceCount = 0;
      mesh.setEnabled(false);
      mesh.alwaysSelectAsActiveMesh = true;
      this.piles.push({ mesh, kind, at });
      const base = art.box(
        "stock-pallet",
        0,
        0.15,
        0,
        1.9,
        0.25,
        1.3,
        kind === "coin" ? palette.teal : palette.wood,
      );
      base.position.addInPlace(worldPoint(at.x, at.y));
      const label = document.createElement("div");
      label.className = "line-label";
      overlay.append(label);
      this.labels.push(label);
    }
    for (const kind of ["wood", "plank", "coin"])
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
    this.conveyor = new TransformNode("purchased-conveyor", art.scene);
    const belt = art.box(
      "teal-belt",
      0,
      0.56,
      0,
      2.5,
      0.22,
      0.72,
      palette.teal,
    );
    belt.parent = this.conveyor;
    for (let i = 0; i < 12; i++) {
      const m = art.box(
        "belt-slat",
        i * 0.2 - 1.2,
        0.7,
        0,
        0.09,
        0.04,
        0.7,
        palette.cut,
      );
      m.parent = this.conveyor;
      this.slats.push(m);
    }
    for (const z of [-0.47, 0.47]) {
      const m = art.box("belt-rail", 0, 0.72, z, 2.6, 0.12, 0.09, palette.gold);
      m.parent = this.conveyor;
    }
    this.conveyor.position.copyFrom(
      worldPoint((inputPoint.x + sawPoint.x) / 2, inputPoint.y),
    );
    this.conveyor.setEnabled(false);
    this.saw = art.cylinder(
      "working-saw",
      0,
      0,
      0,
      0.48,
      0.48,
      0.12,
      palette.stoneLight,
      16,
    );
    this.saw.rotation.x = Math.PI / 2;
    this.saw.position.copyFrom(worldPoint(sawPoint.x, sawPoint.y, 1.2));
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
        Math.sin((i * Math.PI) / 5) * 0.49,
        0,
        Math.cos((i * Math.PI) / 5) * 0.49,
      );
      tooth.parent = this.saw;
    }
  }
  event(e: GameEvent) {
    if (e.type !== "flow") return;
    const f = this.flights.find((f) => f.kind === e.kind && f.age >= f.life);
    if (!f) return;
    f.age = 0;
    f.from.copyFrom(worldPoint(e.x, e.y, e.height ?? 1));
    f.to.copyFrom(worldPoint(e.toX!, e.toY!, e.toHeight ?? 0.75));
    f.life = e.kind === "coin" ? 0.5 : 0.38;
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
        `${["INPUT 丸太", "OUTPUT 板材", "市場 板材", "回収 灯貨"][k]} ${counts[k]}`;
      place(
        this.labels[k],
        worldPoint(pile.at.x, pile.at.y + 28, 0.2),
        Math.hypot(
          this.game.player.x - pile.at.x,
          this.game.player.y - pile.at.y,
        ) < 340,
      );
    }
    this.conveyor.setEnabled(p.conveyor);
    for (let i = 0; i < this.slats.length; i++)
      this.slats[i].position.x =
        ((((i * 0.2 - time * 0.8) % 2.4) + 2.4) % 2.4) - 1.2;
    this.workpiece.setEnabled(
      p.conveyor &&
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
        0.87,
      ),
    );
    this.workpiece.rotation.y = Math.PI / 2;
    if (p.processing) this.saw.rotate(Vector3.Up(), dt * 12, 0);
    this.saw.scaling.setAll(p.processing ? 1 + Math.sin(time * 28) * 0.05 : 1);
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
      f.mesh.scaling.setAll(f.kind === "coin" ? 0.85 : 1.15);
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
      pooledInstances: 473,
      conveyor: this.conveyor.isEnabled(),
    };
  }
}
