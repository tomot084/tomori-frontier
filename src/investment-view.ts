import { isContent } from "./content";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Art, palette, worldPoint } from "./models";
import { machineOffers } from "./investments";
import type { GameModel } from "./simulation";
export class InvestmentView {
  waiter: ReturnType<Art["helper"]>;
  customers: ReturnType<Art["helper"]>[] = [];
  bases: ReturnType<Art["merge"]>[] = [];
  stock: ReturnType<Art["merge"]>;
  constructor(
    art: Art,
    private game: GameModel,
    shadows: ShadowGenerator,
  ) {
    const { customerPoint, marketPoint } = game.stage.layout;
    for (const tile of game.investments.tiles) {
      if (tile.id in machineOffers || isContent(tile.id)) continue;
      const parts: import("@babylonjs/core/Meshes/mesh").Mesh[] = [];
      // Each investment has an original miniature prop, readable without a floating panel.
      if (["conveyor", "hauler", "sawyer"].includes(tile.id)) {
        if (tile.id === "conveyor") {
          for (const z of [0.2, 0.9])
            parts.push(
              art.box(
                "unfinished-feed-rail",
                0,
                0.4,
                z,
                1.65,
                0.14,
                0.12,
                palette.stone,
              ),
            );
          for (const x of [-0.7, 0.7])
            parts.push(
              art.box("rail-foot", x, 0.2, 0.55, 0.12, 0.4, 0.8, palette.wood),
            );
        } else if (tile.id === "hauler") {
          parts.push(
            art.box(
              "empty-handcart",
              0,
              0.5,
              0.6,
              1.1,
              0.15,
              0.85,
              palette.cut,
            ),
          );
          for (const x of [-0.6, 0.6]) {
            const wheel = art.cylinder(
              "handcart-wheel",
              x,
              0.3,
              0.6,
              0.32,
              0.32,
              0.14,
              palette.ink,
            );
            wheel.rotation.z = Math.PI / 2;
            parts.push(wheel);
            parts.push(
              art.box(
                "cart-handle",
                x,
                0.6,
                -0.15,
                0.09,
                0.1,
                1.4,
                palette.wood,
              ),
            );
          }
        } else {
          parts.push(
            art.box(
              "empty-sawyer-bench",
              0,
              0.7,
              0.6,
              1.3,
              0.18,
              0.7,
              palette.cut,
            ),
          );
          for (const x of [-0.5, 0.5])
            parts.push(
              art.box("bench-leg", x, 0.35, 0.6, 0.12, 0.7, 0.6, palette.wood),
            );
        }
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
      } else if (tile.id === "carrier") {
        parts.push(
          art.cylinder(
            "chopping-block",
            0,
            0.3,
            0.5,
            0.5,
            0.6,
            0.6,
            palette.wood,
          ),
        );
        const axe = art.blade();
        axe.position.set(0, 0.8, 0.4);
        parts.push(axe);
        parts.push(
          art.box(
            "hiring-axe-handle",
            0,
            0.73,
            0.6,
            0.09,
            0.8,
            0.09,
            palette.cut,
          ),
        );
        for (let i = 0; i < 3; i++) {
          const log = art.log("woodcutter-bundle");
          log.position.set(-0.55, 0.16 + i * 0.25, -0.25);
          parts.push(log);
        }
      } else if (tile.id === "waiter") {
        parts.push(
          art.box("empty-sales-desk", 0, 0.8, 0.6, 1.2, 0.15, 0.65, 0x8c539d),
        );
        for (const x of [-0.45, 0.45])
          parts.push(
            art.box(
              "sales-desk-leg",
              x,
              0.4,
              0.6,
              0.12,
              0.8,
              0.5,
              palette.wood,
            ),
          );
        parts.push(
          art.box(
            "empty-sales-tray",
            0,
            0.92,
            0.6,
            0.85,
            0.06,
            0.45,
            palette.cream,
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
        // A warm red-and-cream stall, a gold shop emblem and an empty sales
        // counter distinguish retail from the cool industrial equipment.
        parts.push(
          art.box("market-counter", 0, 0.55, 0.7, 2.3, 1.0, 1.0, 0x9f563a),
          art.box("counter-top", 0, 1.1, 0.7, 2.5, 0.18, 1.15, palette.cut),
          art.box("counter-front-panel", 0, 0.62, 0.17, 1.85, 0.62, 0.12, 0xd18a59),
        );
        for (const x of [-1.15, 1.15])
          parts.push(
            art.box("market-post", x, 1.48, 0.7, 0.24, 2.8, 0.24, 0x965839),
          );
        // Slightly sloped canopy with broad alternating cloth panels.
        for (let k = 0; k < 5; k++) {
          const panel = art.box(
            "awning-panel", (k - 2) * 0.6, 2.76, 0.65, 0.61, 0.20, 1.95,
            k % 2 ? 0xffe7b4 : 0xcc5942,
          );
          panel.rotation.x = -0.12;
          parts.push(panel);
          parts.push(
            art.box("awning-valance", (k - 2) * 0.6, 2.57, -0.31, 0.61, 0.25, 0.16,
              k % 2 ? 0xffe7b4 : 0xcc5942),
          );
        }
        const emblem = art.resource("coin", "market-coin-sign");
        emblem.scaling.setAll(2.5);
        emblem.position.set(0, 2.24, -0.37);
        parts.push(emblem);
      } else if (tile.id === "sawmill") {
        // Broad, recognizable machine: dark frame, gold safety arch, visible
        // circular saw, orange raw intake and pale processed-wood outfeed.
        parts.push(
          art.box("machine-bed", 0, 0.83, 0, 3.8, 0.36, 1.55, palette.ink),
          art.box("machine-base", 0, 0.18, 0.16, 2.7, 0.36, 1.48, 0x35696b),
        );
        for (const x of [-1.35, 1.35])
          for (const z of [-0.48, 0.48])
            parts.push(
              art.box("machine-foot", x, 0.43, z, 0.42, 0.86, 0.42, 0x35696b),
            );
        for (const z of [-0.68, 0.68]) {
          parts.push(
            art.box("feed-funnel", 1.18, 1.16, z, 1.36, 0.5, 0.24, 0xcc8c43),
            art.box("output-guide", -1.18, 1.05, z * 0.74, 1.3, 0.16, 0.14, 0xffd99a),
          );
        }
        for (const x of [-0.72, 0.72])
          parts.push(
            art.box("saw-guard-post", x, 1.64, 0.51, 0.34, 1.52, 0.38, 0xdfa646),
          );
        parts.push(
          art.box("saw-guard-arch", 0, 2.42, 0.48, 1.9, 0.34, 0.65, 0xf3c260),
          art.box("guard-light", 0, 2.43, 0.10, 0.60, 0.15, 0.08, 0xffefad),
          art.box("motor-housing", 0.15, 1.4, 0.60, 0.98, 1.05, 0.65, palette.teal),
          art.box("motor-face", 0.15, 1.40, 0.24, 0.70, 0.64, 0.10, 0x326c72),
        );
        for (let i = 0; i < 3; i++)
          parts.push(
            art.box("motor-vent", -0.09 + i * 0.24, 1.40, 0.17, 0.10, 0.39, 0.04, palette.ink),
          );
        parts.push(
          art.box("amber-switch", 0.70, 1.26, -0.60, 0.28, 0.28, 0.14, 0xffc35e),
        );
        // No decorative timber or boards: live production meshes supply them.
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
      const purchaseSeal = art.cylinder(
        "gold-purchase-cap",
        0.85,
        0.32,
        -0.5,
        0.16,
        0.2,
        0.18,
        palette.gold,
        8,
      );
      parts.push(purchaseSeal);
      const base = art.merge(`investment-${tile.id}`, parts);
      if (tile.id === "sawmill") base.scaling.set(1.06, 1.1, 1.06);
      base.position.copyFrom(worldPoint(tile.x, tile.y));
      this.bases.push(base);
      shadows.addShadowCaster(base);
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
      art.box("customer-deck", 0, 0.04, 0, 3.1, 0.08, 1.6, palette.wood),
      art.box("deck-edge", 0, 0.09, -0.7, 3.15, 0.06, 0.12, palette.cut),
    ]);
    deck.position.copyFrom(
      worldPoint(customerPoint.x - 29, customerPoint.y + 15),
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
    for (const base of this.bases) {
      const tile = this.game.investments.tiles.find(
        (t) => base.name === `investment-${t.id}`,
      );
      if (!tile) continue;
      const distance = Math.hypot(
        this.game.player.x - tile.x,
        this.game.player.y - tile.y,
      );
      // Secondary upgrade props emerge only near their interaction area. Core production stays visible.
      const primary = tile.id === "sawmill" || tile.id === "market";
      let enabled = primary || distance < 150;
      base.visibility = primary
        ? 1
        : Math.max(0, Math.min(1, (150 - distance) / 50));
      if (tile.id === "bounty") enabled &&= this.game.s.zone > 0;
      for (const id of ["conveyor", "hauler", "sawyer"] as const)
        if (tile.id === id) enabled &&= !this.game.investments.production[id];
      base.setEnabled(enabled);
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
