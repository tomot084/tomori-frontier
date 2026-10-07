import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Art, palette, worldPoint } from "./models";
import { investmentTiles, customerPoint, marketPoint } from "./investments";
import type { GameModel } from "./simulation";
export class InvestmentView {
  waiter: ReturnType<Art["helper"]>;
  customers: ReturnType<Art["helper"]>[] = [];
  bases: ReturnType<Art["merge"]>[] = [];
  stock: ReturnType<Art["merge"]>;
  constructor(
    private art: Art,
    private game: GameModel,
    shadows: ShadowGenerator,
  ) {
    for (const tile of investmentTiles) {
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
        parts.push(
          art.box("market-counter", 0, 0.6, 0.7, 2.15, 1.0, 0.9, palette.wood),
        );
        for (const x of [-0.85, 0.85])
          parts.push(
            art.box(
              "market-post",
              x,
              1.12,
              0.7,
              0.22,
              2.8,
              0.22,
              palette.leather,
            ),
          );
        parts.push(
          art.box(
            "market-canopy",
            0,
            2.65,
            0.6,
            3.05,
            0.22,
            1.55,
            palette.teal,
          ),
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
        // Feed funnel on the right; narrow pale lumber exits on the left.
        parts.push(
          art.box("machine-bed", 0, 0.86, 0, 3.65, 0.38, 1.35, palette.ink),
        );
        for (const x of [-1.35, 1.35])
          for (const z of [-0.42, 0.42])
            parts.push(
              art.box(
                "machine-foot",
                x,
                0.43,
                z,
                0.34,
                0.86,
                0.34,
                palette.teal,
              ),
            );
        for (const z of [-0.65, 0.65]) {
          parts.push(
            art.box(
              "feed-funnel",
              1.12,
              1.13,
              z,
              1.35,
              0.43,
              0.25,
              palette.teal,
            ),
          );
          parts.push(
            art.box(
              "output-guide",
              -1.1,
              1.02,
              z * 0.65,
              1.2,
              0.14,
              0.1,
              palette.cut,
            ),
          );
        }
        for (const x of [-0.65, 0.65])
          parts.push(
            art.box(
              "saw-guard-post",
              x,
              1.63,
              0.48,
              0.28,
              1.5,
              0.28,
              palette.teal,
            ),
          );
        parts.push(
          art.box("saw-guard-arch", 0, 2.4, 0.4, 1.7, 0.36, 0.58, palette.teal),
        );
        parts.push(
          art.box("guard-light", 0, 2.43, 0.12, 0.55, 0.12, 0.06, palette.gold),
        );
        parts.push(
          art.box(
            "motor-housing",
            0.15,
            1.4,
            0.43,
            0.95,
            1.05,
            0.62,
            palette.teal,
          ),
        );
        for (let i = 0; i < 3; i++)
          parts.push(
            art.box(
              "motor-vent",
              -0.15 + i * 0.24,
              1.48,
              0.76,
              0.09,
              0.42,
              0.035,
              palette.ink,
            ),
          );
        parts.push(
          art.box(
            "amber-switch",
            0.7,
            1.25,
            -0.58,
            0.26,
            0.26,
            0.14,
            palette.gold,
          ),
        );
        const timber = art.log("feed-example-log");
        timber.scaling.setAll(1.6);
        timber.position.set(1.05, 1.08, 0);
        parts.push(timber);
        for (let i = 0; i < 3; i++)
          parts.push(
            art.box(
              "exit-example-plank",
              -1.13,
              1.06 + i * 0.13,
              0,
              1.05,
              0.1,
              0.42,
              palette.cut,
            ),
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
      if (tile.id === "market") {
        for (let i = 0; i < 5; i++)
          parts.push(
            art.box(
              "awning-stripe",
              (i - 2) * 0.6,
              2.78,
              0.6,
              0.3,
              0.04,
              1.55,
              palette.cream,
            ),
          );
        for (let i = 0; i < 4; i++)
          parts.push(
            art.box(
              "sale-plank",
              -0.35,
              1.1 + i * 0.14,
              0.55,
              1.2,
              0.11,
              0.4,
              palette.cut,
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
      if (base.name === "investment-bounty")
        base.setEnabled(this.game.s.zone > 0);
      for (const id of ["conveyor", "hauler", "sawyer"] as const)
        if (base.name === `investment-${id}`)
          base.setEnabled(!this.game.investments.production[id]);
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
