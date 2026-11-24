/** Original Tomori props and unified toy grove. See docs/asset-sources.md. */
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
export const palette = {
  cream: 0xffe5b1,
  teal: 0x218e91,
  tealLight: 0x63c4bb,
  ink: 0x354f58,
  leather: 0xb26c3e,
  wood: 0x875237,
  cut: 0xffd79b,
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
  biome = "frontier";
  material: StandardMaterial;
  constructor(public scene: Scene) {
    this.material = new StandardMaterial("tomori-matte-paint", scene);
    this.material.diffuseColor = new Color3(1, 1, 1);
    this.material.specularColor = Color3.Black();
  }
  tint(mesh: Mesh, hex: number, _facets = false) {
    // Broad, clean color fields; no random per-triangle tint.
    const c = color(hex),
      n = mesh.getTotalVertices(),
      colors: number[] = [];
    for (let i = 0; i < n; i++) {
      const f = 1;
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
    // Shared rounded edges for timber, buildings and machinery. A fixed 4x4
    // grid per face keeps this inexpensive and adds no scene objects.
    const m = new Mesh(name, this.scene);
    const half = [w / 2, h / 2, d / 2];
    const radius = Math.min(0.13, Math.min(w, h, d) * 0.22);
    const positions: number[] = [],
      normals: number[] = [],
      indices: number[] = [];
    for (let axis = 0; axis < 3; axis++)
      for (const sign of [-1, 1]) {
        const u = (axis + 1) % 3,
          v = (axis + 2) % 3;
        const coords = (k: number) => [
          -half[k],
          -half[k] + radius,
          half[k] - radius,
          half[k],
        ];
        const base = positions.length / 3;
        for (const cv of coords(v))
          for (const cu of coords(u)) {
            const point = [0, 0, 0];
            point[axis] = sign * half[axis];
            point[u] = cu;
            point[v] = cv;
            const core = point.map((n, k) =>
              Math.max(-half[k] + radius, Math.min(half[k] - radius, n)),
            );
            const delta = point.map((n, k) => n - core[k]);
            const length = Math.hypot(...delta);
            positions.push(
              ...core.map((n, k) => n + (delta[k] / length) * radius),
            );
            normals.push(...delta.map((n) => n / length));
          }
        for (let j = 0; j < 3; j++)
          for (let i = 0; i < 3; i++) {
            const q = base + j * 4 + i;
            indices.push(
              ...(sign < 0
                ? [q, q + 1, q + 4, q + 1, q + 5, q + 4]
                : [q, q + 4, q + 1, q + 1, q + 4, q + 5]),
            );
          }
      }
    const data = new VertexData();
    data.positions = positions;
    data.normals = normals;
    data.indices = indices;
    data.uvs = new Array((positions.length / 3) * 2).fill(0);
    data.applyToMesh(m);
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
    const m = MeshBuilder.CreateIcoSphere(
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
        tessellation: Math.max(12, sides),
      },
      this.scene,
    );
    m.position.set(x, y, z);
    return this.tint(m, hex);
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
      { radius: 0.5, subdivisions: 2, flat: false },
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
    return this.tint(m, hex);
  }
  /** Shared, inexpensive vertex-painted item meshes. All parts are merged before instancing. */
  private paintItem(
    mesh: Mesh,
    shade: (x: number, y: number, z: number, nx: number, ny: number, nz: number) => number,
  ) {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
    const colors: number[] = [];
    for (let i = 0; i < positions.length; i += 3) {
      const c = color(shade(
        positions[i], positions[i + 1], positions[i + 2],
        normals[i], normals[i + 1], normals[i + 2],
      ));
      colors.push(c.r, c.g, c.b, 1);
    }
    mesh.setVerticesData(VertexBuffer.ColorKind, colors);
    return mesh;
  }
  log(name: string) {
    // Warm bark and cream end grain read differently from flat, honey-colored boards.
    const body = this.cylinder(name, 0, 0, 0, 0.16, 0.18, 0.8, 0x98572e, 12);
    this.paintItem(body, (x, _y, z) => {
      const band = Math.cos(Math.atan2(z, x) * 3);
      return band > 0.45 ? 0xb9753f : band < -0.45 ? 0x754023 : 0x98572e;
    });
    body.rotation.z = Math.PI / 2;
    const parts = [body];
    for (const sign of [-1, 1]) {
      // End grain on both ends, not just the side that faced the original camera.
      for (const [offset, radius, thickness, tint] of [
        [0.404, 0.148, 0.014, 0xffdf9e],
        [0.414, 0.096, 0.008, 0xc28a48],
        [0.420, 0.060, 0.006, 0xffe6af],
      ]) {
        const disc = this.cylinder(
          name + "-end-grain", sign * offset, 0, 0, radius, radius, thickness, tint, 12,
        );
        disc.rotation.z = Math.PI / 2;
        parts.push(disc);
      }
    }
    return this.merge(name, parts);
  }
  plank(name: string, w = 1.1, h = 0.16, d = 0.36) {
    const mesh = this.box(name, 0, 0, 0, w, h, d, 0xf3ca82);
    // Preserve the existing geometry budget: contrast the broad top, long edge
    // and cut ends with vertex color rather than extra meshes or textures.
    return this.paintItem(mesh, (_x, _y, z, nx, ny) =>
      ny > 0.65 ? (Math.abs(z) < d * 0.42 ? 0xffdf9c : 0xf4c47b)
        : ny < -0.65 ? 0xb78143
        : Math.abs(nx) > 0.65 ? 0xe2ab62 : 0xc48a4b,
    );
  }
  brick(name: string, w = 0.55, h = 0.26, d = 0.35) {
    const mesh = this.box(name, 0, 0, 0, w, h, d, 0xbd593e);
    return this.paintItem(mesh, (_x, _y, _z, nx, ny) =>
      ny > 0.65 ? 0xf09b6a : ny < -0.65 ? 0x964a35
        : Math.abs(nx) > 0.65 ? 0xd77b55 : 0xb95e42,
    );
  }
  stonePiece(name: string, size = 0.32) {
    const mesh = this.rock(name, size, 0x739eae);
    return this.paintItem(mesh, (_x, y, _z, nx, ny, nz) =>
      ny > 0.4 || y > size * 0.65 ? 0xc3e3e8
        : nx + nz > 0.35 ? 0x82b6c4 : 0x537d95,
    );
  }
  /** Rounded, broad foliage with a dark underside and sunlit crown.
   *  One shared material; no textures, extra draw calls or runtime animation.
   */
  private foliage(
    x: number, y: number, z: number, w: number, h: number, d: number,
    lower: number, upper: number,
  ) {
    const leaf = this.sphere("sculpted-crown", x, y, z, w, h, d, upper);
    return this.paintItem(leaf, (_x, py, _z, _nx, ny) =>
      py > -0.05 && ny > -0.15 ? upper : lower);
  }
  private themedTree(seed: number, zone: number, harvestable: boolean) {
    const biome = this.biome, parts: Mesh[] = [];
    const trunk = harvestable ? 0x985f37 : 0x97896d;
    if (biome === "snow" || biome === "forest" || biome === "ice") {
      const icy = biome === "ice", snowy = biome === "snow";
      parts.push(this.cylinder("pine-trunk", 0, 0.78, 0, 0.20, 0.32, 1.56, icy ? 0x589db4 : trunk, 12));
      for (let i = 0; i < 3; i++) {
        const r = 1.08 - i * 0.24, y = 1.28 + i * 0.69;
        if (icy) {
          const crystal = this.cylinder("frozen-crown", 0, y, 0, 0.05, r * 0.82, 1.25,
            [0x4d95c2, 0x76c8e2, 0xb8eff4][i], 12);
          parts.push(crystal);
          parts.push(this.sphere("ice-glint", -r * 0.26, y + 0.19, -r * 0.31,
            r * 0.50, 0.43, r * 0.28, 0xc3f4fa));
        } else {
          // Bulging foliage skirts, rather than three sharp traffic cones.
          const green = harvestable ? [0x247953, 0x399451, 0x65ad56] : [0x628e73, 0x759c7a, 0x91af83];
          parts.push(this.cylinder("pine-layer", 0, y, 0, r * 0.25, r, 0.92, green[i], 16));
          parts.push(this.foliage(0, y - 0.28, 0, r * 2.02, 0.48, r * 1.94, green[Math.max(0,i-1)], green[i]));
          if (snowy) {
            parts.push(this.foliage(0, y + 0.22, 0, r * 1.48, 0.66, r * 1.44, 0xb7dce3, 0xf4fbf9));
          }
        }
      }
    } else if (biome === "desert") {
      parts.push(this.cylinder("palm-trunk", 0, 1.25, 0, 0.16, 0.31, 2.5, 0xb27c46, 12));
      for (let i = 0; i < 4; i++)
        parts.push(this.cylinder("palm-ring", 0, 0.42 + i * 0.51, 0, 0.25 - i * 0.018, 0.26 - i * 0.018, 0.10, 0x845a3c, 12));
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3, dx = Math.sin(a), dz = Math.cos(a);
        const leaf = this.foliage(dx * 0.71, 2.55, dz * 0.71, 0.54, 0.32, 1.76, 0x397c43, i % 2 ? 0x87bf50 : 0x58a34a);
        leaf.rotation.y = a;
        leaf.rotation.x = 0.27;
        parts.push(leaf);
      }
      for (const side of [-1, 1])
        parts.push(this.sphere("coconut", side * 0.24, 2.34, 0.08, 0.32, 0.36, 0.34, 0x976035));
    } else if (biome === "volcano") {
      parts.push(this.cylinder("charred-trunk", 0, 0.89, 0, 0.23, 0.42, 1.78, 0x614039));
      for (const side of [-1, 1]) {
        const branch = this.cylinder("charred-branch", side * 0.41, 1.66, 0, 0.12, 0.21, 1.06, 0x75463a);
        branch.rotation.z = -side * 0.55;
        parts.push(branch, this.foliage(side * 0.63, 2.08, 0, 1.28, 1.02, 1.21, 0x994b36, harvestable ? 0xe9813e : 0xc18d67));
      }
      parts.push(this.foliage(0, 2.64, 0.04, 1.70, 1.40, 1.53, 0xc25b37, harvestable ? 0xffb85c : 0xd1a183));
    } else {
      parts.push(this.cylinder("festival-trunk", 0, 0.82, 0, 0.23, 0.34, 1.64, trunk));
      const shades = zone === 1 ? [0x6198cb, 0xb2e2f1] : [0xb866a1, 0xf5b5d4];
      for (let i = 0; i < 3; i++)
        parts.push(this.foliage((i - 1) * 0.62, 2.04 + (i === 1 ? 0.54 : 0), 0,
          i === 1 ? 1.85 : 1.38, i === 1 ? 1.69 : 1.31, 1.44, shades[0], shades[1]));
    }
    if (harvestable)
      parts.push(this.box("fresh-trunk-notch", 0, 0.52, -0.30, 0.35, 0.15, 0.10, palette.cut));
    const mesh = this.merge(harvestable ? "harvestable-broadleaf-tree" : "decorative-forest-tree", parts);
    mesh.rotation.y = noise(seed) * Math.PI * 2;
    if (!harvestable) mesh.scaling.setAll(0.9 + noise(seed + zone) * 0.12);
    return mesh;
  }
  tree(seed: number, zone = 0, harvestable = true) {
    if (["forest", "snow", "ice", "volcano", "desert", "park"].includes(this.biome))
      return this.themedTree(seed, zone, harvestable);
    // A broad-rooted trunk and distinct crown lobes form a recognizable oak.
    const bark = harvestable ? 0x945c36 : 0xa19880;
    const parts: Mesh[] = [
      this.cylinder("grove-trunk", 0, 0.80, 0, 0.24, 0.42, 1.60, bark, 12),
      this.cylinder("root-flare", 0, 0.15, 0, 0.39, 0.53, 0.30, bark, 12),
    ];
    for (const side of [-1, 1]) {
      const branch = this.cylinder("oak-branch", side * 0.39, 1.37, 0, 0.12, 0.20, 1.08, bark, 12);
      branch.rotation.z = -side * 0.64;
      parts.push(branch);
    }
    const low = harvestable ? 0x267648 : 0x71907b;
    const mid = harvestable ? 0x49a34c : 0x8da88a;
    const high = harvestable ? 0x8bcc58 : 0xa8bb94;
    parts.push(
      this.foliage(-0.68, 1.99, 0.06, 1.68, 1.50, 1.56, low, mid),
      this.foliage(0.68, 2.05, -0.08, 1.66, 1.60, 1.60, low, mid),
      this.foliage(0, 2.52, 0.04, 1.98, 1.70, 1.76, mid, high),
      this.foliage(-0.16, 2.12, -0.55, 1.52, 1.30, 1.22, mid, high),
    );
    if (harvestable) {
      const notch = this.box("fresh-trunk-notch", 0, 0.55, -0.37, 0.36, 0.17, 0.11, palette.cut);
      notch.rotation.z = 0.17;
      parts.push(notch);
    }
    const tree = this.merge(
      harvestable ? "harvestable-broadleaf-tree" : "decorative-forest-tree",
      parts,
    );
    tree.rotation.y = noise(seed) * Math.PI * 2;
    if (!harvestable) tree.scaling.setAll(0.9 + noise(seed + zone) * 0.12);
    if (this.biome === "frost") {
      const colors = tree.getVerticesData(VertexBuffer.ColorKind);
      if (colors) {
        for (let i = 0; i < colors.length; i += 4)
          if (
            colors[i + 1] > colors[i] * 1.04 &&
            colors[i + 1] > colors[i + 2]
          ) {
            const tint = color(
              zone === 0 ? 0xdce7dd : zone === 1 ? 0x99c3cd : 0xbb967b,
            );
            colors[i] = tint.r;
            colors[i + 1] = tint.g;
            colors[i + 2] = tint.b;
          }
        tree.setVerticesData(VertexBuffer.ColorKind, colors);
      }
    }
    return tree;
  }

  boulder(seed: number) {
    const shades: Record<string, [number, number]> = {
      snow: [0x91b4c4, 0xe6f2ef], ice: [0x619ebc, 0xade9ef],
      volcano: [0x514a52, 0xad7461], desert: [0xb78b51, 0xe5b977],
      forest: [0x668c75, 0x9bc3a2], park: [0x9a93bd, 0xd1b9df],
    };
    const [base, face] = shades[this.biome] ?? [0x708e9d, 0xc3dce1];
    const ore = this.biome === "volcano" ? 0xffb258 :
      this.biome === "desert" ? 0xffdb77 : this.biome === "ice" ? 0xc2f9ff : 0xc7eee5;
    const main = this.rock("ore-boulder", 1.70, base, seed);
    const shoulder = this.rock("ore-shoulder", 0.95, face, seed + 2);
    shoulder.position.set(-0.46, 0.12, 0.17);
    const parts = [main, shoulder];
    // A cluster with broad bright crystal faces, not tiny vein decoration.
    for (const [x, z, height, tilt] of [
      [-0.27, -0.30, 0.64, 0.29], [0.16, -0.16, 0.91, -0.13], [0.47, 0.07, 0.55, -0.37],
    ]) {
      const gem = this.cylinder("ore-crystal", x, 0.78 + height * 0.20, z, 0.10, 0.19, height * 0.72, ore, 12);
      gem.rotation.z = tilt;
      const tip = this.cylinder("ore-crystal-tip", x - Math.sin(tilt) * height * 0.45,
        0.78 + height * 0.64, z, 0.005, 0.10, height * 0.28, face, 12);
      tip.rotation.z = tilt;
      parts.push(gem, tip);
    }
    return this.merge("split-moonstone", parts);
  }
  berry() {
    const parts: Mesh[] = [
      this.foliage(-0.30, 0.34, 0.02, 0.94, 0.69, 0.87, 0x286f4b, 0x69ad4e),
      this.foliage(0.32, 0.39, 0, 0.95, 0.75, 0.87, 0x347d4b, 0x7eb74f),
      this.foliage(0, 0.60, 0.12, 0.97, 0.72, 0.89, 0x39854b, 0x8bc858),
    ];
    // Four large red berries survive the small phone viewport much better
    // than eight tiny dots. Their calyx is built into the merged bush.
    for (const [x,y,z] of [[-0.43,0.56,-0.33],[0.40,0.62,-0.32],[0,0.91,-0.16],[0.10,0.50,0.43]]) {
      parts.push(this.sphere("ripe-berry", x,y,z,0.34,0.37,0.34,0xe34e40));
      parts.push(this.sphere("berry-highlight", x-0.07,y+0.09,z-0.12,0.10,0.11,0.065,0xffad80));
      parts.push(this.sphere("berry-calyx", x,y+0.17,z,0.17,0.07,0.16,0x427c3b));
    }
    return this.merge("sunberry-bush", parts);
  }
  resource(kind: string, name = "resource") {
    if (kind === "wood") return this.log(name);
    if (kind === "stone") return this.stonePiece(name);
    if (kind === "plank") return this.plank(name);
    if (kind === "brick") return this.brick(name);
    if (kind === "coin") {
      const body = this.cylinder(name, 0, 0, 0, 0.16, 0.16, 0.066, 0xd9912d, 16);
      body.rotation.x = Math.PI / 2;
      const parts = [body];
      for (const sign of [-1, 1]) {
        const face = this.cylinder(
          name + "-gold-face", 0, 0, sign * 0.036, 0.129, 0.129, 0.009, 0xffd45e, 16,
        );
        face.rotation.x = Math.PI / 2;
        const stamp = this.box(
          name + "-light-emblem", 0, 0, sign * 0.043, 0.105, 0.105, 0.009, 0xfff0ac,
        );
        stamp.rotation.z = Math.PI / 4;
        parts.push(face, stamp);
      }
      return this.merge(name, parts);
    }
    const leaf = this.box("berry-leaf", 0.035, 0.135, 0, 0.17, 0.035, 0.085, 0x579d47);
    leaf.rotation.z = 0.42;
    return this.merge(name, [
      this.sphere(name, -0.065, 0, 0, 0.23, 0.25, 0.22, 0xe65344),
      this.sphere(name + "-small-berry", 0.09, -0.025, 0.035, 0.18, 0.19, 0.18, 0xf88b56),
      leaf,
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
    const stone = this.stonePiece("helper-stone", 0.68);
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
        this.cylinder("tent-pole", x, 0.77, 0, 0.1, 0.1, 1.52, 0x9e744d, 6),
      );
    const roof = this.box(
      "sloping-canopy",
      -0.42,
      1.11,
      0,
      1.3,
      0.18,
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
      0.18,
      2.03,
      0x56aaa3,
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
    // Each creature has a different silhouette, even without its name or HP bar.
    // All parts merge into a single source mesh shared by existing instances.
    const ball = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, tint: number) =>
      p.push(this.sphere(name, x, y, z, w, h, d, tint));
    const cone = (name: string, x: number, y: number, z: number, rt: number, rb: number, height: number, tint: number, tilt = 0) => {
      const mesh = this.cylinder(name, x, y, z, rt, rb, height, tint, 12);
      mesh.rotation.z = tilt;
      p.push(mesh);
    };
    const eyes = (width: number, y: number, z: number, rim = 0xffe5ae, size = 1) => {
      for (const side of [-1, 1]) {
        ball("eye-mask", side * width, y, z, 0.23 * size, 0.25 * size, 0.10, rim);
        ball("eye", side * width, y, z + 0.046, 0.105 * size, 0.15 * size, 0.065, 0x273442);
        ball("eye-glint", side * width - 0.025 * size, y + 0.047 * size, z + 0.077, 0.042 * size, 0.052 * size, 0.022, 0xfff8e6);
      }
    };
    if (type === 0) {
      // Violet sprout slime: broad jelly body, tiny feet, curled antenna.
      ball("jelly-body", 0, 0.47, 0, 1.04, 0.94, 0.86, 0x9372bd);
      ball("jelly-belly", 0, 0.36, 0.34, 0.64, 0.49, 0.19, 0xd7b4e1);
      for (const side of [-1,1]) {
        ball("jelly-foot", side * 0.29, 0.12, 0.13, 0.36, 0.25, 0.37, 0x684d98);
        cone("sprout-stalk", side * 0.20, 0.97, -0.02, 0.045, 0.09, 0.36, 0x7353a3, -side * 0.47);
        ball("sprout-tip", side * 0.29, 1.11, -0.02, 0.20, 0.20, 0.20, 0xf3ba78);
      }
      eyes(0.18, 0.61, 0.385, 0xe2bce9);
    } else if (type === 1) {
      // Armored beetle: a wide segmented shell, dark head and visible feet.
      ball("beetle-belly", 0, 0.37, 0, 1.22, 0.55, 1.14, 0x375d4c);
      ball("beetle-shell", 0, 0.62, -0.12, 1.38, 0.89, 1.18, 0x56984a);
      ball("beetle-shell-highlight", 0, 0.87, -0.17, 1.04, 0.41, 0.83, 0x9dc65d);
      p.push(this.box("shell-seam", 0, 0.99, -0.13, 0.075, 0.08, 0.74, 0x3e7046));
      ball("beetle-head", 0, 0.46, 0.53, 0.78, 0.62, 0.55, 0x416b4d);
      for (const side of [-1,1]) {
        for (const z of [-0.36, 0.34])
          ball("beetle-foot", side * 0.57, 0.16, z, 0.35, 0.29, 0.32, 0x6e6844);
        cone("beetle-horn", side * 0.23, 0.84, 0.56, 0.015, 0.13, 0.40, 0xf2ce87, -side * 0.23);
      }
      eyes(0.19, 0.52, 0.75, 0xffe3a0, 0.92);
    } else if (type === 2) {
      // Orange flying bird: spread wings, cream belly, beak and tail.
      ball("bird-body", 0, 0.48, 0, 0.66, 0.71, 0.70, 0xd66e36);
      ball("bird-belly", 0, 0.42, 0.27, 0.48, 0.48, 0.24, 0xffdfa4);
      ball("bird-head", 0, 0.80, 0.18, 0.61, 0.59, 0.58, 0xf0a047);
      for (const side of [-1,1]) {
        const wing = this.sphere("bird-wing", side * 0.56, 0.65, -0.06, 1.04, 0.26, 0.60, 0xc75d39);
        wing.rotation.z = side * 0.24;
        p.push(wing);
        const feather = this.sphere("wing-feathers", side * 0.69, 0.70, -0.07, 0.75, 0.21, 0.44, 0xffbb5f);
        feather.rotation.z = side * 0.24;
        p.push(feather);
        ball("bird-foot", side * 0.14, 0.11, 0.16, 0.17, 0.18, 0.27, 0xc27c3c);
      }
      const tail = this.sphere("bird-tail", 0, 0.52, -0.52, 0.31, 0.18, 0.64, 0xb85a37);
      tail.rotation.x = 0.40;
      p.push(tail);
      ball("bird-beak", 0, 0.72, 0.53, 0.23, 0.17, 0.33, 0xffcf59);
      eyes(0.16, 0.84, 0.42, 0xffe6a7, 0.83);
    } else if (type === 3) {
      // Blue wolf: four paws, separate head, pointed ears and bushy tail.
      ball("wolf-body", 0, 0.56, -0.13, 0.77, 0.70, 1.31, 0x628cae);
      ball("wolf-chest", 0, 0.54, 0.36, 0.67, 0.70, 0.54, 0xc0e3ea);
      for (const side of [-1,1]) {
        for (const z of [-0.49,0.37]) {
          ball("wolf-leg", side * 0.28, 0.26, z, 0.25, 0.48, 0.27, 0x537c9f);
          ball("wolf-paw", side * 0.28, 0.09, z + 0.065, 0.30, 0.18, 0.33, 0xd7eced);
        }
        cone("wolf-ear", side * 0.26, 1.16, 0.46, 0.015, 0.19, 0.48, 0x648fb2, -side * 0.12);
      }
      ball("wolf-head", 0, 0.84, 0.49, 0.84, 0.68, 0.67, 0x83b5ce);
      ball("wolf-muzzle", 0, 0.68, 0.83, 0.47, 0.33, 0.51, 0xe5f3ec);
      ball("wolf-nose", 0, 0.76, 1.04, 0.21, 0.15, 0.16, 0x304859);
      const tail = this.sphere("wolf-tail", 0, 0.73, -0.84, 0.38, 0.38, 0.86, 0x8bbbd3);
      tail.rotation.x = 0.42; p.push(tail);
      eyes(0.23, 0.91, 0.78, 0xdaf2ed, 0.78);
    } else {
      // Crystal golem and guardian share a strong torso silhouette, but their
      // purple/blue versus gold/bronze armor and crown separate their roles.
      const boss = type === 5, shell = boss ? 0xb08042 : 0x756ba7;
      const plate = boss ? 0xf0bb58 : 0xa8b3db;
      const crystal = boss ? 0xffe49a : 0x85e2ec;
      ball("golem-torso", 0, 0.67, 0, 1.18, 1.13, 0.95, shell);
      ball("golem-face", 0, 0.82, 0.40, 0.82, 0.65, 0.31, boss ? 0x79563a : 0x4b526e);
      for (const side of [-1,1]) {
        ball("golem-shoulder", side * 0.57, 0.75, 0.01, 0.55, 0.61, 0.56, plate);
        ball("golem-fist", side * 0.70, 0.34, 0.20, 0.46, 0.52, 0.53, shell);
        ball("golem-foot", side * 0.30, 0.15, 0.15, 0.48, 0.30, 0.51, plate);
        cone("golem-side-crystal", side * 0.38, 1.22, -0.13, 0.02, 0.19, 0.62, crystal, -side * 0.24);
      }
      cone("golem-center-crystal", 0, 1.42, -0.12, 0.015, 0.25, 0.92, crystal);
      const emblem = this.box("golem-core", 0, 0.36, 0.48, 0.30, 0.30, 0.13, crystal);
      emblem.rotation.z = Math.PI / 4; p.push(emblem);
      eyes(0.20, 0.90, 0.56, boss ? 0xffdf86 : 0xcaf9ee, 0.91);
    }
    return this.merge(
      ["mist-mote", "moss-helmet", "dusk-flier", "frost-wolf", "crystalback", "guardian"][type],
      p,
    );
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
  player(maxCargo = 100) {
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
    const cargoSource = this.log("cargo-log-source");
    cargoSource.setEnabled(false);
    const stoneSource = this.stonePiece("cargo-stone-source", 0.33);
    stoneSource.setEnabled(false);
    const wood = Array.from({ length: maxCargo }, (_, i) => {
        const m = cargoSource.createInstance("carried-log-" + i);
        m.scaling.x = 1.35;
        m.parent = cargoRoot;
        m.position.set(
          ((i % 2) - 0.5) * 0.09,
          Math.floor(i / 2) * 0.34,
          ((i % 2) - 0.5) * 0.42 + Math.sin(i * 3) * 0.025,
        );
        m.rotation.y = Math.floor(i / 2) % 2 ? 0.12 : -0.12;
        m.setEnabled(false);
        return m;
      }),
      stone = Array.from({ length: maxCargo }, (_, i) => {
        const m = stoneSource.createInstance("carried-stone-" + i);
        m.parent = cargoRoot;
        m.position.set(((i % 2) - 0.5) * 0.31, Math.floor(i / 2) * 0.3, 0.39);
        m.setEnabled(false);
        return m;
      });
    const planks = this.plank("carried-planks", 1.05, 0.15, 0.35);
    planks.parent = cargoRoot;
    const plankMatrices = new Float32Array(maxCargo * 16);
    for (let i = 0; i < maxCargo; i++)
      Matrix.Translation(
        ((i % 2) - 0.5) * 0.06,
        Math.floor(i / 2) * 0.24,
        0.1 + ((i % 2) - 0.5) * 0.39,
      ).copyToArray(plankMatrices, i * 16);
    planks.thinInstanceSetBuffer("matrix", plankMatrices, 16, true);
    planks.thinInstanceCount = 0;
    planks.setEnabled(false);
    planks.alwaysSelectAsActiveMesh = true;
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
      planks,
      wood,
      stone,
      food,
    };
  }
}
