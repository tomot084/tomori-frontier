import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Art, palette, worldPoint, color } from "./models";
import { contentCatalog, type ContentId } from "./content";
import type { GameModel, Point } from "./simulation";
/** One merged building per content instance. Stocks use bounded thin-instance buffers. */
export class SettlementView {
  sites: {
    id: ContentId;
    root: TransformNode;
    foundation: Mesh;
    moving: Mesh[];
    owned: boolean;
    builtAt: number;
    label: HTMLElement;
    stock?: Mesh;
    build?: () => Mesh | undefined;
  }[] = [];
  people: (
    { rig: ReturnType<Art["helper"]>; cargo: Mesh; shadow: Mesh } | undefined
  )[] = [];
  chests: {
    id: string;
    at: Point;
    zone: number;
    root: TransformNode;
    lid: Mesh;
  }[] = [];
  danger: Mesh;
  constructor(
    private art: Art,
    private game: GameModel,
    overlay: HTMLElement,
  ) {
    const a = art;
    for (const place of game.stage.contents) {
      const { id } = place,
        parts: Mesh[] = [],
        moving: Mesh[] = [];
      const root = new TransformNode(`content-${id}`, a.scene);
      root.position.copyFrom(worldPoint(place.x, place.y));
      const preview = [
        a.box("supply-pallet", 0, 0.1, 0, 2, 0.2, 1.65, palette.stone),
      ];
      if (id === "orchard") {
        for (const x of [-0.6, 0, 0.6]) {
          preview.push(
            a.cylinder(
              "seedling-pot",
              x,
              0.3,
              0,
              0.18,
              0.14,
              0.3,
              palette.wood,
            ),
          );
          preview.push(
            a.sphere("seedling", x, 0.58, 0, 0.3, 0.4, 0.3, 0x94b978),
          );
        }
      } else if (id === "kiln") {
        preview.push(
          a.cylinder("unfinished-fire-pit", 0, 0.3, 0, 0.8, 1, 0.4, 0xbf805d),
        );
        preview.push(
          a.box(
            "planned-chimney",
            0.7,
            0.8,
            0.3,
            0.35,
            1.4,
            0.35,
            palette.stone,
          ),
        );
      } else if (id === "splitter") {
        for (const side of [-1, 1]) {
          const rail = a.box(
            "planned-fork",
            side * 0.4,
            0.3,
            0,
            0.12,
            0.2,
            1.8,
            palette.gold,
          );
          rail.rotation.y = side * 0.5;
          preview.push(rail);
        }
      } else if (["portal", "shrine", "snare"].includes(id)) {
        for (const x of [-0.8, 0.8])
          preview.push(
            a.box(
              "unfinished-upright",
              x,
              0.65,
              0,
              0.3,
              1.1,
              0.4,
              id === "snare" ? palette.teal : palette.stoneLight,
            ),
          );
      } else {
        for (const x of [-0.7, 0.7])
          preview.push(
            a.box(
              "hut-foundation-frame",
              x,
              0.35,
              0,
              0.18,
              0.5,
              1.8,
              palette.cut,
            ),
          );
        const roofBeam = a.box(
          "hut-roof-timber",
          0,
          0.6,
          0,
          1.8,
          0.12,
          0.2,
          palette.wood,
        );
        roofBeam.rotation.z = 0.25;
        preview.push(roofBeam);
      }
      const foundation = a.merge(`planned-${id}`, preview);
      foundation.position.copyFrom(root.position);
      const label = document.createElement("div");
      label.className = "line-label";
      overlay.append(label);
      const build = () => {
        if (["lumberCamp", "minerCamp"].includes(id)) {
          parts.push(
            a.box(
              "hut-walls",
              0,
              0.8,
              0,
              2.15,
              1.6,
              1.7,
              id === "lumberCamp" ? palette.wood : palette.stone,
            ),
          );
          parts.push(
            a.cylinder(
              "hut-roof",
              0,
              1.95,
              0,
              0,
              1.75,
              0.85,
              id === "lumberCamp" ? palette.teal : 0x9278aa,
              4,
            ),
          );
          parts.push(
            a.box("hut-door", 0, 0.6, -0.86, 0.6, 1.15, 0.06, palette.ink),
          );
          parts.push(
            a.box("stock-crate", 1.1, 0.4, -0.5, 0.9, 0.8, 0.9, palette.cut),
          );
          const tool =
            id === "lumberCamp"
              ? a.blade()
              : a.rock("pick-emblem", 0.6, palette.stoneLight, 6);
          tool.position.set(-0.65, 1.1, -0.92);
          parts.push(tool);
        } else if (id === "orchard") {
          parts.push(
            a.box("orchard-bed", 0, 0.12, 0, 2.6, 0.24, 1.5, palette.wood),
          );
          for (let k = 0; k < 3; k++) {
            const plant = a.berry();
            plant.position.set(-1.1 + k * 0.88, 0.15, 0.2);
            plant.parent = root;
            moving.push(plant);
          }
          parts.push(
            a.box("fruit-basket", 0.9, 0.35, -0.9, 0.8, 0.65, 0.6, palette.cut),
          );
        } else if (id === "kiln") {
          parts.push(
            a.sphere("brick-kiln", 0, 0.95, 0, 2.6, 2.15, 2.1, 0xbf805d),
          );
          parts.push(
            a.box("kiln-opening", 0, 0.7, -1.04, 1.1, 0.85, 0.07, palette.ink),
          );
          parts.push(
            a.box("kiln-chimney", 0.6, 2, 0.3, 0.5, 2.2, 0.5, palette.stone),
          );
          parts.push(
            a.box("brick-rack", -1.2, 0.25, -0.7, 0.9, 0.4, 1.2, palette.wood),
          );
          const fire = a.sphere(
            "kiln-fire",
            0,
            0.55,
            -1.08,
            0.75,
            0.7,
            0.09,
            palette.gold,
          );
          fire.parent = root;
          moving.push(fire);
          for (let k = 0; k < 2; k++) {
            const smoke = a.sphere(
              "kiln-smoke",
              0.6,
              3.4 + k * 0.5,
              0.3,
              0.4,
              0.4,
              0.4,
              0xd2d5c8,
            );
            smoke.parent = root;
            moving.push(smoke);
          }
        } else if (id === "splitter") {
          parts.push(
            a.box("routing-box", 0, 0.6, 0, 1.6, 1.1, 1.1, palette.teal),
          );
          for (const side of [-1, 1]) {
            const rail = a.box(
              "fork-track",
              side * 0.7,
              0.65,
              -0.9,
              0.12,
              0.12,
              1.8,
              palette.gold,
            );
            rail.rotation.y = side * 0.55;
            parts.push(rail);
          }
          const arm = a.box(
            "routing-lever",
            0,
            1.3,
            0,
            0.15,
            0.16,
            1.25,
            palette.gold,
          );
          arm.parent = root;
          moving.push(arm);
        } else if (id === "snare") {
          parts.push(
            a.cylinder("slow-generator", 0, 0.4, 0, 0.8, 1, 0.8, palette.teal),
          );
          for (const side of [-1, 1])
            parts.push(
              a.box(
                "slow-coil",
                side * 0.55,
                1.3,
                0,
                0.16,
                1.4,
                0.2,
                palette.gold,
              ),
            );
          const core = a.sphere("slow-orb", 0, 1.6, 0, 0.6, 0.6, 0.6, 0xa8e5df);
          core.parent = root;
          moving.push(core);
          const ring = MeshBuilder.CreateTorus(
            "slow-field-range",
            { diameter: 7, thickness: 0.05, tessellation: 48 },
            a.scene,
          );
          ring.position.y = 0.08;
          ring.parent = root;
          this.glow(ring, 0x7dc2c9);
          moving.push(ring);
        } else if (id === "shrine") {
          parts.push(
            a.cylinder(
              "shrine-plinth",
              0,
              0.2,
              0,
              1.1,
              1.3,
              0.4,
              palette.stone,
            ),
          );
          for (const side of [-1, 1])
            parts.push(
              a.box(
                "shrine-column",
                side * 0.85,
                1.2,
                0,
                0.35,
                2.4,
                0.4,
                palette.stoneLight,
              ),
            );
          parts.push(
            a.box("shrine-lintel", 0, 2.45, 0, 2.35, 0.4, 0.6, palette.teal),
          );
          const heart = a.sphere(
            "shrine-heart",
            0,
            1.1,
            0,
            0.7,
            0.9,
            0.7,
            palette.gold,
          );
          heart.parent = root;
          moving.push(heart);
        } else {
          for (const side of [-1, 1])
            parts.push(
              a.box(
                "portal-post",
                side * 1,
                1.3,
                0,
                0.4,
                2.6,
                0.6,
                palette.stoneLight,
              ),
            );
          parts.push(
            a.box("portal-lintel", 0, 2.65, 0, 2.8, 0.4, 0.6, palette.teal),
          );
          const ring = MeshBuilder.CreateTorus(
            "open-island-portal",
            { diameter: 2.05, thickness: 0.12, tessellation: 32 },
            a.scene,
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 1.35;
          ring.parent = root;
          this.glow(ring, 0x8bbfcf);
          moving.push(ring);
        }
        const built = a.merge(`built-content-${id}`, parts);
        built.parent = root;
        let stock: Mesh | undefined;
        if (["orchard", "minerCamp", "kiln"].includes(id)) {
          stock =
            id === "orchard"
              ? a.resource("food", "orchard-stock")
              : id === "kiln"
                ? a.box("stored-brick", 0, 0, 0, 0.5, 0.25, 0.3, 0xcc9978)
                : a.resource("stone", "mine-stock");
          stock.parent = root;
          stock.position.set(1.0, 0.65, -0.9);
          const buffer = new Float32Array(24 * 16);
          for (let k = 0; k < 24; k++)
            Matrix.Translation(
              (k % 3) * 0.25 - 0.25,
              Math.floor(k / 6) * 0.2,
              Math.floor((k % 6) / 3) * 0.25,
            ).copyToArray(buffer, k * 16);
          stock.thinInstanceSetBuffer("matrix", buffer, 16, true);
          stock.thinInstanceCount = 0;
        }
        return stock;
      };
      this.sites.push({
        id,
        root,
        foundation,
        moving,
        owned: game.investments.content(id),
        builtAt: -10000,
        label,
        build,
      });
    }
    for (const t of game.stage.treasures) {
      const root = new TransformNode(`treasure-${t.id}`, a.scene);
      root.position.copyFrom(worldPoint(t.x, t.y));
      const chest = a.merge("treasure-chest", [
        a.box("chest-body", 0, 0.35, 0, 1.05, 0.65, 0.75, palette.wood),
        a.box("chest-band", 0, 0.35, -0.39, 0.12, 0.6, 0.04, palette.gold),
      ]);
      chest.parent = root;
      const lid = a.box(
        "opening-chest-lid",
        0,
        0.73,
        0,
        1.12,
        0.22,
        0.8,
        palette.gold,
      );
      lid.parent = root;
      this.chests.push({ ...t, at: { x: t.x, y: t.y }, root, lid });
    }
    this.danger = MeshBuilder.CreateTorus(
      "guardian-strike-warning",
      { diameter: 3.75, thickness: 0.09, tessellation: 32 },
      a.scene,
    );
    this.danger.position.y = 0.1;
    this.glow(this.danger, 0xeaa075);
  }
  createWorker(index: number) {
    const w = this.game.settlements.workers[index],
      a = this.art;
    const rig = a.helper(w.id === "minerCamp" ? 1 : 0);
    const cargo = a.merge(`worker-${w.id}-cargo`, [
      a.box(
        "carried-good",
        0,
        1.05,
        -0.45,
        0.8,
        0.3,
        0.45,
        w.id === "kiln"
          ? 0xcc9978
          : w.id === "orchard"
            ? 0xe59c7b
            : palette.cut,
      ),
    ]);
    cargo.parent = rig.root;
    const shadow = a.cylinder(
      "settler-contact-shadow",
      0,
      0.045,
      0,
      0.45,
      0.45,
      0.012,
      0x587a69,
    );
    return { rig, cargo, shadow };
  }
  glow(mesh: Mesh, hex: number) {
    const mat = new StandardMaterial(mesh.name + "-glow", this.art.scene);
    mat.diffuseColor = color(hex);
    mat.emissiveColor = color(hex).scale(0.6);
    mat.alpha = 0.7;
    mesh.material = mat;
    mesh.isPickable = false;
  }
  update(
    place: (element: HTMLElement, at: Vector3, visible: boolean) => unknown,
  ) {
    const g = this.game,
      s = g.settlements,
      time = g.time / 1000;
    for (const site of this.sites) {
      const at = s.place(site.id),
        distance = Math.hypot(g.player.x - at.x, g.player.y - at.y),
        owned = s.owned(site.id);
      if (owned && !site.owned) site.builtAt = g.time;
      site.owned = owned;
      if (owned && distance < 550 && site.build) {
        site.stock = site.build();
        site.build = undefined;
      }
      site.root.setEnabled(owned && distance < 550);
      site.foundation.setEnabled(
        !owned && g.s.zone >= at.unlock && distance < 550,
      );
      site.root.scaling.setAll(
        Math.min(1, 0.15 + Math.max(0, g.time - site.builtAt) / 800),
      );
      site.label.textContent = owned
        ? contentCatalog[site.id].name
        : `${contentCatalog[site.id].name} ${g.investments.offer(site.id).price}灯貨`;
      place(
        site.label,
        worldPoint(at.x, at.y + 45, 0.35),
        distance < 80 && g.s.zone >= at.unlock,
      );
      if (!site.root.isEnabled()) continue;
      if (site.stock) {
        const key =
          site.id === "orchard"
            ? "food"
            : site.id === "kiln"
              ? "brick"
              : "stone";
        const reserved = s.workers.find((w) => w.id === site.id)?.cargo ?? 0;
        site.stock.thinInstanceCount = Math.min(
          24,
          Math.ceil(
            Math.max(
              0,
              (g.investments.economy.workshops?.[key] ?? 0) - reserved,
            ) / 2,
          ),
        );
      }
      if (site.id === "orchard")
        site.moving.forEach((m, k) =>
          m.scaling.setAll(0.65 + ((time + k * 3) % 9) / 25),
        );
      if (site.id === "kiln")
        site.moving.forEach((m, k) => {
          m.setEnabled(s.kilnWorking);
          if (k) {
            m.position.y = 3.1 + ((time + k * 0.5) % 1.4);
            m.scaling.setAll(0.6 + ((time + k * 0.5) % 1.4) * 0.4);
          } else m.scaling.y = 0.8 + Math.sin(time * 12) * 0.2;
        });
      if (site.id === "splitter")
        site.moving[0].rotation.y =
          g.investments.economy.boardRoute === "market" ? -0.55 : 0.55;
      if (site.id === "portal") {
        site.moving[0].rotation.y = Math.sin(time) * 0.08;
        site.moving[0].scaling.setAll(1 + Math.sin(time * 3) * 0.05);
      }
      if (site.id === "snare" || site.id === "shrine")
        site.moving[0].scaling.setAll(1 + Math.sin(time * 4) * 0.12);
    }
    s.workers.forEach((w, k) => {
      if (
        !s.owned(w.id) ||
        Math.hypot(w.x - g.player.x, w.y - g.player.y) >= 550
      ) {
        this.people[k]?.rig.root.setEnabled(false);
        this.people[k]?.shadow.setEnabled(false);
        return;
      }
      this.people[k] ??= this.createWorker(k);
      const { rig, cargo, shadow } = this.people[k]!;
      const enabled = true;
      rig.root.setEnabled(enabled);
      shadow.setEnabled(enabled);
      if (!enabled) return;
      rig.root.position.copyFrom(
        worldPoint(w.x, w.y, Math.sin(time * 8) * 0.04),
      );
      rig.root.rotation.y = w.heading;
      rig.body.rotation.z =
        Math.sin(time * (w.phase === "work" ? 14 : 7)) *
        (w.phase === "work" ? 0.18 : 0.04);
      rig.wood.setEnabled(w.cargo > 0 && w.kind === "wood");
      rig.stone.setEnabled(w.cargo > 0 && w.kind === "stone");
      cargo.setEnabled(
        w.cargo > 0 && ["plank", "brick", "food"].includes(w.kind),
      );
      shadow.position.copyFrom(worldPoint(w.x, w.y, 0.052));
    });
    for (const chest of this.chests) {
      chest.root.setEnabled(
        chest.zone <= g.s.zone &&
          Math.hypot(g.player.x - chest.at.x, g.player.y - chest.at.y) < 550,
      );
    }
    for (const chest of this.chests) {
      chest.lid.rotation.x = g.investments.economy.discoveries?.includes(
        chest.id,
      )
        ? -1.1
        : 0;
      chest.lid.position.z = g.investments.economy.discoveries?.includes(
        chest.id,
      )
        ? 0.35
        : 0;
    }
    this.danger.setEnabled(s.danger.until > g.time);
    this.danger.position.copyFrom(worldPoint(s.danger.x, s.danger.y, 0.1));
    this.danger.scaling.setAll(0.9 + Math.sin(time * 10) * 0.06);
  }
}
