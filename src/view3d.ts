import { Keeper } from "./keeper";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Art, color, palette, worldPoint } from "./models";
import { makeScenery, type BuiltSite } from "./scenery";
import { GameModel, type GameEvent, type Point } from "./simulation";
import { buildingData, enemyData, resourceData } from "./data";
interface Actor {
  root: TransformNode;
  mesh: Mesh;
  shadow: Mesh;
  hitAt: number;
  dieAt: number;
  baseY: number;
}
interface Floating {
  element: HTMLElement;
  position: Vector3;
  born: number;
}
interface Fragment {
  mesh: Mesh;
  born: number;
  origin: Vector3;
  velocity: Vector3;
  life: number;
}
export class WorldView {
  keeper = new Keeper();
  async loadAssets() {
    await this.keeper.load(this.art, this.rig);
    this.actors.get("player")!.mesh = this.rig.body;
    this.scene.render();
  }
  engine: Engine;
  scene: Scene;
  camera: FreeCamera;
  art: Art;
  sun: DirectionalLight;
  shadows: ShadowGenerator;
  rig: ReturnType<Art["player"]>;
  scenery: ReturnType<typeof makeScenery>;
  actors = new Map<string, Actor>();
  dropMeshes = new Map<string, Mesh>();
  crewRigs: (ReturnType<Art["helper"]> & { shadow: Mesh })[] = [];
  enemyBars = new Map<string, HTMLElement>();
  dangerRings = new Map<string, Mesh>();
  siteLabels: HTMLElement[] = [];
  campLabels: HTMLElement[] = [];
  particles: Fragment[] = [];
  floats: Floating[] = [];
  shadowMaterial: StandardMaterial;
  time = 0;
  width = 390;
  height = 844;
  target = Vector3.Zero();
  cameraOffset = new Vector3(10, 23, -22);
  shakeUntil = 0;
  swing = { at: -100, kind: "wood", yaw: Math.PI };
  trail: Mesh;
  ring: Mesh;
  lastInventory = "";
  shadowListKey = "";
  visibleActors = 0;
  quality = "balanced";
  pickupBatches = new Map<
    string,
    { count: number; at: number; x: number; y: number }
  >();
  cargoBounceAt = -100;
  depositAt = [-100, -100, -100];
  playerRing!: Mesh;
  guideRing!: Mesh;
  guideLabel!: HTMLElement;
  constructor(
    public canvas: HTMLCanvasElement,
    public model: GameModel,
    private overlay: HTMLElement,
  ) {
    this.engine = new Engine(
      canvas,
      true,
      {
        preserveDrawingBuffer: false,
        stencil: false,
        powerPreference: "high-performance",
        disableWebGL2Support: false,
      },
      false,
    );
    this.engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio, 1.25));
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.46, 0.68, 0.71, 1);
    this.scene.ambientColor = new Color3(0.1, 0.13, 0.12);
    this.scene.skipPointerMovePicking = true;
    this.scene.autoClear = true;
    this.camera = new FreeCamera("quarter-view", Vector3.Zero(), this.scene);
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 95;
    const sky = new HemisphericLight(
      "soft-sky",
      new Vector3(-0.2, 1, 0.1),
      this.scene,
    );
    sky.intensity = 0.9;
    sky.diffuse = new Color3(0.94, 1, 0.96);
    sky.groundColor = new Color3(0.62, 0.72, 0.64);
    sky.specular = Color3.Black();
    this.sun = new DirectionalLight(
      "afternoon-sun",
      new Vector3(0.35, -1, 0.4),
      this.scene,
    );
    this.sun.intensity = 0.68;
    this.sun.diffuse = new Color3(1, 0.94, 0.79);
    this.sun.specular = Color3.Black();
    this.sun.shadowMinZ = 1;
    this.sun.shadowMaxZ = 65;
    this.sun.shadowFrustumSize = 30;
    this.shadows = new ShadowGenerator(512, this.sun);
    this.shadows.useBlurExponentialShadowMap = true;
    this.shadows.blurKernel = 12;
    this.shadows.blurScale = 2;
    this.shadows.depthScale = 20;
    this.shadows.bias = 0.001;
    this.shadows.normalBias = 0.025;
    this.shadows.setDarkness(0.18);
    this.art = new Art(this.scene);
    this.guideRing = MeshBuilder.CreateTorus(
      "next-action",
      { diameter: 2.1, thickness: 0.075, tessellation: 32 },
      this.scene,
    );
    const guidePaint = new StandardMaterial("guide-gold", this.scene);
    guidePaint.diffuseColor = color(0xffe19b);
    guidePaint.emissiveColor = color(0xbfa968);
    guidePaint.disableLighting = true;
    this.guideRing.material = guidePaint;
    this.guideRing.isPickable = false;
    this.guideLabel = document.createElement("div");
    this.guideLabel.className = "guide-label";
    overlay.append(this.guideLabel);
    this.shadowMaterial = this.makeShadowMaterial();
    this.scenery = makeScenery(this.art);
    this.rig = this.art.player();
    this.rig.root.scaling.setAll(1.25);
    this.rig.root.rotation.y = Math.PI;
    this.playerRing = MeshBuilder.CreateTorus(
      "keeper-foot-ring",
      { diameter: 1.28, thickness: 0.045, tessellation: 32 },
      this.scene,
    );
    this.art.tint(this.playerRing, 0xffe5a1);
    this.playerRing.position.y = 0.06;
    for (const n of model.nodes) {
      const root = new TransformNode(n.id, this.scene);
      root.position.copyFrom(worldPoint(n.x, n.y));
      const mesh =
        n.kind === "wood"
          ? this.art.tree(n.x + n.y, n.zone)
          : n.kind === "stone"
            ? this.art.boulder(n.x)
            : this.art.berry();
      mesh.parent = root;
      const shadow = this.shadow(n.kind === "wood" ? 2.8 : 1.6);
      shadow.position.copyFrom(root.position);
      shadow.position.y = 0.034;
      this.actors.set(n.id, {
        root,
        mesh,
        shadow,
        hitAt: -100,
        dieAt: -100,
        baseY: 0,
      });
      if (n.kind === "wood") {
        const stump = this.art.cylinder(
          "tree-stump",
          0,
          0.09,
          0,
          0.19,
          0.25,
          0.18,
          0xbc955f,
          8,
        );
        stump.position.addInPlace(root.position);
        stump.freezeWorldMatrix();
      }
    }
    for (const e of model.enemies) {
      const root = new TransformNode(e.id, this.scene);
      const mesh = this.art.enemy(e.type);
      mesh.parent = root;
      const shadow = this.shadow(e.type === 1 ? 1.25 : 0.95);
      this.actors.set(e.id, {
        root,
        mesh,
        shadow,
        hitAt: -100,
        dieAt: -100,
        baseY: 0,
      });
      const bar = document.createElement("div");
      bar.className = "enemy-health";
      bar.innerHTML = `<i></i><span>${enemyData[e.type].name}</span>`;
      const danger = MeshBuilder.CreateTorus(
        "enemy-warning",
        {
          diameter: e.type === 1 ? 1.6 : 1.2,
          thickness: 0.035,
          tessellation: 20,
        },
        this.scene,
      );
      this.art.tint(danger, 0xe68d73);
      this.dangerRings.set(e.id, danger);
      overlay.append(bar);
      this.enemyBars.set(e.id, bar);
    }
    this.crewRigs = model.crew.workers.map((w) => ({
      ...this.art.helper(w.id),
      shadow: this.shadow(0.8),
    }));
    const playerShadow = this.shadow(0.95);
    this.actors.set("player", {
      root: this.rig.root,
      mesh: this.rig.body,
      shadow: playerShadow,
      hitAt: -100,
      dieAt: -100,
      baseY: 0,
    });
    this.ring = MeshBuilder.CreateTorus(
      "harvest-focus",
      { diameter: 1.7, thickness: 0.035, tessellation: 24 },
      this.scene,
    );
    this.art.tint(this.ring, 0xffe4a4);
    this.ring.setEnabled(false);
    const paths = [1.1, 2.25].map((r) =>
      Array.from({ length: 15 }, (_, i) => {
        const a = -1.15 + (i * 2.3) / 14;
        return new Vector3(Math.sin(a) * r, 0.9, Math.cos(a) * r);
      }),
    );
    this.trail = MeshBuilder.CreateRibbon(
      "tool-swoosh",
      { pathArray: paths, sideOrientation: Mesh.DOUBLESIDE },
      this.scene,
    );
    const trailMat = new StandardMaterial("swoosh-glow", this.scene);
    trailMat.diffuseColor = new Color3(1, 0.9, 0.58);
    trailMat.emissiveColor = new Color3(0.5, 0.38, 0.15);
    trailMat.disableLighting = true;
    trailMat.alpha = 0.65;
    this.trail.material = trailMat;
    this.trail.isPickable = false;
    this.trail.setEnabled(false);
    buildingData.forEach((b, i) => {
      const label = document.createElement("div");
      label.className = "site-label";
      label.dataset.site = String(i);
      overlay.append(label);
      this.siteLabels.push(label);
    });
    for (let i = 0; i < 3; i++) {
      const label = document.createElement("div");
      label.className = "camp-label";
      label.textContent = "灯工房 · 回復";
      overlay.append(label);
      this.campLabels.push(label);
    }
    this.target.copyFrom(worldPoint(model.player.x, model.player.y));
    this.resize();
    this.syncSites();
  }
  makeShadowMaterial() {
    const tex = new DynamicTexture(
      "contact-shadow",
      { width: 64, height: 64 },
      this.scene,
      false,
    );
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
    g.addColorStop(0, "rgba(255,255,255,.6)");
    g.addColorStop(0.5, "rgba(255,255,255,.28)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    tex.hasAlpha = true;
    tex.update();
    const m = new StandardMaterial("soft-contact-shadow", this.scene);
    m.diffuseTexture = tex;
    m.useAlphaFromDiffuseTexture = true;
    m.diffuseColor = new Color3(0.13, 0.26, 0.23);
    m.disableLighting = true;
    m.alpha = 0.65;
    m.disableDepthWrite = true;
    return m;
  }
  shadow(size: number) {
    const m = MeshBuilder.CreateGround(
      "soft-shadow",
      { width: size, height: size * 0.78 },
      this.scene,
    );
    m.material = this.shadowMaterial;
    m.isPickable = false;
    return m;
  }
  resize() {
    this.width = this.canvas.parentElement!.clientWidth;
    this.height = this.canvas.parentElement!.clientHeight;
    this.engine.resize();
    const ratio = this.width / this.height;
    const halfHeight = ratio < 0.8 ? 7.8 : 8;
    const halfWidth = halfHeight * ratio;
    this.camera.orthoLeft = -halfWidth;
    this.camera.orthoRight = halfWidth;
    this.camera.orthoTop = halfHeight;
    this.camera.orthoBottom = -halfHeight;
    this.sun.shadowFrustumSize = Math.max(30, halfWidth * 2.4);
  }
  /** The visual camera is diagonal; both keyboard and touch move in screen directions. */
  screenInput(input: Point): Point {
    const a = Math.atan2(this.cameraOffset.x, -this.cameraOffset.z),
      c = Math.cos(a),
      s = Math.sin(a);
    return { x: input.x * c + input.y * s, y: -input.x * s + input.y * c };
  }
  project(p: Vector3) {
    const viewport = this.camera.viewport.toGlobal(
      this.engine.getRenderWidth(),
      this.engine.getRenderHeight(),
    );
    const v = Vector3.Project(
      p,
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      viewport,
    );
    return {
      x: (v.x * this.width) / this.engine.getRenderWidth(),
      y: (v.y * this.height) / this.engine.getRenderHeight(),
      z: v.z,
    };
  }
  place(element: HTMLElement, p: Vector3, visible = true) {
    const v = this.project(p);
    const inside =
      visible &&
      v.z > 0 &&
      v.z < 1 &&
      v.x > -100 &&
      v.x < this.width + 100 &&
      v.y > (this.width < this.height ? 200 : 120) &&
      v.y < this.height - 50;
    element.hidden = !inside;
    if (inside) {
      if (
        element.classList.contains("site-label") ||
        element.classList.contains("guide-label")
      ) {
        const half = element.offsetWidth / 2;
        v.x = Math.max(half + 10, Math.min(this.width - half - 10, v.x));
      }
      if (element.classList.contains("site-label")) {
        const half = element.offsetWidth / 2,
          height = element.offsetHeight;
        const faces = [
          worldPoint(this.model.player.x, this.model.player.y, 1.7),
          ...this.model.crew.workers
            .filter((w) => w.active)
            .map((w) => worldPoint(w.x, w.y, 1.05)),
        ];
        for (const face of faces) {
          const actor = this.project(face);
          if (
            Math.abs(actor.x - v.x) < half + 20 &&
            actor.y > v.y - height - 15 &&
            actor.y < v.y + 40
          )
            v.y = Math.min(v.y, actor.y - 18);
        }
        if (v.y - height < (this.width < this.height ? 188 : 75))
          element.hidden = true;
      }
      element.style.transform = `translate(${v.x}px,${v.y}px) translate(-50%,-100%)`;
    }
    return v;
  }
  effects(event: GameEvent) {
    if (event.type === "pickup") {
      this.cargoBounceAt = this.time;
      const key = event.kind!;
      const batch = this.pickupBatches.get(key);
      if (batch) batch.count++;
      else
        this.pickupBatches.set(key, {
          count: 1,
          at: this.time,
          x: event.x,
          y: event.y,
        });
      this.pulse(worldPoint(event.x, event.y, 0.2), 0xffdf93, 0.32, 0.65);
    }
    if (event.type === "swing") {
      const p = this.model.player;
      this.swing = {
        at: this.time,
        kind: event.kind || "wood",
        yaw: Math.atan2(event.x - p.x, -(event.y - p.y)),
      };
      this.ring.position.copyFrom(worldPoint(event.x, event.y, 0.075));
      this.ring.setEnabled(true);
    }
    if (event.type === "hit") {
      const a = this.actors.get(event.id || "");
      if (a) a.hitAt = this.time + 0.1;
      if (event.id === "player" || event.kind === "enemy")
        this.shakeUntil = this.time + 0.14;
      if (event.id !== "player" && this.particles.length < 48) {
        const flash = this.art.sphere(
          "impact-star",
          0,
          0,
          0,
          0.7,
          0.7,
          0.16,
          0xffedaa,
          true,
        );
        flash.position.copyFrom(
          worldPoint(event.x, event.y, event.kind === "wood" ? 1.5 : 0.8),
        );
        flash.material = this.trail.material;
        const origin = flash.position.clone();
        this.particles.push({
          mesh: flash,
          origin,
          born: this.time + 0.1,
          velocity: Vector3.Zero(),
          life: 0.18,
        });
      }
    }
    if (event.type === "death") {
      this.pulse(
        worldPoint(event.x, event.y, 0.15),
        event.kind === "enemy" ? 0xffc970 : 0xffe6aa,
        0.55,
        2.2,
      );
      const a = this.actors.get(event.id || "");
      if (a) a.dieAt = this.time;
    }
    if (event.type === "respawn") {
      const a = this.actors.get(event.id || "");
      if (a) {
        a.dieAt = -100;
        a.root.scaling.setAll(1);
        a.root.rotation.setAll(0);
      }
    }
    if (event.type === "pop") this.float(event);
    if (event.type === "burst") this.burst(event);
    if (event.type === "deposit") {
      this.depositAt[event.index!] = this.time;
      this.flyingDeposit(event);
      this.siteLabels[event.index!].classList.remove("depositing");
      void this.siteLabels[event.index!].offsetWidth;
      this.siteLabels[event.index!].classList.add("depositing");
    }
    if (event.type === "complete") {
      this.shakeUntil = this.time + 0.22;
      this.syncSites();
      this.pulse(worldPoint(event.x, event.y, 0.2), 0xffedac, 0.9, 3.7);
      this.float({ ...event, type: "pop", text: "完成！", color: 0xffebae });
    }
    if (event.type === "upgrade") {
      this.actors.get("player")!.hitAt = this.time + 0.05;
      this.syncCargo();
    }
  }
  pulse(origin: Vector3, hex: number, life: number, size: number) {
    if (this.particles.length >= 48) return;
    const mesh = MeshBuilder.CreateTorus(
      "reward-ripple",
      { diameter: 1, thickness: 0.045, tessellation: 24 },
      this.scene,
    );
    const mat = new StandardMaterial("ripple-light", this.scene);
    mat.disableLighting = true;
    mat.emissiveColor = color(hex);
    mat.alpha = 0.85;
    mesh.material = mat;
    mesh.metadata = { ripple: true, size };
    this.particles.push({
      mesh,
      origin,
      born: this.time,
      velocity: Vector3.Zero(),
      life,
    });
  }
  float(e: GameEvent) {
    if (this.floats.length >= 32) return;
    const element = document.createElement("div");
    element.className = "float-number";
    element.textContent = e.text || "";
    element.style.color =
      "#" + (e.color || 0xfff1b4).toString(16).padStart(6, "0");
    this.overlay.append(element);
    this.floats.push({
      element,
      position: worldPoint(
        e.x + ((this.floats.length % 3) - 1) * 5,
        e.y,
        e.kind === "wood"
          ? 3.2
          : e.kind === "stone"
            ? 1.45
            : e.kind === "food"
              ? 1.1
              : e.kind === "enemy"
                ? 1.5
                : 2.3,
      ),
      born: this.time + 0.08,
    });
  }
  burst(e: GameEvent) {
    const count = Math.min(e.count || 6, 48 - this.particles.length);
    for (let i = 0; i < count; i++) {
      const mesh =
        e.kind === "wood"
          ? this.art.log("flying-wood-chip")
          : this.art.rock(
              "impact-fragment",
              0.07 + Math.random() * 0.07,
              e.color || palette.gold,
              i,
            );
      if (e.kind === "wood") mesh.scaling.setAll(0.55);
      const origin = worldPoint(e.x, e.y, 1.2);
      mesh.position.copyFrom(origin);
      mesh.setEnabled(false);
      this.particles.push({
        mesh,
        origin,
        velocity: new Vector3(
          (Math.random() - 0.5) * 5,
          1.5 + Math.random() * 2,
          (Math.random() - 0.5) * 5,
        ),
        born: this.time + 0.1,
        life: 0.65,
      });
    }
  }
  flyingDeposit(e: GameEvent) {
    if (this.particles.length >= 48) return;
    const mesh = this.art.resource(e.kind || "wood", "delivered-resource");
    const origin = worldPoint(e.x, e.y, 1.2),
      dest = worldPoint(450, buildingData[e.index!].y, 0.4);
    const velocity = dest.subtract(origin).scale(1 / 0.38);
    this.particles.push({
      mesh,
      origin,
      velocity,
      born: this.time,
      life: 0.38,
    });
    mesh.metadata = { delivery: true };
  }
  syncCargo() {
    const s = this.model.s,
      key = `${s.resources.wood},${s.resources.stone},${s.resources.food}`;
    if (key === this.lastInventory) return;
    this.lastInventory = key;
    const wood = Math.min(8, s.resources.wood),
      stone = Math.min(4, Math.ceil(s.resources.stone / 2));
    this.rig.wood.forEach((m, i) => m.setEnabled(i < wood));
    this.rig.stone.forEach((m, i) => {
      m.setEnabled(i < stone);
      m.position.y = wood * 0.32 + Math.floor(i / 2) * 0.29;
    });
    this.rig.food.setEnabled(s.resources.food > 0);
  }
  syncSites() {
    this.scenery.sites.forEach((site, i) => {
      const b = buildingData[i],
        p = this.model.s.progress[i],
        total = Object.values(b.cost).reduce((a, n) => a + n, 0),
        done = Object.values(p).reduce((a, n) => a + n, 0),
        built = this.model.s.zone > i,
        progress = built ? 1 : done / total;
      site.root.setEnabled(i <= this.model.s.zone);
      site.pieces.forEach((m, j) => {
        const visible = built || progress > (j + 0.5) / site.pieces.length;
        if (visible && !m.isEnabled()) {
          m.metadata = { raisedAt: this.time, baseY: m.position.y };
        }
        m.setEnabled(visible);
      });
      site.marker.setEnabled(!built);
      this.siteLabels[i].innerHTML = built
        ? i === 2
          ? "<b>暁の灯台</b><span>復旧完了</span>"
          : ""
        : `<b>${i === 0 ? "芽渡り橋" : b.name}</b><span>木 ${Math.max(0, b.cost.wood - p.wood)} · 石 ${Math.max(0, b.cost.stone - p.stone)}${b.cost.food ? ` · 実 ${Math.max(0, b.cost.food - p.food)}` : ""}</span><i style="--progress:${progress * 100}%"></i>`;
      site.progress = progress;
    });
  }
  update(delta: number) {
    const dt = Math.min(delta, 240) / 1000;
    this.time += dt;
    const m = this.model;
    this.syncCargo();
    for (const [kind, batch] of this.pickupBatches)
      if (this.time - batch.at > 0.22) {
        this.float({
          type: "pop",
          x: batch.x,
          y: batch.y,
          text: `+${batch.count} ${resourceData[kind as keyof typeof resourceData].name}`,
          color: 0xffe9aa,
        });
        this.pickupBatches.delete(kind);
      }
    const desired = worldPoint(
      m.player.x,
      m.player.y - (this.width < this.height ? 45 : 10),
    );
    const guide = m.guidance;
    this.guideRing.setEnabled(guide.kind !== "done");
    this.guideRing.position.copyFrom(
      worldPoint(guide.target.x, guide.target.y, 0.075),
    );
    this.guideRing.scaling.setAll(1 + Math.sin(this.time * 4) * 0.055);
    this.guideLabel.textContent =
      guide.kind === "build"
        ? "ここへ届ける"
        : guide.kind === "done"
          ? ""
          : `${resourceData[guide.kind].name}を集める`;

    Vector3.LerpToRef(
      this.target,
      desired,
      1 - Math.exp(-dt * 10),
      this.target,
    );
    this.camera.position.copyFrom(this.target).addInPlace(this.cameraOffset);
    if (this.time < this.shakeUntil)
      this.camera.position.x += Math.sin(this.time * 130) * 0.045;
    this.camera.setTarget(this.target);
    this.sun.position
      .copyFrom(this.target)
      .addInPlace(new Vector3(-12, 26, -13));
    const p = this.actors.get("player")!;
    p.root.position.copyFrom(worldPoint(m.player.x, m.player.y));
    p.shadow.position.copyFrom(p.root.position);
    p.shadow.position.y = 0.037;
    this.playerRing.position.copyFrom(p.root.position);
    this.playerRing.position.y = 0.065;
    const cargoAge = this.time - this.cargoBounceAt;
    this.rig.cargoRoot.rotation.z = Math.sin(this.time * 9) * m.moving * 0.025;
    this.rig.cargoRoot.position.y =
      1.12 +
      (cargoAge < 0.32 ? Math.sin((cargoAge / 0.32) * Math.PI) * 0.13 : 0);
    const rawSwingAge = this.time - this.swing.at;
    // Briefly hold the striking pose, keeping movement and progression responsive.
    const swingAge =
        rawSwingAge < 0.12
          ? rawSwingAge
          : rawSwingAge < 0.17
            ? 0.12
            : rawSwingAge - 0.05,
      phase = swingAge / 0.38,
      walk = Math.sin(this.time * 13) * m.moving;
    this.rig.legs[0].rotation.x = walk * 0.48;
    this.rig.legs[1].rotation.x = -walk * 0.48;
    this.rig.torso.position.y = Math.abs(walk) * 0.045;
    this.rig.torso.rotation.z = walk * 0.028;
    if (phase >= 0 && phase < 1) {
      p.root.rotation.y = this.swing.yaw;
      const wind =
        phase < 0.3 ? -1.2 - phase * 4 : -2.4 + ((phase - 0.3) / 0.7) * 3.4;
      this.rig.arms[1].rotation.set(wind, 0, -0.38);
      this.rig.arms[0].rotation.set(wind * 0.85, 0, 0.5);
      this.rig.torso.rotation.x = phase > 0.3 ? 0.14 : -0.08;
    } else {
      p.root.rotation.y = m.moving > 0.05 ? m.direction : p.root.rotation.y;
      this.rig.arms[0].rotation.set(-walk * 0.3, 0, 0.08);
      this.rig.arms[1].rotation.set(walk * 0.3, 0, -0.08);
      this.rig.torso.rotation.x = 0;
      this.ring.setEnabled(false);
    }
    this.keeper.pose(this.time, m.moving, phase, this.swing.kind);
    for (const [kind, mesh] of Object.entries(this.rig.tools))
      mesh.setEnabled(
        (phase >= 0 &&
          phase < 1 &&
          this.swing.kind !== "food" &&
          kind === this.swing.kind) ||
          (phase >= 1 && kind === "wood"),
      );
    this.trail.setEnabled(phase > 0.3 && phase < 0.85);
    this.trail.position.copyFrom(p.root.position);
    this.trail.rotation.y = p.root.rotation.y;
    this.ring.scaling.setAll(1 + Math.sin(this.time * 18) * 0.025);
    const casters: Mesh[] = this.rig.root
        .getChildMeshes()
        .filter((mesh) => mesh.isEnabled()) as Mesh[],
      radius = Math.max(17, (this.camera.orthoRight || 5) + 8);
    this.visibleActors = 0;
    for (const w of m.crew.workers) {
      const rig = this.crewRigs[w.id];
      rig.root.setEnabled(w.active);
      rig.shadow.setEnabled(w.active);
      if (!w.active) continue;
      rig.root.position.copyFrom(
        worldPoint(w.x, w.y, 0.07 + Math.sin(this.time * 6 + w.id) * 0.07),
      );
      rig.root.rotation.y = w.heading;
      rig.body.rotation.z =
        w.phase === "harvest"
          ? Math.sin(this.time * 14) * 0.16
          : Math.sin(this.time * 7) * 0.035;
      rig.wood.setEnabled(w.cargo > 0 && w.kind === "wood");
      rig.stone.setEnabled(w.cargo > 0 && w.kind === "stone");
      rig.shadow.position.copyFrom(worldPoint(w.x, w.y, 0.036));
      casters.push(
        rig.body,
        ...(w.cargo ? [w.kind === "wood" ? rig.wood : rig.stone] : []),
      );
    }
    for (const n of m.nodes) {
      const a = this.actors.get(n.id)!,
        age = this.time - a.dieAt,
        dying = !!n.dead && age < 0.36;
      const visible =
        n.zone <= m.s.zone &&
        (!n.dead || dying) &&
        Vector3.DistanceSquared(a.root.position, this.target) < radius * radius;
      a.root.setEnabled(visible);
      a.shadow.setEnabled(visible);
      if (!visible) continue;
      this.visibleActors++;
      const hit = this.time > a.hitAt && this.time < a.hitAt + 0.15;
      a.mesh.renderOverlay = hit;
      a.mesh.overlayColor = Color3.White();
      a.mesh.overlayAlpha = 0.7 * a.mesh.visibility;
      a.root.rotation.z = dying
        ? (age / 0.36) * 0.5
        : hit
          ? Math.sin((this.time - a.hitAt) * 45) * 0.095
          : 0;
      a.root.scaling.setAll(dying ? Math.max(0.01, 1 - (age - 0.1) * 3) : 1);
      a.shadow.visibility = dying ? Math.max(0, 1 - age / 0.36) : 1;
      const toPlayer = a.root.position.subtract(p.root.position);
      const hidesHelper = m.crew.workers.some(
        (w) => w.active && Math.hypot(w.x - n.x, w.y - n.y) < 42,
      );
      a.mesh.visibility =
        hidesHelper && n.kind === "wood"
          ? 0.3
          : n.kind === "wood" &&
              toPlayer.length() < 2.2 &&
              (Vector3.Dot(toPlayer, new Vector3(9, 0, -20)) > 0 ||
                toPlayer.length() < 1.1)
            ? 0.18
            : 1;
      if (a.mesh.visibility > 0.9) casters.push(a.mesh);
    }
    for (const e of m.enemies) {
      const a = this.actors.get(e.id)!,
        age = this.time - a.dieAt,
        dying = !!e.dead && age < 0.26,
        visible =
          e.zone <= m.s.zone &&
          (!e.dead || dying) &&
          Math.hypot(e.x - m.player.x, e.y - m.player.y) < radius * 40;
      a.root.setEnabled(visible);
      a.shadow.setEnabled(visible);
      const danger = this.dangerRings.get(e.id)!;
      danger.setEnabled(visible && !dying);
      danger.position.copyFrom(worldPoint(e.x, e.y, 0.06));
      danger.visibility =
        Math.hypot(e.x - m.player.x, e.y - m.player.y) < 230 ? 0.9 : 0.35;
      const bar = this.enemyBars.get(e.id)!;
      if (!visible) {
        bar.hidden = true;
        continue;
      }
      this.visibleActors++;
      a.root.position.copyFrom(worldPoint(e.x, e.y));
      a.root.position.y =
        e.type === 2
          ? 0.15 + Math.sin(this.time * 7) * 0.11
          : Math.abs(Math.sin(this.time * 7 + e.x)) * 0.04;
      a.root.rotation.y = Math.atan2(m.player.x - e.x, -(m.player.y - e.y));
      const hitAge = this.time - a.hitAt;
      const recoil =
        hitAge >= 0 && hitAge < 0.22 ? Math.sin((hitAge / 0.22) * Math.PI) : 0;
      a.root.scaling.set(
        1.22 + recoil * 0.18,
        1.22 - recoil * 0.16,
        1.22 + recoil * 0.18,
      );
      if (dying) a.root.scaling.setAll(Math.max(0.01, 1 - age / 0.26));
      a.mesh.rotation.z = recoil * 0.13;
      a.shadow.position.copyFrom(a.root.position);
      a.shadow.position.y = 0.035;
      a.mesh.renderOverlay = this.time > a.hitAt && this.time < a.hitAt + 0.14;
      a.mesh.overlayColor = Color3.White();
      a.mesh.overlayAlpha = 0.8;
      if (!dying) {
        casters.push(a.mesh);
        this.place(
          bar,
          a.root.position.add(new Vector3(0, e.type === 1 ? 1.25 : 1.4, 0)),
        );
        bar.classList.toggle(
          "engaged",
          Math.hypot(e.x - m.player.x, e.y - m.player.y) < 100 &&
            !m.enemies.some(
              (other) =>
                !other.dead &&
                other.zone <= m.s.zone &&
                other !== e &&
                Math.hypot(other.x - m.player.x, other.y - m.player.y) <
                  Math.hypot(e.x - m.player.x, e.y - m.player.y),
            ),
        );
        (bar.firstElementChild as HTMLElement).style.width =
          `${(e.hp / enemyData[e.type].hp) * 100}%`;
      } else bar.hidden = true;
    }
    p.mesh.renderOverlay = this.time > p.hitAt && this.time < p.hitAt + 0.15;
    p.mesh.overlayColor = color(0xffd3b1);
    p.mesh.overlayAlpha = 0.55;
    this.scenery.zones.forEach((meshes, i) => {
      for (const mesh of meshes) {
        const underCanopy =
          (mesh.name === "lantern-workshop" ||
            mesh.name.startsWith("border-tree-")) &&
          Vector3.DistanceSquared(mesh.position, p.root.position) <
            (mesh.name.startsWith("border-tree-") ? 5 : 1.9);
        mesh.visibility = i <= m.s.zone ? (underCanopy ? 0.3 : 1) : 1;
      }
    });
    casters.push(
      ...this.scenery.shadowCasters.filter(
        (mesh) =>
          mesh.visibility > 0.9 &&
          Vector3.DistanceSquared(mesh.position, this.target) < radius * radius,
      ),
    );
    for (const site of this.scenery.sites)
      if (
        site.root.isEnabled() &&
        Vector3.DistanceSquared(site.root.position, this.target) <
          radius * radius
      ) {
        casters.push(site.base, ...site.pieces.filter((p) => p.isEnabled()));
      }
    const shadowKey = casters.map((mesh) => mesh.uniqueId).join(",");
    if (shadowKey !== this.shadowListKey) {
      this.shadows.getShadowMap()!.renderList = casters;
      this.shadowListKey = shadowKey;
    }
    const liveDrops = new Set(m.drops.map((d) => d.id));
    for (const [id, mesh] of this.dropMeshes)
      if (!liveDrops.has(id)) {
        mesh.dispose();
        this.dropMeshes.delete(id);
      }
    for (const d of m.drops) {
      let mesh = this.dropMeshes.get(d.id);
      if (!mesh) {
        mesh = this.art.resource(d.kind, d.id);
        this.dropMeshes.set(d.id, mesh);
      }
      const h =
        d.age < 0.3
          ? 0.22 + Math.sin((d.age / 0.3) * Math.PI) * 0.7
          : 0.24 + Math.sin(this.time * 5 + d.x) * 0.035;
      mesh.setEnabled(d.age > 0.1);
      mesh.position.copyFrom(worldPoint(d.x, d.y, h));
      mesh.rotation.y = this.time * 2;
      const near = Math.hypot(d.x - m.player.x, d.y - m.player.y);
      mesh.scaling.setAll(
        (d.kind === "wood" ? 0.85 : 1.2) *
          (d.age > 0.3 ? Math.min(1, 0.45 + near / 60) : 1),
      );
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const f = this.particles[i],
        age = this.time - f.born;
      if (age > f.life) {
        if (f.mesh.metadata?.ripple) f.mesh.material?.dispose();
        f.mesh.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      f.mesh.setEnabled(age >= 0);
      if (age < 0) continue;
      f.mesh.position.copyFrom(f.origin).addInPlace(f.velocity.scale(age));
      if (f.mesh.metadata?.ripple) {
        f.mesh.scaling.setAll(0.35 + (age / f.life) * f.mesh.metadata.size);
        (f.mesh.material as StandardMaterial).alpha = 0.85 * (1 - age / f.life);
      } else if (f.mesh.metadata?.delivery)
        f.mesh.position.y += Math.sin((age / f.life) * Math.PI) * 0.7;
      else {
        f.mesh.position.y -= 5 * age * age;
        f.mesh.rotation.set(age * 3, age * 4, 0);
        f.mesh.scaling.setAll(
          (f.mesh.name === "flying-wood-chip" ? 0.55 : 1) *
            (1 - (age / f.life) * 0.6),
        );
      }
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i],
        age = this.time - f.born;
      if (age > 0.75) {
        f.element.remove();
        this.floats.splice(i, 1);
        continue;
      }
      f.element.style.opacity = String(
        age < 0 ? 0 : Math.min(1, (0.75 - age) * 3),
      );
      this.place(
        f.element,
        f.position.add(new Vector3(0, Math.max(0, age) * 0.95, 0)),
        age >= 0,
      );
    }
    this.scenery.sites.forEach((site, i) => {
      for (const piece of site.pieces) {
        if (!piece.isEnabled() || !piece.metadata) continue;
        const age = this.time - piece.metadata.raisedAt;
        const t = Math.min(1, Math.max(0, age / 0.38));
        piece.position.y = piece.metadata.baseY + Math.sin(t * Math.PI) * 0.15;
        piece.scaling.setAll(0.84 + 0.16 * t);
      }
      const label = this.siteLabels[i];
      const age = this.time - this.depositAt[i];
      site.marker.scaling.setAll(
        1 +
          (age < 0.4
            ? Math.sin((age / 0.4) * Math.PI) * 0.18
            : Math.sin(this.time * 3) * 0.025),
      );
      this.place(
        label,
        worldPoint(590, buildingData[i].y, i === 2 ? 3.1 : i === 1 ? 2.7 : 1.4),
        i <= m.s.zone &&
          (m.s.zone <= i || i === 2) &&
          Math.abs(m.player.y - buildingData[i].y) < 340,
      );
    });
    const campPts = [
      [450, 290],
      [690, 940],
      [690, 1490],
    ];
    this.campLabels.forEach((label, i) =>
      this.place(
        label,
        worldPoint(campPts[i][0], campPts[i][1] - 10, 1.9),
        i <= m.s.zone,
      ),
    );
    this.place(
      this.guideLabel,
      worldPoint(
        guide.target.x,
        guide.target.y,
        guide.kind === "wood" ? 3.6 : 1.25,
      ),
      guide.kind !== "done" && guide.kind !== "build",
    );
    this.scene.render();
  }
  metrics() {
    return {
      renderer: "Babylon.js WebGL",
      keeper: this.keeper.metrics(),
      crew: this.model.crew.workers,
      fps: Math.round(this.engine.getFps()),
      internalSize: [
        this.engine.getRenderWidth(),
        this.engine.getRenderHeight(),
      ],
      orthographic: this.camera.mode === Camera.ORTHOGRAPHIC_CAMERA,
      meshes: this.scene.meshes.length,
      active: this.scene.getActiveMeshes().length,
      visibleActors: this.visibleActors,
      particles: this.particles.length,
      pops: this.floats.length,
      drops: this.dropMeshes.size,
      quality: this.quality,
      triangles: this.scene.getActiveIndices() / 3,
      cargo: {
        wood: this.rig.wood.filter((m) => m.isEnabled()).length,
        stone: this.rig.stone.filter((m) => m.isEnabled()).length,
      },
    };
  }
}
