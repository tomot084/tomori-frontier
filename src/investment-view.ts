import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Art, color, palette, worldPoint } from "./models";
import { investmentTiles, customerPoint, marketPoint } from "./investments";
import type { GameModel } from "./simulation";
export class InvestmentView {
  waiter: ReturnType<Art["helper"]>;
  customers: ReturnType<Art["helper"]>[] = [];
  bases: ReturnType<Art["merge"]>[] = [];
  stock: ReturnType<Art["merge"]>;
  paints: {
    texture: DynamicTexture;
    tile: (typeof investmentTiles)[number];
  }[] = [];
  paintKey = "";
  constructor(
    private art: Art,
    private game: GameModel,
    shadows: ShadowGenerator,
  ) {
    for (const tile of investmentTiles) {
      const parts = [
        art.box(`${tile.id}-foundation`, 0, 0.06, 0, 2.45, 0.12, 2.2, 0xe3d4a8),
      ];
      // Each investment has an original miniature prop, readable without a floating panel.
      if (["conveyor", "hauler", "sawyer"].includes(tile.id)) {
        // Hiring pads remain flat so the production line and workers stay readable.
      } else if (tile.id === "tool") {
        parts.push(
          art.box("workbench", 0, 0.55, 0.65, 1.5, 0.22, 0.65, palette.wood),
        );
        for (const x of [-0.6, 0.6])
          parts.push(
            art.box("bench-leg", x, 0.3, 0.65, 0.15, 0.6, 0.5, palette.leather),
          );
        const handle = art.box(
          "axe-handle",
          0,
          1.05,
          0.65,
          0.12,
          1,
          0.12,
          palette.cut,
        );
        handle.rotation.z = -0.5;
        parts.push(
          handle,
          art.box(
            "axe-head",
            -0.26,
            1.4,
            0.65,
            0.72,
            0.38,
            0.18,
            palette.stoneLight,
          ),
        );
      } else if (tile.id === "basket") {
        parts.push(
          art.box("basket", 0, 0.55, 0.6, 1.12, 0.86, 0.65, palette.wood),
        );
        for (const y of [0.25, 0.5, 0.75])
          parts.push(
            art.box("basket-band", 0, y, 0.25, 1.18, 0.06, 0.07, palette.cut),
          );
        parts.push(
          art.cylinder("bundle", 0.2, 1.03, 0.6, 0.13, 0.13, 0.45, palette.cut),
        );
      } else if (tile.id === "market") {
        parts.push(
          art.box("market-counter", 0, 0.6, 0.7, 1.8, 0.85, 0.7, palette.wood),
        );
        for (const x of [-0.85, 0.85])
          parts.push(
            art.box(
              "market-post",
              x,
              1.12,
              0.7,
              0.12,
              2,
              0.12,
              palette.leather,
            ),
          );
        parts.push(
          art.box("market-canopy", 0, 2.04, 0.6, 2.12, 0.22, 1.1, tile.color),
        );
        for (const x of [-0.48, 0, 0.48])
          parts.push(
            art.cylinder(
              "display-log",
              x,
              1.12,
              0.7,
              0.15,
              0.15,
              0.3,
              palette.cut,
            ),
          );
      } else if (tile.id === "sawmill") {
        parts.push(
          art.box("saw-table", 0, 0.7, 0.6, 1.7, 0.24, 0.85, palette.wood),
        );
        for (const x of [-0.65, 0.65])
          parts.push(
            art.box("saw-leg", x, 0.4, 0.6, 0.15, 0.8, 0.7, palette.leather),
          );
        const saw = art.cylinder(
          "saw-wheel",
          0.1,
          1,
          0.6,
          0.44,
          0.44,
          0.12,
          palette.stoneLight,
          12,
        );
        saw.rotation.x = Math.PI / 2;
        parts.push(saw);
        parts.push(
          art.box("raw-timber", -0.4, 0.94, 0.15, 1.2, 0.17, 0.23, palette.cut),
        );
      } else if (tile.id === "quarry") {
        for (let i = 0; i < 3; i++) {
          const rock = art.rock("cut-stone", 0.62, palette.stoneLight, i);
          rock.position.set((i - 1) * 0.46, 0.15, 0.6);
          parts.push(rock);
        }
        parts.push(
          art.box("stone-brace", 0, 0.6, 0.62, 1.5, 0.08, 0.16, palette.wood),
        );
      } else if (tile.id === "depot") {
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * 0.55,
            y = i === 1 ? 0.95 : 0.4;
          parts.push(
            art.box("storage-crate", x, y, 0.65, 0.54, 0.65, 0.6, palette.wood),
            art.box("crate-band", x, y, 0.33, 0.57, 0.09, 0.05, palette.cut),
          );
        }
      } else if (tile.id === "cart") {
        parts.push(
          art.box("cart-bed", 0, 0.58, 0.65, 1.3, 0.18, 0.85, palette.wood),
          art.box("cart-side", 0, 0.88, 1, 1.4, 0.5, 0.1, palette.cut),
        );
        for (const x of [-0.65, 0.65])
          for (const z of [0.3, 1]) {
            const wheel = art.cylinder(
              "cart-wheel",
              x,
              0.35,
              z,
              0.28,
              0.28,
              0.12,
              palette.ink,
            );
            wheel.rotation.z = Math.PI / 2;
            parts.push(wheel);
          }
      } else if (tile.id === "bounty") {
        parts.push(
          art.box("notice-post", 0, 0.7, 0.7, 0.2, 1.3, 0.2, palette.wood),
          art.box(
            "notice-board",
            0,
            1.24,
            0.65,
            1.45,
            0.85,
            0.15,
            palette.leather,
          ),
          art.box("wanted-poster", 0, 1.24, 0.55, 1, 0.62, 0.03, palette.cream),
        );
      } else {
        parts.push(
          art.cylinder(
            "lantern-plinth",
            0,
            0.28,
            0.7,
            0.55,
            0.7,
            0.45,
            tile.color,
          ),
        );
        parts.push(
          art.cylinder("lantern", 0, 0.85, 0.7, 0.25, 0.25, 0.65, palette.gold),
        );
        parts.push(
          art.cylinder(
            "lantern-roof",
            0,
            1.25,
            0.7,
            0,
            0.4,
            0.25,
            palette.teal,
          ),
        );
      }
      const base = art.merge(`investment-${tile.id}`, parts);
      base.position.copyFrom(worldPoint(tile.x, tile.y));
      this.bases.push(base);
      shadows.addShadowCaster(base);
      const plane = MeshBuilder.CreatePlane(
        `tile-${tile.id}`,
        { width: 1.85, height: 1.55 },
        art.scene,
      );
      plane.rotation.x = Math.PI / 2;
      plane.position.copyFrom(worldPoint(tile.x, tile.y, 0.13));
      const tex = new DynamicTexture(
        `investment-${tile.id}-paint`,
        { width: 256, height: 256 },
        art.scene,
        false,
      );
      this.paints.push({ texture: tex, tile });
      tex.hasAlpha = true;
      tex.update();
      const material = new StandardMaterial(`${tile.id}-paint`, art.scene);
      material.diffuseTexture = tex;
      material.specularColor = color(0);
      material.backFaceCulling = false;
      plane.material = material;
      plane.isPickable = false;
      plane.receiveShadows = true;
    }
    this.waiter = art.helper(1);
    shadows.addShadowCaster(this.waiter.body);
    for (let i = 0; i < 2; i++) {
      const customer = art.helper(i);
      customer.root.position.copyFrom(
        worldPoint(customerPoint.x - i * 32, customerPoint.y + i * 37),
      );
      customer.root.setEnabled(true);
      customer.root.scaling.setAll(0.95);
      customer.root.rotation.y = 0.45;
      customer.wood.setEnabled(false);
      customer.stone.setEnabled(false);
      shadows.addShadowCaster(customer.body);
      this.customers.push(customer);
    }
    const deck = art.merge("customer-landing", [
      art.box("customer-deck", 0, 0.04, 0, 2.2, 0.08, 1.6, palette.wood),
      art.box("deck-edge", 0, 0.09, -0.7, 2.25, 0.06, 0.12, palette.cut),
    ]);
    deck.position.copyFrom(
      worldPoint(customerPoint.x - 16, customerPoint.y + 18),
    );
    this.bases.push(deck);
    const pieces = [];
    for (let i = 0; i < 6; i++)
      pieces.push(
        art.cylinder(
          "stored-log",
          (i % 3) * 0.3 - 0.3,
          0.15 + Math.floor(i / 3) * 0.3,
          0,
          0.14,
          0.14,
          0.65,
          palette.cut,
        ),
      );
    this.stock = art.merge("market-stock", pieces);
    this.stock.position.copyFrom(
      worldPoint(marketPoint.x - 38, marketPoint.y + 22),
    );
  }
  update(time: number) {
    const key = JSON.stringify([
      this.game.s.levels,
      this.game.investments.economy.carriers,
      this.game.investments.economy.waiter,
      this.game.investments.economy.market,
      this.game.investments.economy.perks,
      this.game.investments.production.conveyor,
      this.game.investments.production.hauler,
      this.game.investments.production.sawyer,
    ]);
    if (key !== this.paintKey) {
      this.paintKey = key;
      for (const { texture, tile } of this.paints) {
        const c = texture.getContext() as CanvasRenderingContext2D;
        c.clearRect(0, 0, 256, 256);
        c.fillStyle = `#${tile.color.toString(16)}`;
        c.fillRect(8, 8, 240, 240);
        c.strokeStyle = "#fff1cb";
        c.lineWidth = 6;
        c.setLineDash([22, 10]);
        c.strokeRect(17, 17, 222, 222);
        c.setLineDash([]);
        c.textAlign = "center";
        c.fillStyle = "#fff8df";
        c.font = "bold 31px sans-serif";
        c.fillText(tile.name, 128, 220);
        const offer = this.game.investments.offer(tile.id);
        c.font = "bold 35px sans-serif";
        c.fillText(
          offer.level >= offer.max ? "MAX" : `✦ ${offer.price}`,
          128,
          178,
        );
        texture.update();
      }
    }
    for (const base of this.bases) {
      if (base.name === "investment-bounty")
        base.setEnabled(this.game.s.zone > 0);
    }
    for (const { texture, tile } of this.paints) {
      const plane = this.art.scene.getMeshByName(`tile-${tile.id}`);
      plane?.setEnabled(tile.id !== "bounty" || this.game.s.zone > 0);
    }
    const w = this.game.investments.waiter;
    this.waiter.root.setEnabled(w.active);
    this.waiter.root.position.copyFrom(
      worldPoint(
        w.x,
        w.y,
        w.phase === "rest" ? 0 : Math.abs(Math.sin(time * 10)) * 0.07,
      ),
    );
    this.waiter.root.rotation.y = w.heading;
    this.waiter.wood.setEnabled(w.cargo > 0);
    this.waiter.stone.setEnabled(false);
    this.stock.setEnabled(false);
    this.stock.scaling.y =
      0.4 +
      (0.6 * this.game.investments.economy.stock) /
        this.game.investments.storageCapacity;
    const age = (this.game.time - this.game.investments.servedAt) / 1000;
    this.customers.forEach((c, i) => {
      c.root.position.y =
        age < 0.6
          ? Math.sin((age * Math.PI) / 0.6) * 0.3
          : Math.sin(time * 1.5 + i) * 0.015;
    });
  }
}
