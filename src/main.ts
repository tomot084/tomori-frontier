import Phaser from "phaser";
import "./style.css";
import {
  resourceData,
  gatherableData,
  enemyData,
  upgradeData,
  buildingData,
  stats,
  cost,
  deposit,
  complete,
  upgrade,
  load,
  KEY,
  type Resource,
  type Upgrade,
  type Save,
} from "./data";
const el = (id: string) => document.getElementById(id)!;
interface Gatherable {
  x: number;
  y: number;
  kind: "wood" | "stone" | "food";
  hp: number;
  dead: number;
  view: Phaser.GameObjects.Container;
  flash: number;
}
interface Enemy {
  x: number;
  y: number;
  type: number;
  hp: number;
  dead: number;
  cool: number;
  view: Phaser.GameObjects.Container;
  bar: Phaser.GameObjects.Graphics;
  homeX: number;
  homeY: number;
}
interface DropItem {
  x: number;
  y: number;
  kind: Resource;
  view: Phaser.GameObjects.Container;
  age: number;
  vx: number;
  vy: number;
}
class Player {
  view: Phaser.GameObjects.Container;
  bag: Phaser.GameObjects.Graphics;
  tool: Phaser.GameObjects.Container;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    const shadow = scene.add.ellipse(0, 13, 34, 15, 0x082b30, 0.4);
    const g = scene.add.graphics();
    g.fillStyle(0x284955).fillRoundedRect(-12, -6, 24, 26, 8);
    g.fillStyle(0xe7c477).fillRoundedRect(-10, -12, 20, 19, 7);
    g.fillStyle(0x102f36).fillRect(-5, -5, 3, 3).fillRect(3, -5, 3, 3);
    g.fillStyle(0x639e9b).fillTriangle(-15, -10, 15, -10, 0, -32);
    g.fillStyle(0xf3e5a0).fillCircle(0, -21, 4);
    g.fillStyle(0xeee2c2).fillRect(-8, 17, 5, 6).fillRect(3, 17, 5, 6);
    this.bag = scene.add.graphics();
    const t = scene.add.graphics();
    t.lineStyle(4, 0xad815b).lineBetween(0, 0, 25, -10);
    t.fillStyle(0xe8ebcf).fillTriangle(20, -19, 33, -12, 21, -5);
    this.tool = scene.add.container(8, 0, [t]);
    this.tool.setVisible(false);
    this.view = scene.add.container(x, y, [shadow, this.bag, g, this.tool]);
  }
}
class Frontier extends Phaser.Scene {
  s: Save = load(localStorage.getItem(KEY));
  player!: Player;
  nodes: Gatherable[] = [];
  enemies: Enemy[] = [];
  drops: DropItem[] = [];
  buildings: Phaser.GameObjects.Container[] = [];
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  stick = { id: -1, x: 0, y: 0, dx: 0, dy: 0 };
  stickG!: Phaser.GameObjects.Graphics;
  attackAt = 0;
  gatherAt = 0;
  depositAt = 0;
  saveAt = 0;
  hudAt = 0;
  effects = 0;
  started = false;
  shopShown = false;
  fog!: Phaser.GameObjects.Graphics;
  toastTimer = 0;
  lastDir = 0;
  cameraTarget!: Phaser.GameObjects.Zone;
  hitUntil = 0;
  world!: Phaser.GameObjects.Graphics;
  inputMove = { x: 0, y: 0 };
  constructor() {
    super("frontier");
  }
  create() {
    this.drawWorld();
    this.makeNodes();
    this.makeEnemies();
    this.makeBuildings();
    this.fog = this.add.graphics().setDepth(2000);
    this.paintFog();
    this.player = new Player(this, this.s.x, this.s.y);
    this.cameraTarget = this.add.zone(this.s.x, this.s.y + 50, 1, 1);
    this.cameras.main
      .setBounds(0, 100, 900, 1940)
      .startFollow(this.cameraTarget, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor("#102f36");
    this.stickG = this.add.graphics().setScrollFactor(0).setDepth(10000);
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT",
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.addPointer(2);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (
        !this.started ||
        this.stick.id !== -1 ||
        p.x > this.scale.width * 0.58 ||
        p.y < this.scale.height * 0.45
      )
        return;
      this.stick = { id: p.id, x: p.x, y: p.y, dx: 0, dy: 0 };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stick.id) return;
      const dx = p.x - this.stick.x,
        dy = p.y - this.stick.y,
        d = Math.hypot(dx, dy);
      this.stick.dx = dx / Math.max(48, d);
      this.stick.dy = dy / Math.max(48, d);
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (p.id === this.stick.id) this.release();
    });
    this.input.on("gameout", () => this.release());
    window.addEventListener("blur", () => {
      this.release();
      this.persist();
    });
    document.addEventListener("visibilitychange", () => {
      this.release();
      this.persist();
    });
    el("start").onclick = () => {
      el("intro").remove();
      this.started = true;
      this.toast("左下をドラッグして移動 · 木に近づこう");
    };
    el("settings").onclick = () => {
      this.release();
      (el("config") as HTMLDialogElement).showModal();
    };
    el("close").onclick = () => {
      (el("config") as HTMLDialogElement).close();
    };
    el("reset").onclick = () => {
      if (confirm("この島の進行をすべて消して、最初から始めますか？")) {
        localStorage.removeItem(KEY);
        location.reload();
      }
    };
    (el("start") as HTMLButtonElement).disabled = false;
    this.scale.on("resize", () => this.release());
    this.updateHud();
    this.paintBags();
    if (
      import.meta.env.DEV ||
      new URLSearchParams(location.search).has("e2e")
    ) {
      (window as unknown as { __game: unknown }).__game = {
        state: () =>
          structuredClone({
            ...this.s,
            x: this.player.view.x,
            y: this.player.view.y,
          }),
        position: (x: number, y: number) => {
          this.player.view.setPosition(x, y);
          this.s.x = x;
          this.s.y = y;
        },
        entities: () => ({
          nodes: this.nodes.map((n) => ({
            x: n.x,
            y: n.y,
            kind: n.kind,
            hp: n.hp,
            dead: n.dead,
          })),
          enemies: this.enemies.map((n) => ({
            x: n.x,
            y: n.y,
            hp: n.hp,
            type: n.type,
            dead: n.dead,
          })),
          buildings: buildingData,
        }),
        save: () => this.persist(),
        input: (x: number, y: number) => {
          this.inputMove = { x, y };
        },
        inspect: () => ({
          drops: this.drops.length,
          effects: this.effects,
          stick: this.stick,
          shop: this.shopShown,
        }),
      };
    }
  }
  release() {
    this.stick.id = -1;
    this.stick.dx = 0;
    this.stick.dy = 0;
    this.inputMove = { x: 0, y: 0 };
    this.keys && Object.values(this.keys).forEach((k) => k.reset());
  }
  drawWorld() {
    this.world = this.add.graphics().setDepth(-100);
    const g = this.world;
    g.fillStyle(0x143944).fillRect(0, 0, 900, 2100);
    for (let z = 0; z < 3; z++) {
      const y = 170 + z * 550;
      g.fillStyle([0x35695c, 0x3a645a, 0x3b5961][z]).fillRoundedRect(
        45,
        y,
        810,
        530,
        80,
      );
      g.lineStyle(8, 0x6f9480, 0.3).strokeRoundedRect(48, y, 804, 524, 78);
      g.fillStyle(0x82a68b, 0.08);
      for (let i = 0; i < 90; i++) {
        const x = 85 + ((i * 137 + z * 93) % 730),
          py = y + 40 + ((i * 79) % 445);
        g.fillEllipse(x, py, 12 + (i % 3) * 8, 6);
      }
      g.fillStyle(0xb1ae79, 0.17).fillRoundedRect(398, y + 20, 104, 490, 35);
    }
    for (let i = 0; i < 45; i++) {
      g.fillStyle(0x8cb8ae, 0.12).fillCircle(
        (i * 173) % 900,
        (i * 97) % 2100,
        2,
      );
    }
    g.fillStyle(0x20444b).fillRoundedRect(350, 1910, 200, 110, 40);
    this.label(450, 250, "灯守の野営地", 16, "#e8db9f");
    this.makeCamp(450, 290);
    this.makeCamp(690, 940);
    this.makeCamp(690, 1490);
    this.label(230, 815, "02 · こだまの庭", 15, "#acd5bb");
    this.label(230, 1365, "03 · 宵風の尾根", 15, "#b6cbd6");
    g.generateTexture("islands", 900, 2100);
    g.destroy();
    this.add.image(0, 0, "islands").setOrigin(0).setDepth(-100);
  }
  makeCamp(x: number, y: number) {
    const g = this.add.graphics();
    g.fillStyle(0x163c40).fillEllipse(x, y + 20, 95, 42);
    g.fillStyle(0xbb915e).fillTriangle(
      x - 40,
      y + 15,
      x + 40,
      y + 15,
      x,
      y - 40,
    );
    g.fillStyle(0xd2b775).fillTriangle(
      x,
      y - 40,
      x + 40,
      y + 15,
      x + 12,
      y + 15,
    );
    g.fillStyle(0x243e42).fillTriangle(
      x - 12,
      y + 15,
      x + 12,
      y + 15,
      x,
      y - 15,
    );
    g.fillStyle(0xffdd92).fillCircle(x + 47, y, 7);
    this.label(x, y + 42, "灯工房 · 回復", 12, "#ebd79b");
  }
  label(x: number, y: number, text: string, size = 12, color = "#eff4d7") {
    return this.add
      .text(x, y, text, {
        fontFamily: "system-ui",
        fontSize: size,
        color,
        align: "center",
        stroke: "#1c4145",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
  }
  makeNodes() {
    for (let z = 0; z < 3; z++) {
      for (let i = 0; i < 19; i++) {
        const kind = (
          i % 5 === 3 ? "stone" : i % 5 === 4 ? "food" : "wood"
        ) as Gatherable["kind"];
        const x = 140 + (i % 4) * 185 + ((i * 17) % 55);
        const y = 390 + z * 550 + Math.floor(i / 4) * 62;
        if (z === 0 || Math.hypot(x - 690, y - (940 + (z - 1) * 550)) > 98)
          this.addNode(x, y, kind);
      }
    }
  }
  addNode(x: number, y: number, kind: Gatherable["kind"]) {
    const g = this.add.graphics();
    const shadow = this.add.ellipse(0, 12, 50, 19, 0x122f32, 0.3);
    if (kind === "wood") {
      g.fillStyle(0x896346).fillRoundedRect(-6, -8, 12, 28, 3);
      g.fillStyle(0x224c42).fillTriangle(-28, -7, 28, -7, 0, -62);
      g.fillStyle(0x4d946d).fillTriangle(-23, -22, 23, -22, 0, -67);
      g.fillStyle(0x77b483).fillTriangle(-16, -38, 16, -38, 0, -72);
      g.fillStyle(0xd9df99).fillCircle(-7, -44, 3).fillCircle(10, -28, 2);
    } else if (kind === "stone") {
      g.fillStyle(0x627e88).fillPoints(
        [
          { x: -27, y: 9 },
          { x: -21, y: -15 },
          { x: 2, y: -30 },
          { x: 24, y: -13 },
          { x: 29, y: 10 },
        ],
        true,
      );
      g.fillStyle(0xa0b4b3).fillTriangle(-21, -15, 2, -30, 1, 5);
      g.lineStyle(2, 0xc1ccc0).lineBetween(3, -20, 15, -11);
    } else {
      g.fillStyle(0x3c825e)
        .fillCircle(-12, 0, 16)
        .fillCircle(11, -5, 19)
        .fillCircle(0, -17, 15);
      g.fillStyle(0xf0a183)
        .fillCircle(-10, -9, 5)
        .fillCircle(9, -19, 5)
        .fillCircle(16, 1, 4);
    }
    const v = this.add.container(x, y, [shadow, g]);
    v.setDepth(y);
    this.nodes.push({
      x,
      y,
      kind,
      hp: gatherableData[kind].hp,
      dead: 0,
      view: v,
      flash: 0,
    });
  }
  makeEnemies() {
    for (let z = 1; z <= 2; z++)
      for (let i = 0; i < 7; i++) {
        const type = i % 3,
          x = 180 + (i % 3) * 230,
          y = 870 + (z - 1) * 550 + Math.floor(i / 3) * 125;
        const d = enemyData[type],
          g = this.add.graphics();
        g.fillStyle(0x102f36, 0.4).fillEllipse(0, 12, 34, 15);
        g.fillStyle(d.color);
        if (type === 0) {
          g.fillCircle(0, -2, 17);
          g.fillStyle(0xcfc1e0).fillCircle(-6, -9, 8);
        }
        if (type === 1) {
          g.fillEllipse(0, 0, 47, 35);
          g.lineStyle(3, 0x416c58)
            .lineBetween(-17, -8, 17, 8)
            .lineBetween(-17, 8, 17, -8);
          g.fillStyle(0xc0d299).fillTriangle(-12, -12, 0, -32, 7, -12);
        }
        if (type === 2) {
          g.fillTriangle(-28, -16, -4, -1, -10, 10)
            .fillTriangle(28, -16, 4, -1, 10, 10)
            .fillEllipse(0, 0, 18, 29);
        }
        g.fillStyle(0x1c3941).fillCircle(-5, -3, 3).fillCircle(5, -3, 3);
        g.fillStyle(0xf4e9c2).fillCircle(-5, -4, 1).fillCircle(5, -4, 1);
        const bar = this.add.graphics();
        const v = this.add.container(x, y, [g, bar]);
        this.enemies.push({
          x,
          y,
          type,
          hp: d.hp,
          dead: 0,
          cool: 0,
          view: v,
          bar,
          homeX: x,
          homeY: y,
        });
      }
  }
  makeBuildings() {
    buildingData.forEach((b, i) => {
      const g = this.add.graphics();
      const text = this.label(0, -15, "", 13);
      const c = this.add.container(450, b.y, [g, text]);
      this.buildings.push(c);
      this.paintBuilding(i);
    });
  }
  paintBuilding(i: number) {
    const b = buildingData[i],
      c = this.buildings[i],
      g = c.list[0] as Phaser.GameObjects.Graphics,
      t = c.list[1] as Phaser.GameObjects.Text;
    g.clear();
    if (this.s.zone > i) {
      if (i < 2) {
        g.fillStyle(0x9b8157).fillRoundedRect(-62, -37, 124, 80, 8);
        g.lineStyle(3, 0x5c624b);
        for (let y = -30; y < 40; y += 12) g.lineBetween(-59, y, 59, y);
        g.lineStyle(5, 0xd1bd88)
          .lineBetween(-58, -40, -58, 42)
          .lineBetween(58, -40, 58, 42);
      } else {
        g.fillStyle(0x9dbcb3).fillRoundedRect(-20, -70, 40, 95, 9);
        g.fillStyle(0xffe19c).fillCircle(0, -75, 23);
        g.lineStyle(5, 0xd9c98a).strokeCircle(0, -75, 30);
      }
      t.setText(i === 2 ? "暁の灯台 · 復旧！" : "").setY(55);
    } else {
      g.lineStyle(3, 0xe4ce89, 0.8).strokeRoundedRect(-66, -34, 132, 70, 13);
      g.fillStyle(0x1b3b44, 0.8).fillRoundedRect(-64, -32, 128, 66, 13);
      g.lineStyle(3, 0x597983)
        .lineBetween(-35, 15, 0, -18)
        .lineBetween(0, -18, 35, 15);
      const p = this.s.progress[i];
      t.setText(
        `↓ ${b.name}\n木 ${p.wood}/${b.cost.wood}  石 ${p.stone}/${b.cost.stone}${b.cost.food ? `\n実 ${p.food}/${b.cost.food}` : ""}`,
      ).setY(-66);
    }
    c.setDepth(b.y - 60);
    c.setVisible(i <= this.s.zone);
  }
  toast(msg: string) {
    el("toast").textContent = msg;
    el("toast").style.opacity = "1";
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(
      () => (el("toast").style.opacity = "0"),
      3300,
    );
  }
  pop(x: number, y: number, text: string, color = "#fff2b9") {
    if (this.effects >= 48) return;
    this.effects++;
    const t = this.label(x, y, text, 14, color).setDepth(5000);
    this.tweens.add({
      targets: t,
      y: y - 35,
      alpha: 0,
      duration: 800,
      onComplete: () => {
        t.destroy();
        this.effects--;
      },
    });
  }
  burst(x: number, y: number, color: number, count = 6) {
    for (let i = 0; i < count && this.effects < 48; i++) {
      this.effects++;
      const p = this.add
        .circle(x, y, 2 + Math.random() * 2, color)
        .setDepth(4000);
      this.tweens.add({
        targets: p,
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 60,
        alpha: 0,
        scale: 0,
        duration: 400,
        onComplete: () => {
          p.destroy();
          this.effects--;
        },
      });
    }
  }
  drop(x: number, y: number, kind: Resource, n: number) {
    for (let i = 0; i < n; i++) {
      if (this.drops.length >= 64) {
        const existing = this.drops.find((d) => d.kind === kind);
        if (existing) {
          existing.age = 1;
        }
        continue;
      }
      const g = this.add.graphics();
      g.fillStyle(resourceData[kind].color);
      if (kind === "wood") {
        g.fillRoundedRect(-6, -3, 12, 6, 2);
        g.lineStyle(1, 0x775939).lineBetween(-3, -3, -3, 3);
      } else if (kind === "stone") g.fillTriangle(-5, 4, 0, -6, 6, 3);
      else g.fillCircle(0, 0, kind === "coin" ? 4 : 5);
      const v = this.add.container(x, y, [g]).setDepth(3000);
      this.drops.push({
        x,
        y,
        kind,
        view: v,
        age: 0,
        vx: (Math.random() - 0.5) * 160,
        vy: -50 - Math.random() * 70,
      });
    }
  }
  swing(target: { x: number; y: number }, kind: string) {
    const t = this.player.tool;
    t.setVisible(true);
    t.setRotation(
      Math.atan2(target.y - this.player.view.y, target.x - this.player.view.x) +
        0.7,
    );
    const g = t.list[0] as Phaser.GameObjects.Graphics;
    g.clear();
    g.lineStyle(4, 0xc49a64).lineBetween(0, 0, 25, 0);
    g.fillStyle(
      kind === "stone" ? 0xa2bbc5 : kind === "enemy" ? 0xffdf92 : 0xdde6c4,
    );
    if (kind === "stone") g.fillRoundedRect(20, -9, 8, 18, 3);
    else g.fillTriangle(19, -13, 33, -5, 21, 6);
    this.tweens.add({
      targets: t,
      rotation: t.rotation - 1.4,
      duration: 160,
      onComplete: () => t.setVisible(false),
    });
  }
  hit(view: Phaser.GameObjects.Container) {
    const old = view.scaleX;
    this.tweens.add({
      targets: view,
      scaleX: old * 0.82,
      scaleY: 1.12,
      duration: 65,
      yoyo: true,
    });
    const g = view.list.find(
      (v) => v instanceof Phaser.GameObjects.Graphics,
    ) as Phaser.GameObjects.Graphics | undefined;
    g?.setAlpha(0.45);
    this.time.delayedCall(90, () => g?.active && g.setAlpha(1));
  }
  paintBags() {
    const g = this.player.bag;
    g.clear();
    const total =
      this.s.resources.wood + this.s.resources.stone + this.s.resources.food;
    const n = Math.min(5, Math.ceil(total / 10));
    for (let i = 0; i < n; i++) {
      g.fillStyle(i % 2 ? 0xa3b5b4 : 0xc49a64).fillRoundedRect(
        -15,
        -8 - i * 6,
        30,
        6,
        3,
      );
      g.lineStyle(1, 0x6e775e).strokeRoundedRect(-15, -8 - i * 6, 30, 6, 3);
    }
  }
  persist() {
    this.s.x = this.player?.view.x ?? this.s.x;
    this.s.y = this.player?.view.y ?? this.s.y;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.s));
    } catch {
      this.toast("保存できません。ブラウザの空き容量を確認してください");
    }
  }
  updateHud() {
    const st = stats(this.s);
    el("resources").innerHTML = (Object.keys(resourceData) as Resource[])
      .map(
        (r) =>
          `<span>${resourceData[r].icon} ${this.s.resources[r]}${r !== "coin" ? `<small>/${r === "food" ? Math.floor(st.capacity / 2) : st.capacity}</small>` : ""}</span>`,
      )
      .join("");
    el("hp").style.width = `${(this.s.hp / st.hp) * 100}%`;
    const b = buildingData[Math.min(this.s.zone, 2)];
    el("goal").textContent = this.s.won
      ? "✦ 三つの島に灯りが戻った！ 自由に探索しよう"
      : `${Math.abs(this.player.view.x - 450) > 150 ? (this.player.view.x > 450 ? "↙" : "↘") : "↓"} ${b.name} · ${this.s.zone + 1}/3 · 距離 ${Math.round(Math.hypot(this.player.view.x - 450, this.player.view.y - b.y))}\n${(
          ["wood", "stone", "food"] as const
        )
          .filter((r) => b.cost[r] > 0)
          .map(
            (r) =>
              `${resourceData[r].name} ${this.s.progress[Math.min(this.s.zone, 2)][r]}/${b.cost[r]}`,
          )
          .join("　")}`;
    this.paintBags();
  }
  shop() {
    const near = [
      [450, 290],
      [690, 940],
      [690, 1490],
    ].some(
      ([x, y], i) =>
        i <= this.s.zone &&
        Math.hypot(this.player.view.x - x, this.player.view.y - y) < 85,
    );
    const show =
      near && this.started && (this.s.zone > 0 || this.s.resources.coin > 0);
    if (show !== this.shopShown) {
      this.shopShown = show;
      el("shop").hidden = !show;
    }
    if (!show) return;
    el("shop").innerHTML =
      "<h3>✦ 灯工房 <small>滞在で回復</small></h3>" +
      (Object.keys(upgradeData) as Upgrade[])
        .map(
          (u) =>
            `<button data-u="${u}" ${this.s.resources.coin < cost(this.s, u) || this.s.levels[u] >= 5 ? "disabled" : ""}>${upgradeData[u].name} Lv.${this.s.levels[u]} · ${upgradeData[u].description} · ${this.s.levels[u] >= 5 ? "MAX" : `✦ ${cost(this.s, u)}`}</button>`,
        )
        .join("");
    el("shop")
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach(
        (button) =>
          (button.onclick = () => {
            if (upgrade(this.s, button.dataset.u as Upgrade)) {
              this.burst(this.player.view.x, this.player.view.y, 0xffdd83, 10);
              this.pop(this.player.view.x, this.player.view.y - 40, "強化！");
              this.persist();
              this.updateHud();
              this.shop();
            }
          }),
      );
  }
  update(time: number, delta: number) {
    if (!this.player) return;
    this.drawStick();
    if (!this.started || (el("config") as HTMLDialogElement).open) return;
    const dt = Math.min(delta, 60) / 1000,
      p = this.player.view,
      st = stats(this.s);
    this.s.time += dt;
    let dx =
        this.stick.dx +
        this.inputMove.x +
        (Number(this.keys.D.isDown || this.keys.RIGHT.isDown) -
          Number(this.keys.A.isDown || this.keys.LEFT.isDown)),
      dy =
        this.stick.dy +
        this.inputMove.y +
        (Number(this.keys.S.isDown || this.keys.DOWN.isDown) -
          Number(this.keys.W.isDown || this.keys.UP.isDown));
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    if (time > this.hitUntil) {
      p.x = Phaser.Math.Clamp(p.x + dx * st.speed * dt, 80, 820);
      p.y = Phaser.Math.Clamp(
        p.y + dy * st.speed * dt,
        190,
        this.s.zone < 3 ? buildingData[this.s.zone].y - 39 : 1965,
      );
      for (const b of buildingData.slice(0, Math.min(this.s.zone, 2))) {
        if (Math.abs(p.y - b.y) < 38 && (p.x < 395 || p.x > 505)) {
          p.y = dy >= 0 ? b.y - 39 : b.y + 39;
        }
      }
    }
    p.setDepth(p.y + 30);
    if (len > 0.1) {
      this.lastDir = Math.atan2(dy, dx);
      p.setAngle(Math.sin(time / 80) * 2);
    } else p.setAngle(0);
    this.cameraTarget.setPosition(
      p.x,
      p.y + Math.min(55, this.scale.height * 0.07),
    );
    if (time > this.gatherAt) {
      const n = this.nodes.find(
        (n) =>
          !n.dead &&
          n.y < buildingData[Math.min(this.s.zone, 2)].y &&
          (this.s.zone >= 2 || n.y < buildingData[this.s.zone].y) &&
          Math.hypot(p.x - n.x, p.y - n.y) < 65 &&
          this.s.resources[n.kind] <
            (n.kind === "food" ? Math.floor(st.capacity / 2) : st.capacity),
      );
      if (n) {
        this.gatherAt = time + st.gather;
        this.swing(n, n.kind);
        n.hp -= 3;
        this.hit(n.view);
        this.pop(n.x, n.y - 48, "−3");
        this.burst(n.x, n.y - 20, resourceData[n.kind].color, 4);
        if (n.hp <= 0) {
          n.dead = time + gatherableData[n.kind].respawn * 1000;
          this.drop(n.x, n.y, n.kind, gatherableData[n.kind].yield);
          this.tweens.add({
            targets: n.view,
            alpha: 0,
            scale: 0.2,
            duration: 240,
          });
          if (!this.s.resources.wood && n.kind === "wood")
            this.toast("素材は自動回収 · 橋の枠へ運ぼう");
        }
      }
    }
    this.nodes.forEach((n) => {
      if (n.dead && time > n.dead) {
        n.dead = 0;
        n.hp = gatherableData[n.kind].hp;
        n.view.setAlpha(1).setScale(1);
      }
    });
    let nearest: Enemy | undefined,
      dist = Infinity;
    for (const e of this.enemies) {
      const zone = e.homeY > 1300 ? 2 : 1;
      e.view.setVisible(zone <= this.s.zone && !e.dead);
      if (zone > this.s.zone) continue;
      if (e.dead) {
        if (time > e.dead) {
          e.dead = 0;
          e.hp = enemyData[e.type].hp;
          e.x = e.homeX;
          e.y = e.homeY;
        }
        continue;
      }
      const d = enemyData[e.type],
        distance = Math.hypot(e.x - p.x, e.y - p.y);
      if (distance < dist) {
        dist = distance;
        nearest = e;
      }
      if (
        distance < 230 &&
        distance > d.range &&
        ![
          [450, 290],
          [690, 940],
          [690, 1490],
        ].some(
          ([x, y], i) => i <= this.s.zone && Math.hypot(p.x - x, p.y - y) < 85,
        )
      ) {
        e.x += ((p.x - e.x) / distance) * d.speed * dt;
        e.y += ((p.y - e.y) / distance) * d.speed * dt;
      }
      if (
        distance < d.range + 6 &&
        time > e.cool &&
        ![
          [450, 290],
          [690, 940],
          [690, 1490],
        ].some(
          ([x, y], i) => i <= this.s.zone && Math.hypot(p.x - x, p.y - y) < 85,
        )
      ) {
        e.cool = time + 1200;
        this.s.hp -= d.attack;
        this.hit(p);
        this.pop(p.x, p.y - 40, `−${d.attack}`, "#ffae98");
        this.cameras.main.shake(80, 0.0015);
        if (this.s.hp <= 0) {
          this.s.hp = st.hp;
          p.setPosition(450, 330);
          this.toast("灯があなたを野営地へ運んだ · 素材は無事！");
        }
      }
      e.view.setPosition(e.x, e.y).setDepth(e.y + 20);
      e.bar.clear();
      e.bar.fillStyle(0x163337).fillRoundedRect(-20, -35, 40, 5, 2);
      e.bar
        .fillStyle(0xf0ac98)
        .fillRoundedRect(-20, -35, (40 * e.hp) / d.hp, 5, 2);
    }
    if (nearest && dist < 75 && time > this.attackAt) {
      this.attackAt = time + 650;
      const e = nearest;
      this.swing(e, "enemy");
      e.hp -= st.attack;
      this.hit(e.view);
      this.hitUntil = time + 45;
      this.pop(e.x, e.y - 40, `−${st.attack}`);
      this.burst(e.x, e.y, enemyData[e.type].color, 5);
      const angle = Math.atan2(e.y - p.y, e.x - p.x);
      e.x += Math.cos(angle) * 13;
      e.y += Math.sin(angle) * 13;
      if (e.hp <= 0) {
        e.dead = time + 24000;
        e.view.setVisible(false);
        this.s.kills++;
        this.drop(e.x, e.y, "coin", enemyData[e.type].drop);
        this.drop(e.x, e.y, "food", 2);
        this.burst(e.x, e.y, 0xffdd83, 10);
        if (this.s.kills === 1)
          this.toast("灯貨を獲得！ 灯工房で装備を強化しよう");
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      const cap =
        d.kind === "coin"
          ? 99999
          : d.kind === "food"
            ? Math.floor(st.capacity / 2)
            : st.capacity;
      const distance = Math.hypot(d.x - p.x, d.y - p.y);
      if (d.age < 0.3) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vy += 300 * dt;
      } else if (distance < 160 && this.s.resources[d.kind] < cap) {
        const move = Math.min(distance, dt * (180 + d.age * 80));
        d.x += ((p.x - d.x) / Math.max(1, distance)) * move;
        d.y += ((p.y - d.y) / Math.max(1, distance)) * move;
        if (distance < 15) {
          this.s.resources[d.kind]++;
          this.pop(p.x + 18, p.y - 24, `+1 ${resourceData[d.kind].icon}`);
          d.view.destroy();
          this.drops.splice(i, 1);
          continue;
        }
      }
      if (d.age > 45) {
        d.view.destroy();
        this.drops.splice(i, 1);
        continue;
      }
      d.view.setPosition(d.x, d.y);
    }
    if (this.s.zone < 3 && time > this.depositAt) {
      const i = this.s.zone,
        b = buildingData[i];
      if (Math.hypot(p.x - 450, p.y - b.y) < 112) {
        this.depositAt = time + 140;
        const r = (["wood", "stone", "food"] as const).find((r) =>
          deposit(this.s, i, r),
        );
        if (r) {
          const dot = this.add
            .circle(p.x, p.y, 5, resourceData[r].color)
            .setDepth(4000);
          this.tweens.add({
            targets: dot,
            x: 450,
            y: b.y,
            duration: 220,
            onComplete: () => dot.destroy(),
          });
          this.paintBuilding(i);
          if (complete(this.s, i)) {
            this.s.zone++;
            this.paintFog();
            this.paintBuilding(i);
            if (i < 2) this.paintBuilding(i + 1);
            this.burst(450, b.y, 0xffe09a, 20);
            this.cameras.main.flash(250, 230, 238, 182);
            this.toast(
              i === 0
                ? "芽渡り橋が完成！ こだまの庭へ"
                : i === 1
                  ? "霧払い門が開いた！ 宵風の尾根へ"
                  : "三つの島に、暁の灯りが戻った！",
            );
            if (i === 2) {
              this.s.won = true;
              this.time.delayedCall(2500, () =>
                this.toast(
                  `開拓達成！ ${Math.floor(this.s.time / 60)}分${Math.floor(this.s.time % 60)}秒 · 霧の仲間 ${this.s.kills}体撃破`,
                ),
              );
            }
            this.persist();
          }
        }
      }
    }
    const atCamp = [
      [450, 290],
      [690, 940],
      [690, 1490],
    ].some(
      ([x, y], i) => i <= this.s.zone && Math.hypot(p.x - x, p.y - y) < 85,
    );
    if (atCamp) this.s.hp = Math.min(st.hp, this.s.hp + 18 * dt);
    else if (
      this.s.hp < st.hp * 0.5 &&
      this.s.resources.food > 0 &&
      time > this.saveAt + 500
    ) {
      this.s.resources.food--;
      this.s.hp = Math.min(st.hp, this.s.hp + 15);
      this.pop(p.x, p.y - 40, "実で回復", "#b6e7aa");
      this.saveAt = time;
    }
    if (time > this.hudAt) {
      this.hudAt = time + 250;
      this.updateHud();
      this.shop();
    }
    if (time > this.saveAt + 3000) {
      this.saveAt = time;
      this.persist();
    }
  }
  paintFog() {
    const g = this.fog;
    g.clear();
    if (this.s.zone < 2) {
      const y = buildingData[this.s.zone].y + 48;
      g.fillStyle(0x15333e, 0.97).fillRect(0, y, 900, 2100 - y);
      g.lineStyle(2, 0x9db8ac, 0.2).lineBetween(0, y, 900, y);
      for (let i = 0; i < 16; i++) {
        g.fillStyle(0x91aca9, 0.045).fillEllipse(
          (i * 167) % 900,
          y + 60 + ((i * 117) % 600),
          160,
          35,
        );
      }
    }
  }
  drawStick() {
    const g = this.stickG;
    g.clear();
    const active = this.stick.id !== -1,
      x = active ? this.stick.x : 82,
      y = active ? this.stick.y : this.scale.height - 110;
    g.lineStyle(2, 0xd7e8ca, active ? 0.5 : 0.18).strokeCircle(x, y, 48);
    g.fillStyle(0xb9d9ba, active ? 0.14 : 0.04).fillCircle(x, y, 48);
    g.fillStyle(0xdae9c3, active ? 0.55 : 0.15).fillCircle(
      x + this.stick.dx * 42,
      y + this.stick.dy * 42,
      19,
    );
  }
}
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "game",
  backgroundColor: "#102f36",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: { antialias: true, pixelArt: false },
  input: { activePointers: 3 },
  audio: { noAudio: true },
  banner: false,
  scene: Frontier,
});

// Observe the actual 100dvh parent: mobile orientation changes can leave a stale canvas.
new ResizeObserver(() => {
  const parent = el("game");
  if (parent.clientWidth && parent.clientHeight)
    game.scale.resize(parent.clientWidth, parent.clientHeight);
}).observe(el("game"));
