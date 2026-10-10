import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Art, color, worldPoint } from "./models";
import type { GameModel } from "./simulation";
/** Eight small shared-material meshes; the ordinary enemy pool supplies every raider. */
export class RaidView {
  private meshes: Mesh[] = [];
  private lanes: Mesh[] = [];
  private light?: Mesh;
  private slow?: Mesh;
  private reward?: Mesh;
  private label: HTMLElement;
  constructor(
    art: Art,
    private game: GameModel,
    overlay: HTMLElement,
  ) {
    this.label = document.createElement("div");
    this.label.className = "guide-label";
    overlay.append(this.label);
    const at = game.stage.raid;
    if (!at) return;
    const base = art.cylinder(
      "defense-beacon-base",
      0,
      0.2,
      0,
      1.1,
      1.3,
      0.4,
      0x8b9d93,
    );
    const stem = art.cylinder(
      "defense-beacon-stem",
      0,
      0.85,
      0,
      0.22,
      0.36,
      1.1,
      0xc49a64,
    );
    this.light = art.sphere(
      "defense-beacon-light",
      0,
      1.65,
      0,
      0.8,
      0.8,
      0.8,
      0xffdd83,
    );
    for (const m of [base, stem, this.light])
      m.position.addInPlace(worldPoint(at.x, at.y));
    this.meshes.push(base, stem, this.light);
    this.reward = art.cylinder(
      "defense-victory-stock",
      0,
      0.15,
      0,
      0.6,
      0.6,
      0.3,
      0xffdd83,
    );
    this.reward.position.addInPlace(worldPoint(at.x + 38, at.y));
    const paint = new StandardMaterial("defense-lane-gold", art.scene);
    paint.diffuseColor = color(0xffd08c);
    paint.emissiveColor = color(0x80612b);
    paint.alpha = 0.6;
    for (const lane of at.lanes) {
      const marker = MeshBuilder.CreateTorus(
        "defense-entry",
        { diameter: 1.5, thickness: 0.13, tessellation: 20 },
        art.scene,
      );
      marker.material = paint;
      marker.position.copyFrom(worldPoint(lane.x, lane.y, 0.09));
      this.lanes.push(marker);
    }
    this.slow = MeshBuilder.CreateTorus(
      "defense-snare-projection",
      { diameter: 8.4, thickness: 0.06, tessellation: 48 },
      art.scene,
    );
    const slowPaint = new StandardMaterial("defense-snare-blue", art.scene);
    slowPaint.diffuseColor = color(0x80cee6);
    slowPaint.emissiveColor = color(0x3d8098);
    slowPaint.alpha = 0.5;
    this.slow.material = slowPaint;
    this.slow.position.copyFrom(worldPoint(at.x, at.y, 0.07));
  }
  update(
    place: (
      el: HTMLElement,
      at: { x: number; y: number },
      visible: boolean,
    ) => void,
  ) {
    const at = this.game.stage.raid;
    if (!at) {
      this.label.hidden = true;
      return;
    }
    const raid = this.game.raid,
      visible =
        this.game.s.zone >= at.unlock &&
        Math.hypot(this.game.player.x - at.x, this.game.player.y - at.y) < 550;
    for (const m of this.meshes) m.setEnabled(visible);
    this.reward?.setEnabled(
      visible && (this.game.investments.economy.raidReward ?? 0) > 0,
    );
    if (this.reward)
      this.reward.scaling.y =
        1 + Math.min(80, this.game.investments.economy.raidReward ?? 0) / 20;
    this.lanes.forEach((m, i) => {
      m.setEnabled(
        visible &&
          raid.active &&
          (raid.wave === 3 || (raid.wave === 1 ? i === 0 : i !== 0)),
      );
      m.scaling.setAll(1 + Math.sin(this.game.time / 180) * 0.12);
    });
    this.slow?.setEnabled(
      visible && raid.active && this.game.settlements.owned("snare"),
    );
    if (this.light)
      this.light.scaling.setAll(
        raid.result === "failed" && !raid.active
          ? 0.35
          : raid.active
            ? 0.65 + raid.hp / 200
            : 1,
      );
    this.label.textContent = raid.active
      ? `灯標 ${raid.hp}`
      : "灯標防衛 · 近づいて開始";
    place(this.label, at, visible);
  }
}
