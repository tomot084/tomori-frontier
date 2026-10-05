import natureMeshes from "./assets/nature-meshes.json";
/** Tomori props and adapted CC0 Kenney vegetation. See docs/asset-sources.md. */
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
export const palette = {
  cream: 0xffe3a5,
  teal: 0x257e82,
  tealLight: 0x55afb0,
  ink: 0x213e49,
  leather: 0xb26c3e,
  wood: 0xab7548,
  cut: 0xf0c588,
  leaf: 0x66ac69,
  leafLight: 0xa8d377,
  stone: 0x8babb4,
  stoneLight: 0xc2d2ce,
  gold: 0xf8c56b,
};
export const color = (hex: number) =>
  Color3.FromInts(hex >> 16, (hex >> 8) & 255, hex & 255);
export const worldPoint = (x: number, y: number, height = 0) =>
  new Vector3((x - 450) / 40, height, -(y - 360) / 40);
const noise = (n: number) => {
  const x = Math.sin(n * 127.1 + 13.7) * 43758.5453;
  return x - Math.floor(x);
};
export class Art {
  material: StandardMaterial;
  constructor(public scene: Scene) {
    this.material = new StandardMaterial("painted-low-poly", scene);
    this.material.diffuseColor = new Color3(1, 1, 1);
    this.material.specularColor = new Color3(0.035, 0.035, 0.035);
  }
  tint(mesh: Mesh, hex: number, facets = false) {
    if (facets) mesh.convertToFlatShadedMesh();
    const c = color(hex),
      n = mesh.getTotalVertices(),
      colors: number[] = [];
    for (let i = 0; i < n; i++) {
      const f = facets ? 0.91 + noise(Math.floor(i / 3) + hex) * 0.16 : 1;
      colors.push(c.r * f, c.g * f, c.b * f, 1);
    }
    mesh.setVerticesData(VertexBuffer.ColorKind, colors);
    mesh.material = this.material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    return mesh;
  }
  box(
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    hex: number,
  ) {
    const m = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      this.scene,
    );
    m.position.set(x, y, z);
    return this.tint(m, hex);
  }
  sphere(
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    hex: number,
    facets = false,
  ) {
    const m = facets
      ? MeshBuilder.CreateIcoSphere(
          name,
          { radius: 0.5, subdivisions: 1, flat: true },
          this.scene,
        )
      : MeshBuilder.CreateIcoSphere(
          name,
          { radius: 0.5, subdivisions: 2, flat: false },
          this.scene,
        );
    m.position.set(x, y, z);
    m.scaling.set(w, h, d);
    return this.tint(m, hex, facets);
  }
  cylinder(
    name: string,
    x: number,
    y: number,
    z: number,
    rt: number,
    rb: number,
    h: number,
    hex: number,
    sides = 8,
  ) {
    const m = MeshBuilder.CreateCylinder(
      name,
      {
        diameterTop: rt * 2,
        diameterBottom: rb * 2,
        height: h,
        tessellation: sides,
      },
      this.scene,
    );
    m.position.set(x, y, z);
    return this.tint(m, hex, true);
  }
  merge(name: string, parts: Mesh[]) {
    const m = Mesh.MergeMeshes(parts, true, true)!;
    m.name = name;
    m.material = this.material;
    m.isPickable = false;
    m.receiveShadows = true;
    return m;
  }
  rock(name: string, size = 1, hex = palette.stone, seed = 1) {
    const m = MeshBuilder.CreateIcoSphere(
      name,
      { radius: 0.5, subdivisions: 1, flat: true },
      this.scene,
    );
    const p = m.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < p.length; i += 3) {
      const k = 0.85 + noise(p[i] * 19 + p[i + 2] * 34 + seed) * 0.3;
      p[i] *= k * size;
      p[i + 1] = (p[i + 1] + 0.5) * size * 0.85;
      p[i + 2] *= k * size * 0.85;
    }
    m.setVerticesData(VertexBuffer.PositionKind, p);
    const normals: number[] = [];
    VertexData.ComputeNormals(p, m.getIndices()!, normals);
    m.setVerticesData(VertexBuffer.NormalKind, normals);
    return this.tint(m, hex, true);
  }
  log(name: string) {
    const body = this.cylinder(name, 0, 0, 0, 0.12, 0.14, 0.8, palette.wood, 8);
    body.rotation.z = Math.PI / 2;
    const ends = [-0.408, 0.408].map((x, i) => {
      const m = this.cylinder(
        name + "-cut" + i,
        x,
        0,
        0,
        0.111,
        0.111,
        0.013,
        palette.cut,
        8,
      );
      m.rotation.z = Math.PI / 2;
      return m;
    });
    const ring = this.cylinder(
      "growth-ring",
      0.42,
      0,
      0,
      0.061,
      0.061,
      0.008,
      0xb28651,
      8,
    );
    ring.rotation.z = Math.PI / 2;
    const core = this.cylinder(
      "heartwood",
      0.426,
      0,
      0,
      0.041,
      0.041,
      0.008,
      palette.cut,
      8,
    );
    core.rotation.z = Math.PI / 2;
    return this.merge(name, [body, ...ends, ring, core]);
  }
  tree(seed: number, zone = 0) {
    const names = [
      "tree_oak",
      "tree_pineRoundD",
      "tree_pineTallA_detailed",
    ] as const;
    const name = names[Math.abs(Math.floor(seed * 0.17)) % names.length];
    const source = natureMeshes[name];
    const mesh = new Mesh("lantern-grove-" + name, this.scene);
    const data = new VertexData();
    data.positions = source.positions;
    data.normals = source.normals;
    data.uvs = new Array((source.positions.length / 3) * 2).fill(0);
    data.colors = source.colors.map((v, i) => {
      const base = i - (i % 4);
      const foliage = source.colors[base + 1] > source.colors[base] * 1.1;
      if (!foliage || i % 4 === 3) return v;
      const tint = [
        [1.06, 1.02, 1.05],
        [0.88, 1.02, 1.2],
        [1.17, 1.03, 0.98],
      ][zone];
      return Math.min(1, v * tint[i % 4]);
    });
    data.indices = source.indices;
    data.applyToMesh(mesh);
    mesh.material = this.material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.rotation.y = noise(seed) * Math.PI * 2;
    const scale = 0.88 + noise(seed + 9) * 0.2;
    mesh.scaling.set(scale, scale, scale);
    // Gold lantern fruit ties the imported vegetation to Tomori's original islands.
    const fruit = this.sphere(
      "lantern-fruit",
      0.19,
      1.1,
      0.27,
      0.15,
      0.2,
      0.15,
      palette.gold,
      true,
    );
    return this.merge("lantern-tree", [mesh, fruit]);
  }

  boulder(seed: number) {
    const a = this.rock("boulder", 1.65, palette.stone, seed);
    const b = this.rock("cracked-face", 0.72, palette.stoneLight, seed + 2);
    b.position.set(-0.32, 0.13, -0.26);
    const vein = this.box(
      "mineral-vein",
      0.14,
      0.55,
      -0.13,
      0.07,
      0.34,
      0.08,
      0xe3d9a4,
    );
    vein.rotation.z = 0.48;
    const crystal = this.cylinder(
      "moonstone-crystal",
      0.36,
      0.76,
      0.17,
      0,
      0.12,
      0.57,
      0xe5eee1,
      5,
    );
    crystal.rotation.z = -0.32;
    return this.merge("split-moonstone", [a, b, vein, crystal]);
  }
  berry() {
    const parts: Mesh[] = [];
    for (let i = 0; i < 3; i++)
      parts.push(
        this.sphere(
          "berry-leaves",
          (i - 1) * 0.28,
          0.34 + i * 0.05,
          i === 1 ? 0.18 : 0,
          0.78,
          0.68,
          0.7,
          [0x377e62, 0x609c61, 0x81b976][i],
          true,
        ),
      );
    for (let i = 0; i < 8; i++) {
      const a = i * 2.399;
      parts.push(
        this.sphere(
          "coral-berry",
          Math.cos(a) * 0.34,
          0.56 + noise(i) * 0.28,
          Math.sin(a) * 0.33,
          0.16,
          0.19,
          0.16,
          i % 2 ? 0xf09b79 : 0xd77360,
          true,
        ),
      );
    }
    return this.merge("sunberry-bush", parts);
  }
  resource(kind: string, name = "resource") {
    if (kind === "wood") return this.log(name);
    if (kind === "stone") return this.rock(name, 0.32, palette.stoneLight);
    if (kind === "coin") {
      const m = this.cylinder(
        name,
        0,
        0,
        0,
        0.15,
        0.15,
        0.055,
        palette.gold,
        10,
      );
      m.rotation.x = Math.PI / 2;
      const face = this.box(
        "coin-rune",
        0,
        0,
        -0.035,
        0.065,
        0.15,
        0.018,
        0xffe5a5,
      );
      face.rotation.z = 0.7;
      return this.merge(name, [m, face]);
    }
    return this.merge(name, [
      this.sphere(name, 0, 0, 0, 0.23, 0.25, 0.22, 0xec8a72, true),
      this.box("leaf", 0.05, 0.15, 0, 0.15, 0.025, 0.07, 0x86b878),
    ]);
  }
  grass(seed: number) {
    const p: Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const m = this.cylinder(
        "grass",
        i * 0.09 - 0.09,
        0.13 + noise(seed + i) * 0.05,
        noise(i) * 0.08,
        0,
        0.028,
        0.28 + noise(seed + i) * 0.13,
        [0x71ab73, 0x95bc79, 0x568866][i],
        3,
      );
      m.rotation.z = (i - 1) * 0.28;
      p.push(m);
    }
    return this.merge("grass-tuft", p);
  }
  flower(seed: number) {
    const p: Mesh[] = [];
    p.push(this.cylinder("stem", 0, 0.16, 0, 0.015, 0.021, 0.32, 0x689766, 4));
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      p.push(
        this.sphere(
          "petal",
          Math.cos(a) * 0.075,
          0.35,
          Math.sin(a) * 0.075,
          0.1,
          0.05,
          0.1,
          seed % 2 ? 0xf3dc91 : 0xf0b19b,
          true,
        ),
      );
    }
    p.push(
      this.sphere("pollen", 0, 0.37, 0, 0.055, 0.04, 0.055, 0xe9b362, true),
    );
    return this.merge("meadow-flower", p);
  }
  helper(id: number) {
    const root = new TransformNode("lantern-helper-" + id, this.scene);
    const parts = [
      this.sphere(
        "sprite-hood",
        0,
        0.78,
        0,
        0.76,
        0.83,
        0.67,
        id ? 0x78b5c2 : 0x5ab7a7,
        true,
      ),
      this.sphere("sprite-face", 0, 0.76, 0.29, 0.53, 0.38, 0.13, 0xffefb8),
      this.cylinder(
        "sprite-lantern",
        0,
        0.32,
        0,
        0.21,
        0.29,
        0.38,
        0xf7cb6e,
        8,
      ),
      this.cylinder("sprite-cap", 0, 1.18, 0, 0, 0.17, 0.29, 0xffd579, 6),
    ];
    for (const side of [-1, 1]) {
      parts.push(
        this.sphere(
          "sprite-eye",
          side * 0.1,
          0.79,
          0.37,
          0.065,
          0.08,
          0.035,
          palette.ink,
        ),
      );
      parts.push(
        this.sphere(
          "sprite-hand",
          side * 0.38,
          0.51,
          0.06,
          0.21,
          0.22,
          0.23,
          0xffefb8,
        ),
      );
    }
    const body = this.merge("lantern-sprite", parts);
    body.parent = root;
    const logs = [0, 1, 2].map((i) => {
      const m = this.log("helper-log");
      m.position.set(0, 0.64 + i * 0.26, -0.46);
      return m;
    });
    const wood = this.merge("helper-bundle", logs);
    wood.parent = root;
    const stone = this.rock("helper-stone", 0.68, palette.stoneLight, id);
    stone.position.set(0, 0.57, -0.42);
    stone.parent = root;
    root.setEnabled(false);
    return { root, body, wood, stone };
  }
  camp() {
    const p: Mesh[] = [];
    p.push(this.box("floor", 0, 0.045, 0, 2.3, 0.09, 1.9, 0xb18d61));
    for (let i = 0; i < 5; i++)
      p.push(
        this.box(
          "floor-plank",
          (i - 2) * 0.43,
          0.096,
          0,
          0.4,
          0.025,
          1.88,
          0xcba775,
        ),
      );
    for (const x of [-0.83, 0.83])
      p.push(
        this.cylinder("tent-pole", x, 0.77, 0, 0.055, 0.055, 1.52, 0x9e744d, 6),
      );
    const roof = this.box(
      "sloping-canopy",
      -0.42,
      1.11,
      0,
      1.3,
      0.08,
      2.03,
      0x3e8e8d,
    );
    roof.rotation.z = 0.62;
    const roof2 = this.box(
      "sloping-canopy",
      0.42,
      1.11,
      0,
      1.3,
      0.08,
      2.03,
      0x80b7a0,
    );
    roof2.rotation.z = -0.62;
    p.push(roof, roof2);
    p.push(this.box("rear-cloth", 0, 0.63, 0.87, 1.53, 1.13, 0.045, 0x39817b));
    p.push(this.box("workbench", -0.24, 0.58, 0.12, 1.19, 0.13, 0.6, 0xb88956));
    for (const x of [-0.7, 0.25])
      p.push(this.box("bench-leg", x, 0.28, 0.12, 0.08, 0.52, 0.45, 0x916342));
    p.push(this.box("toolbox", 0.47, 0.22, -0.64, 0.4, 0.4, 0.42, 0xd1a369));
    p.push(
      this.cylinder("lamp-post", 1.22, 0.76, 0, 0.048, 0.063, 1.5, 0x856240, 7),
    );
    p.push(this.cylinder("lamp", 1.22, 1.48, 0, 0.16, 0.19, 0.28, 0xffda87, 8));
    p.push(
      this.cylinder("lamp-roof", 1.22, 1.68, 0, 0, 0.24, 0.18, 0x367679, 8),
    );
    const log = this.log("workshop-logs");
    log.position.set(0.28, 0.2, 1.15);
    p.push(log);
    return this.merge("lantern-workshop", p);
  }
  enemy(type: number) {
    const p: Mesh[] = [];
    if (type === 0) {
      p.push(
        this.sphere("mist-mote", 0, 0.46, 0, 0.85, 0.83, 0.75, 0x9d96c3, true),
      );
      p.push(
        this.sphere(
          "cheek",
          -0.19,
          0.62,
          0.22,
          0.25,
          0.24,
          0.15,
          0xc8b6d9,
          true,
        ),
      );
      for (const x of [-0.17, 0.17]) {
        const ear = this.cylinder(
          "mist-antler",
          x,
          0.99,
          0,
          0.015,
          0.09,
          0.37,
          0xc9b8d7,
          5,
        );
        ear.rotation.z = x > 0 ? -0.35 : 0.35;
        p.push(ear);
      }
    } else if (type === 1) {
      p.push(
        this.sphere("moss-shell", 0, 0.48, 0, 1.17, 0.83, 0.99, 0x74a289, true),
      );
      p.push(this.rock("crystal-antler", 0.4, 0xc0dc9f, 7));
      p[p.length - 1].position.set(-0.22, 0.79, 0);
      for (let i = 0; i < 4; i++)
        p.push(
          this.box(
            "shell-ridge",
            (i - 1.5) * 0.24,
            0.85,
            0,
            0.07,
            0.04,
            0.57,
            0x4c7d69,
          ),
        );
      for (const x of [-0.4, 0.4])
        for (const z of [-0.3, 0.3])
          p.push(
            this.sphere(
              "shell-foot",
              x,
              0.13,
              z,
              0.28,
              0.25,
              0.23,
              0xc5bc8e,
              true,
            ),
          );
    } else {
      p.push(
        this.sphere("dusk-body", 0, 0.48, 0, 0.39, 0.75, 0.38, 0xd9916c, true),
      );
      for (const side of [-1, 1]) {
        const wing = this.sphere(
          "dusk-wing",
          side * 0.45,
          0.67,
          0,
          0.9,
          0.19,
          0.59,
          side === 1 ? 0xf1b782 : 0xe0a174,
          true,
        );
        wing.rotation.z = side * 0.27;
        p.push(wing);
      }
      p.push(this.cylinder("crest", 0, 0.91, 0, 0, 0.1, 0.3, 0xeec598, 4));
    }
    for (const side of [-1, 1]) {
      const x = side * (type === 1 ? 0.2 : 0.14),
        z = type === 1 ? 0.45 : type === 2 ? 0.22 : 0.34;
      p.push(
        this.sphere("enemy-eye-rim", x, 0.59, z, 0.2, 0.23, 0.06, 0xffe9b6),
      );
      p.push(
        this.sphere(
          "enemy-eye",
          x,
          0.59,
          z + 0.045,
          0.085,
          0.14,
          0.035,
          0x293e4c,
        ),
      );
      p.push(
        this.sphere(
          "eye-shine",
          x - 0.015,
          0.625,
          z + 0.064,
          0.027,
          0.034,
          0.014,
          0xfff9e4,
        ),
      );
    }
    return this.merge(["mist-mote", "moss-helmet", "dusk-flier"][type], p);
  }

  blade() {
    const points = [
        [-0.04, -0.1],
        [0.08, -0.18],
        [0.37, -0.21],
        [0.5, -0.06],
        [0.43, 0.21],
        [0.24, 0.25],
        [0.01, 0.13],
      ],
      positions: number[] = [],
      indices: number[] = [],
      colors: number[] = [];
    const tri = (a: number[], b: number[], c: number[], hex: number) => {
      const n = positions.length / 3;
      positions.push(...a, ...b, ...c);
      indices.push(n, n + 2, n + 1);
      const co = color(hex);
      for (let i = 0; i < 3; i++) colors.push(co.r, co.g, co.b, 1);
    };
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length,
        a = points[i],
        b = points[j];
      tri(
        [0.18, 0.32, 0.28],
        [a[0], a[1] + 0.32, 0.28],
        [b[0], b[1] + 0.32, 0.28],
        0xdbe8df,
      );
      tri(
        [0.18, 0.32, 0.16],
        [b[0], b[1] + 0.32, 0.16],
        [a[0], a[1] + 0.32, 0.16],
        0xb1ccd0,
      );
      tri(
        [a[0], a[1] + 0.32, 0.16],
        [b[0], b[1] + 0.32, 0.16],
        [a[0], a[1] + 0.32, 0.28],
        i > 1 && i < 5 ? 0xf4f7eb : 0x8aafb4,
      );
      tri(
        [b[0], b[1] + 0.32, 0.16],
        [b[0], b[1] + 0.32, 0.28],
        [a[0], a[1] + 0.32, 0.28],
        i > 1 && i < 5 ? 0xf4f7eb : 0x8aafb4,
      );
    }
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.colors = colors;
    data.uvs = new Array((positions.length / 3) * 2).fill(0);
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    data.normals = normals;
    const m = new Mesh("forged-axe-head", this.scene);
    data.applyToMesh(m);
    m.material = this.material;
    return m;
  }
  player() {
    const root = new TransformNode("lantern-keeper", this.scene),
      torso = new TransformNode("torso-pivot", this.scene);
    torso.parent = root;
    const p: Mesh[] = [];
    p.push(this.cylinder("coat", 0, 0.91, 0, 0.3, 0.4, 0.65, palette.teal, 12));
    p.push(
      this.sphere(
        "coat-shoulders",
        0,
        1.19,
        0,
        0.71,
        0.32,
        0.46,
        palette.tealLight,
      ),
    );
    p.push(this.sphere("face", 0, 1.54, 0.035, 0.67, 0.63, 0.6, palette.cream));
    p.push(
      this.cylinder(
        "hat-brim",
        0,
        1.82,
        0,
        0.46,
        0.46,
        0.085,
        palette.teal,
        10,
      ),
    );
    p.push(
      this.cylinder(
        "hat-crown",
        0,
        1.96,
        0,
        0.29,
        0.38,
        0.25,
        palette.tealLight,
        10,
      ),
    );
    p.push(
      this.box("hat-band", 0, 1.9, -0.29, 0.42, 0.11, 0.06, palette.leather),
    );
    p.push(
      this.sphere(
        "lamp-crystal",
        0,
        1.97,
        -0.39,
        0.18,
        0.18,
        0.1,
        palette.gold,
        true,
      ),
    );
    p.push(
      this.cylinder("scarf", 0, 1.27, 0, 0.3, 0.29, 0.16, palette.gold, 10),
    );
    p.push(
      this.box("scarf-tail", 0.27, 1.11, -0.23, 0.15, 0.42, 0.055, 0xebac52),
    );
    for (const x of [-0.135, 0.135]) {
      p.push(
        this.sphere(
          "keeper-eye",
          x,
          1.55,
          0.314,
          0.066,
          0.09,
          0.035,
          palette.ink,
        ),
      );
      p.push(
        this.sphere(
          "cheek",
          x * 1.35,
          1.44,
          0.29,
          0.085,
          0.043,
          0.015,
          0xe4a574,
        ),
      );
    }
    p.push(this.sphere("nose", 0, 1.46, 0.342, 0.105, 0.095, 0.11, 0xf3c78b));
    p.push(
      this.cylinder(
        "coat-trim",
        0,
        0.63,
        0,
        0.38,
        0.4,
        0.07,
        palette.cream,
        12,
      ),
    );
    p.push(
      this.box("coat-seam", 0, 0.93, 0.315, 0.04, 0.42, 0.035, palette.cream),
    );
    p.push(
      this.sphere("coat-clasp", 0, 1.12, 0.34, 0.09, 0.09, 0.04, palette.gold),
    );
    p.push(this.box("backpack", 0, 0.99, -0.32, 0.49, 0.56, 0.27, 0xbe9769));
    for (const x of [-0.21, 0.21])
      p.push(
        this.box(
          "backpack-strap",
          x,
          1.02,
          -0.49,
          0.055,
          0.65,
          0.02,
          palette.cream,
        ),
      );
    for (let i = 0; i < 3; i++)
      p.push(
        this.box(
          "basket-weave",
          0,
          0.79 + i * 0.16,
          -0.49,
          0.52,
          0.037,
          0.028,
          0xe7bf86,
        ),
      );
    const body = this.merge("keeper-body", p);
    body.parent = torso;
    const legs = [-1, 1].map((side) => {
      const pivot = new TransformNode("leg", this.scene);
      pivot.position.set(side * 0.18, 0.5, 0);
      pivot.parent = root;
      const boot = this.merge("leg-and-boot", [
        this.cylinder("trouser", 0, -0.15, 0, 0.11, 0.115, 0.35, 0x304b57, 7),
        this.sphere("boot", 0, -0.36, 0.04, 0.25, 0.23, 0.36, palette.leather),
      ]);
      boot.parent = pivot;
      return pivot;
    });
    const arms = [-1, 1].map((side) => {
      const pivot = new TransformNode("arm", this.scene);
      pivot.position.set(side * 0.38, 1.2, 0);
      pivot.parent = torso;
      const limb = this.merge("sleeve-and-mitten", [
        this.cylinder(
          "sleeve",
          0,
          -0.18,
          0,
          0.12,
          0.1,
          0.37,
          palette.tealLight,
          8,
        ),
        this.sphere("mitten", 0, -0.42, 0, 0.21, 0.21, 0.22, palette.cream),
      ]);
      limb.parent = pivot;
      return pivot;
    });
    const toolPivot = new TransformNode("tool-grip", this.scene);
    toolPivot.position.set(0, -0.4, 0.02);
    toolPivot.parent = arms[1];
    const tools: Record<string, Mesh> = {};
    for (const kind of ["wood", "stone", "enemy"]) {
      const ps: Mesh[] = [];
      ps.push(
        this.cylinder(
          "tool-handle",
          0,
          0,
          0.22,
          0.034,
          0.047,
          0.84,
          palette.wood,
          7,
        ),
      );
      if (kind === "wood") {
        ps.push(
          this.blade(),
          this.box("axe-eye", 0, 0.31, 0.22, 0.16, 0.16, 0.14, 0x6e9ca3),
        );
      } else if (kind === "stone") {
        for (const side of [-1, 1]) {
          const hook = this.cylinder(
            "pick-hook",
            side * 0.19,
            0.33,
            0.22,
            0.027,
            0.068,
            0.5,
            0xc1d5d9,
            5,
          );
          hook.rotation.z = side * 1.25;
          ps.push(hook);
        }
      } else {
        ps.push(
          this.box("lantern-blade", 0, 0.53, 0.22, 0.16, 0.88, 0.08, 0xffdfa0),
          this.box(
            "blade-edge",
            0.087,
            0.53,
            0.22,
            0.025,
            0.88,
            0.08,
            0xfff0c5,
          ),
          this.box("guard", 0, 0.12, 0.22, 0.39, 0.06, 0.11, palette.teal),
        );
      }
      const m = this.merge("tool-" + kind, ps);
      m.scaling.setAll(1.5);
      m.parent = toolPivot;
      m.setEnabled(false);
      tools[kind] = m;
    }
    const cargoRoot = new TransformNode("cargo-rack", this.scene);
    cargoRoot.parent = torso;
    cargoRoot.position.set(0, 1.12, -0.62);
    const wood = Array.from({ length: 8 }, (_, i) => {
        const m = this.log("carried-log-" + i);
        m.scaling.x = 1.28;
        m.parent = cargoRoot;
        m.position.set(((i % 2) - 0.5) * 0.15, i * 0.27, 0.1);
        m.setEnabled(false);
        return m;
      }),
      stone = Array.from({ length: 4 }, (_, i) => {
        const m = this.rock("carried-stone-" + i, 0.33, palette.stoneLight, i);
        m.parent = cargoRoot;
        m.position.set(((i % 2) - 0.5) * 0.31, Math.floor(i / 2) * 0.3, 0.39);
        m.setEnabled(false);
        return m;
      });
    const food = this.resource("food", "berry-pouch");
    food.parent = cargoRoot;
    food.position.set(-0.39, -0.09, 0.1);
    food.setEnabled(false);
    return {
      root,
      torso,
      body,
      legs,
      arms,
      toolPivot,
      tools,
      cargoRoot,
      wood,
      stone,
      food,
    };
  }
}
