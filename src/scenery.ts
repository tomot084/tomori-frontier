import { getStage, type StageDefinition } from "./stages";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Art, palette, color, worldPoint } from "./models";

const rand = (n: number) => {
  const v = Math.sin(n * 39.7 + 17.5) * 41713.13;
  return v - Math.floor(v);
};
/** Bevelled islands have separate meadow, shoreline lip and stratified cliff faces. */
function island(
  art: Art,
  zone: number,
  start: number,
  end: number,
  stage: StageDefinition,
) {
  const outline: number[][] = [];
  const x0 = 65,
    x1 = 835;
  outline.push(
    [x0 + 60, start],
    [x1 - 60, start],
    [x1, start + 55],
    [x1 - 4, start + (end - start) * 0.35],
    [x1 + 8, start + (end - start) * 0.67],
    [x1 - 10, end - 55],
    [x1 - 65, end],
    [x0 + 65, end],
    [x0 - 5, end - 45],
    [x0 + 10, start + (end - start) * 0.7],
    [x0 - 8, start + (end - start) * 0.3],
    [x0, start + 55],
  );
  const positions: number[] = [],
    indices: number[] = [],
    colors: number[] = [];
  function triangle(a: Vector3, b: Vector3, c: Vector3, hex: number) {
    const base = positions.length / 3;
    for (const p of [a, b, c]) positions.push(p.x, p.y, p.z);
    indices.push(base, base + 2, base + 1);
    const co = color(hex);
    for (let i = 0; i < 3; i++) colors.push(co.r, co.g, co.b, 1);
  }
  const grass = stage.areas[zone].grass,
    center = worldPoint(450, (start + end) / 2, 0.02);
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const a = worldPoint(outline[i][0], outline[i][1], 0),
      b = worldPoint(outline[j][0], outline[j][1], 0);
    const innerA = Vector3.Lerp(a, center, 0.025),
      innerB = Vector3.Lerp(b, center, 0.025);
    innerA.y = 0.02;
    innerB.y = 0.02;
    triangle(center, innerA, innerB, grass);
    const edgeA = a.clone(),
      edgeB = b.clone();
    edgeA.y = -0.15;
    edgeB.y = -0.15;
    triangle(innerA, edgeA, innerB, 0xb7cb8c);
    triangle(innerB, edgeA, edgeB, 0xb7cb8c);
    const midA = edgeA.clone(),
      midB = edgeB.clone();
    midA.y = -0.6;
    midB.y = -0.6;
    midA.x *= 1.02;
    midB.x *= 1.02;
    triangle(edgeA, midA, edgeB, stage.areas[zone].cliff);
    triangle(edgeB, midA, midB, 0x9f9278);
    const bottomA = midA.clone(),
      bottomB = midB.clone();
    bottomA.y = -1.3 - rand(i) * 0.25;
    bottomB.y = -1.3 - rand(j) * 0.25;
    bottomA.x *= 0.98;
    bottomB.x *= 0.98;
    triangle(midA, bottomA, midB, 0x6e827a);
    triangle(midB, bottomA, bottomB, 0x7c8c81);
  }
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.colors = colors;
  data.uvs = positions.flatMap((_, i) =>
    i % 3 === 0 ? [(positions[i] + 12) / 24, (positions[i + 2] + 45) / 60] : [],
  );
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  const m = new Mesh("bevelled-island-" + zone, art.scene);
  data.applyToMesh(m);
  const tex = new DynamicTexture(
    "painted-meadow-" + zone,
    { width: 512, height: 512 },
    art.scene,
    false,
  );
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) {
    const x = rand(i + zone * 71) * 512,
      y = rand(i + 437) * 512,
      r = 15 + rand(i + 98) * 45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, i % 2 ? "rgba(58,110,56,.13)" : "rgba(245,235,180,.2)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = i % 2 ? "#e9ecd02a" : "#417a4920";
    ctx.fillRect(rand(i) * 512, rand(i + 1884) * 512, 1.5, 1);
  }
  tex.update();
  const mat = new StandardMaterial("meadow-surface-" + zone, art.scene);
  mat.diffuseTexture = tex;
  mat.specularColor = Color3.Black();
  m.material = mat;
  m.receiveShadows = true;
  m.isPickable = false;
  return m;
}
export interface BuiltSite {
  root: TransformNode;
  pieces: Mesh[];
  base: Mesh;
  marker: Mesh;
  progress: number;
}
export function makeScenery(art: Art, stage = getStage()) {
  const camps = stage.camps,
    buildingData = stage.buildings;
  const zones: Mesh[][] = [[], [], []],
    shadowCasters: Mesh[] = [];
  const water = art.box("quiet-tide", 0, -1.65, -18, 110, 0.1, 120, 0x65aeb7);
  water.receiveShadows = false;
  const ranges = stage.areas.map((a) => [a.start, a.end]);
  ranges.forEach(([start, end], zone) => {
    zones[zone].push(island(art, zone, start, end, stage));
    const details: Mesh[] = [];
    // Continuous curved ribbon, avoiding overlapping triangulated path discs.
    const pathEdges = [-1, 1].map((side) =>
      Array.from({ length: 32 }, (_, j) => {
        const y = start + (j * (end - start)) / 31;
        return worldPoint(
          450 +
            Math.sin(j * 0.18 + zone) * 17 +
            side * (35 + Math.sin(j * 0.5) * 4),
          y,
          0.036,
        );
      }),
    );
    const path = MeshBuilder.CreateRibbon(
      "worn-earth-path",
      { pathArray: pathEdges, sideOrientation: Mesh.DOUBLESIDE },
      art.scene,
    );
    art.tint(path, 0xddc69b);
    details.push(path);
    if (zone === 0) {
      // A quiet rounded work yard groups production and sales; details stay at the edges.
      const positions = [0, 0, 0],
        indices: number[] = [];
      const corners = [
        [4.7, 3],
        [-4.7, 3],
        [-4.7, -3],
        [4.7, -3],
      ];
      for (let corner = 0; corner < 4; corner++) {
        for (let step = 0; step <= 6; step++) {
          const angle = (corner * Math.PI) / 2 + (step * Math.PI) / 12;
          positions.push(
            corners[corner][0] + Math.cos(angle),
            0,
            corners[corner][1] + Math.sin(angle),
          );
        }
      }
      const count = positions.length / 3 - 1;
      for (let i = 1; i <= count; i++)
        indices.push(0, i, i === count ? 1 : i + 1);
      const yardData = new VertexData();
      yardData.positions = positions;
      yardData.indices = indices;
      yardData.uvs = positions.flatMap((_, i) =>
        i % 3 === 0
          ? [positions[i] / 12 + 0.5, positions[i + 2] / 8 + 0.5]
          : [],
      );
      yardData.normals = Array.from({ length: positions.length }, (_, i) =>
        i % 3 === 1 ? 1 : 0,
      );
      const yard = new Mesh("rounded-production-yard", art.scene);
      yardData.applyToMesh(yard);
      art.tint(yard, 0xe4cc9e);
      yard.position.copyFrom(worldPoint(420, 475, 0.04));
      details.push(yard);
      // Forest behind camp fills the opening view, leaving the walking route clear.
      for (let i = 0; i < 4; i++) {
        const tree = art.tree(90 + i, 0, false);
        tree.position.copyFrom(worldPoint(145 + i * 210, 35));
        tree.scaling.setAll(0.9 + rand(i + 12) * 0.15);
        tree.name = "border-tree-north-" + i;
        tree.freezeWorldMatrix();
        zones[0].push(tree);
        shadowCasters.push(tree);
      }
    }
    // Understory clusters and border trees create a forest, while keeping the main route readable.
    for (let i = 0; i < 8; i++) {
      const side = i % 2;
      const x = side ? 775 + rand(i) * 32 : 95 + rand(i) * 40;
      const y = start + 40 + (Math.floor(i / 2) * (end - start - 80)) / 4;
      const tree = art.tree(i + zone * 47, zone, false);
      tree.scaling.setAll(0.7 + rand(i + 4) * 0.25);
      tree.position.copyFrom(worldPoint(x, y));
      tree.name = `border-tree-${zone}-${i}`;
      tree.freezeWorldMatrix();
      zones[zone].push(tree);
    }
    for (let i = 0; i < 28; i++) {
      const x = 95 + rand(i + zone * 200) * 710,
        y = start + 32 + rand(i + 83 + zone * 70) * (end - start - 64);
      if (
        (zone === 0 && x > 210 && x < 710 && y > 190 && y < 660) ||
        Math.abs(x - 450) < 60 ||
        camps.some((c) => Math.hypot(c.x - x, c.y - y) < 92)
      )
        continue;
      const m =
        i % 9 === 0
          ? art.flower(i)
          : i % 11 === 0
            ? art.rock("meadow-pebble", 0.13 + rand(i) * 0.17, 0xa9bda3, i)
            : art.grass(i);
      m.position.copyFrom(worldPoint(x, y, 0.03));
      m.rotation.y = i * 2.4;
      details.push(m);
    }
    for (let side = 0; side < 2; side++)
      for (let j = 0; j < 10; j++) {
        const x = side ? 809 : 88,
          y = start + 65 + (j * (end - start - 110)) / 10;
        const m = art.rock("shore-rock", 0.6 + rand(j) * 0.45, 0x99b3a7, j);
        m.position.copyFrom(worldPoint(x, y, -0.17));
        m.rotation.y = j;
        details.push(m);
      }
    const merged = art.merge("meadow-and-shore-details-" + zone, details);
    merged.freezeWorldMatrix();
    zones[zone].push(merged);
    // Tide streaks below the shore, not an expensive water shader.
    const foamParts: Mesh[] = [];
    for (let j = 0; j < 13; j++) {
      const x = sideCoordinate(j),
        y = start + 30 + rand(j + zone * 3) * (end - start - 60);
      const m = art.box(
        "tide-streak",
        0,
        0,
        0,
        0.4 + rand(j) * 0.8,
        0.014,
        0.035,
        0xb6d5ce,
      );
      m.position.copyFrom(worldPoint(x, y, -1.56));
      m.rotation.y = 0.2;
      foamParts.push(m);
    }
    art.merge("tide-lines-" + zone, foamParts).freezeWorldMatrix();
    const camp = art.camp();
    camp.position.copyFrom(worldPoint(camps[zone].x, camps[zone].y, 0.03));
    camp.scaling.setAll(0.82);
    camp.freezeWorldMatrix();
    zones[zone].push(camp);
    shadowCasters.push(camp);
  });
  const sites = buildingData.map((b, i) => {
    const root = new TransformNode("construction-" + i, art.scene);
    root.position.copyFrom(worldPoint(450, b.y));
    const pieces: Mesh[] = [],
      baseParts: Mesh[] = [];
    let marker: Mesh;
    if (i < 2) {
      for (const x of [-1.18, 1.18])
        baseParts.push(
          art.box("bridge-joist", x, -0.025, 0, 0.14, 0.18, 2.16, palette.wood),
        );
      for (const x of [-1.32, 1.32])
        for (const z of [-1.05, 1.05]) {
          baseParts.push(
            art.cylinder(
              "foundation-stake",
              x,
              0.35,
              z,
              0.065,
              0.1,
              0.8,
              0xa77a48,
              7,
            ),
          );
          baseParts.push(
            art.cylinder(
              "stake-cap",
              x,
              0.77,
              z,
              0.11,
              0.11,
              0.065,
              0xd0ad73,
              7,
            ),
          );
        }
      for (let j = 0; j < 10; j++) {
        const m = art.box(
          "bridge-deck-" + j,
          0,
          0.095,
          -0.97 + j * 0.215,
          2.51,
          0.16,
          0.2,
          j % 2 ? 0xc4a475 : 0xb99465,
        );
        m.parent = root;
        pieces.push(m);
      }
      if (i === 0) {
        for (const side of [-1, 1])
          for (let j = 0; j < 4; j++) {
            const m = art.box(
              "handrail",
              side * 1.29,
              0.64,
              -0.75 + j * 0.5,
              0.055,
              0.065,
              0.52,
              0xe1c792,
            );
            m.parent = root;
            pieces.push(m);
          }
      } else {
        for (const side of [-1, 1]) {
          const footing = art.cylinder(
            "gate-foot",
            side * 1.08,
            0.15,
            0,
            0.32,
            0.36,
            0.3,
            0xc8cabb,
            6,
          );
          const pillar = art.box(
            "gate-pillar",
            side * 1.08,
            0.94,
            0,
            0.39,
            1.63,
            0.37,
            0xb5c3b6,
          );
          const stripe = art.box(
            "gate-rune",
            side * 1.08,
            1.08,
            -0.2,
            0.14,
            0.62,
            0.025,
            palette.teal,
          );
          const cap = art.cylinder(
            "gate-cap",
            side * 1.08,
            1.89,
            0,
            0.3,
            0.24,
            0.2,
            palette.tealLight,
            6,
          );
          const orb = art.sphere(
            "gate-light",
            side * 1.08,
            2.08,
            0,
            0.18,
            0.28,
            0.18,
            palette.gold,
            true,
          );
          const group = art.merge("gate-column", [
            footing,
            pillar,
            stripe,
            cap,
            orb,
          ]);
          group.parent = root;
          pieces.push(group);
        }
        const lintel = art.box(
          "gate-lintel",
          0,
          1.94,
          0,
          2.62,
          0.25,
          0.4,
          0xbaceb9,
        );
        lintel.parent = root;
        pieces.push(lintel);
        const keystone = art.cylinder(
          "gate-sunstone",
          0,
          2.19,
          0,
          0.19,
          0.26,
          0.3,
          palette.gold,
          6,
        );
        keystone.parent = root;
        pieces.push(keystone);
      }
    } else {
      baseParts.push(
        art.cylinder(
          "beacon-foundation",
          0,
          0.12,
          0,
          1.1,
          1.24,
          0.24,
          0xc2cdb9,
          10,
        ),
      );
      const pedestal = art.cylinder(
        "beacon-plinth",
        0,
        0.38,
        0,
        0.78,
        0.96,
        0.5,
        0xb3c5b9,
        8,
      );
      const stem = art.cylinder(
        "beacon-column",
        0,
        1.17,
        0,
        0.36,
        0.53,
        1.33,
        0x98b9af,
        8,
      );
      const ring = art.cylinder(
        "beacon-collar",
        0,
        1.79,
        0,
        0.61,
        0.61,
        0.18,
        palette.teal,
        8,
      );
      const cageParts: Mesh[] = [];
      for (let j = 0; j < 6; j++) {
        const a = (j * Math.PI) / 3;
        cageParts.push(
          art.cylinder(
            "beacon-frame",
            Math.cos(a) * 0.46,
            2.23,
            Math.sin(a) * 0.46,
            0.035,
            0.035,
            0.85,
            palette.leather,
            6,
          ),
        );
      }
      cageParts.push(
        art.sphere(
          "beacon-heart",
          0,
          2.2,
          0,
          0.61,
          0.9,
          0.61,
          palette.gold,
          true,
        ),
      );
      const cage = art.merge("lantern-cage", cageParts);
      const roof = art.cylinder(
        "beacon-roof",
        0,
        2.79,
        0,
        0.04,
        0.75,
        0.43,
        palette.teal,
        8,
      );
      for (const m of [pedestal, stem, ring, cage, roof]) {
        m.parent = root;
        pieces.push(m);
      }
    }
    // The unfinished site has stakes, supply pallets and a ground-level inlay.
    const inlay = art.cylinder(
      "build-inlay",
      0,
      0.032,
      0,
      1.35,
      1.35,
      0.018,
      0xd1c493,
      12,
    );
    if (i === 2) baseParts.push(inlay);
    else inlay.dispose();
    if (i < 2) {
      // A few fitted deck boards and loose lengths reveal the unfinished bridge.
      for (let j = 0; j < 3; j++)
        baseParts.push(
          art.box(
            "unfinished-deck",
            0,
            0.09,
            -0.94 + j * 0.23,
            2.5,
            0.15,
            0.2,
            palette.cut,
          ),
        );
      for (let j = 0; j < 4; j++)
        baseParts.push(
          art.box(
            "bridge-supply-plank",
            -1.85,
            0.15 + j * 0.13,
            -0.45,
            0.5,
            0.11,
            1.45,
            palette.cut,
          ),
        );
    }
    const crate = art.box(
      "supply-crate",
      -1.73,
      0.24,
      0.4,
      0.5,
      0.46,
      0.46,
      0xc09860,
    );
    baseParts.push(
      crate,
      art.box("crate-band", -1.73, 0.26, 0.16, 0.55, 0.06, 0.025, 0xf2d89d),
    );
    for (const side of [-1, 1]) {
      for (let j = 0; j < 6; j++) {
        baseParts.push(
          art.box(
            "site-inlay-dash",
            side * 1.44,
            0.05,
            -1 + j * 0.4,
            0.06,
            0.018,
            0.24,
            0xffedb8,
          ),
        );
        baseParts.push(
          art.box(
            "site-inlay-dash",
            -1.2 + j * 0.48,
            0.05,
            side * 1.2,
            0.28,
            0.018,
            0.06,
            0xffedb8,
          ),
        );
      }
    }
    const sign = art.cylinder(
      "worksite-signpost",
      1.7,
      0.55,
      -0.5,
      0.045,
      0.065,
      1.1,
      palette.wood,
      6,
    );
    baseParts.push(
      sign,
      art.box("worksite-sign", 1.7, 0.95, -0.5, 0.55, 0.3, 0.06, palette.teal),
    );
    baseParts.push(
      art.box(
        "worksite-sign-stripe",
        1.7,
        0.95,
        -0.54,
        0.3,
        0.045,
        0.025,
        palette.gold,
      ),
    );
    const base = art.merge("foundation-" + i, baseParts);
    base.parent = root;
    marker = MeshBuilder.CreateTorus(
      "worksite-marking",
      { diameter: 1.8, thickness: 0.025, tessellation: 24 },
      art.scene,
    );
    art.tint(marker, 0xf4df9c);
    marker.position.set(0, 0.035, i < 2 ? 1.3 : 0);
    marker.parent = root;
    for (const p of pieces) p.setEnabled(false);
    return { root, pieces, base, marker, progress: -1 };
  });
  return { zones, sites, shadowCasters };
}
function sideCoordinate(i: number) {
  return i % 2 ? 45 : 855;
}
