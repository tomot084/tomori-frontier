import type { Building, Economy, Machine } from "./data";
import type { ContentPlacement } from "./content";
export interface Location {
  x: number;
  y: number;
}
export interface StageDefinition {
  id: string;
  name: string;
  destination: string;
  spawn: Location;
  areas: {
    id: string;
    name: string;
    start: number;
    end: number;
    grass: number;
    cliff: number;
    enemies: number[];
  }[];
  buildings: Building[];
  camps: Location[];
  layout: Record<
    | "inputPoint"
    | "sawPoint"
    | "outputPoint"
    | "marketPoint"
    | "customerPoint"
    | "tillPoint"
    | "turretPoint"
    | "drillPoint"
    | "towerPoint",
    Location
  >;
  investments: Record<string, Location>;
  contents: ContentPlacement[];
  treasures: (Location & { id: string; zone: number; coin: number })[];
  raid?: Location & { unlock: number; lanes: (Location & { name: string })[] };
  resourceSeed: number;
  machineRules?: Partial<Record<Machine, { price?: number; unlock?: number }>>;
  drillNodeId?: string;
}
export interface StageArchive {
  zone: number;
  progress: Record<string, number>[];
  economy: Economy;
  x: number;
  y: number;
  won: boolean;
}
const layout = {
  inputPoint: { x: 465, y: 430 },
  sawPoint: { x: 380, y: 430 },
  outputPoint: { x: 295, y: 430 },
  marketPoint: { x: 610, y: 500 },
  customerPoint: { x: 610, y: 625 },
  tillPoint: { x: 650, y: 560 },
  turretPoint: { x: 400, y: 1000 },
  drillPoint: { x: 170, y: 1120 },
  towerPoint: { x: 450, y: 1550 },
};
const buildings: Building[] = [
  { name: "芽渡り橋", y: 730, cost: { wood: 20, stone: 10, food: 0 }, zone: 1 },
  {
    name: "霧払い門",
    y: 1280,
    cost: { wood: 55, stone: 45, food: 8 },
    zone: 2,
  },
  {
    name: "暁の灯台",
    y: 1830,
    cost: { wood: 90, stone: 80, food: 16 },
    zone: 3,
  },
];
const contents: ContentPlacement[] = [
  { id: "orchard", x: 760, y: 580, unlock: 0 },
  { id: "lumberCamp", x: 170, y: 840, unlock: 1 },
  { id: "minerCamp", x: 740, y: 1130, unlock: 1 },
  { id: "splitter", x: 310, y: 590, unlock: 1 },
  { id: "kiln", x: 180, y: 1480, unlock: 2 },
  { id: "snare", x: 620, y: 1600, unlock: 2 },
  { id: "shrine", x: 700, y: 840, unlock: 1 },
  { id: "portal", x: 720, y: 1740, unlock: 2 },
];
export const frontierStage: StageDefinition = {
  id: "frontier",
  name: "灯芽の群島",
  destination: "frost",
  spawn: { x: 450, y: 360 },
  resourceSeed: 0,
  raid: {
    x: 500,
    y: 1040,
    unlock: 1,
    lanes: [
      { x: 180, y: 1040, name: "西" },
      { x: 790, y: 1040, name: "東" },
      { x: 500, y: 800, name: "北" },
    ],
  },
  areas: [
    {
      id: "meadow",
      name: "芽吹きの作業島",
      start: -80,
      end: 692,
      grass: 0xbdd6a2,
      cliff: 0x9d9074,
      enemies: [0, 1, 2],
    },
    {
      id: "mist",
      name: "霧林の開拓島",
      start: 768,
      end: 1242,
      grass: 0x94c3ad,
      cliff: 0x9a947b,
      enemies: [0, 1, 2],
    },
    {
      id: "dawn",
      name: "暁の工業島",
      start: 1318,
      end: 1965,
      grass: 0xc3c9a2,
      cliff: 0x93998c,
      enemies: [0, 1, 2],
    },
  ],
  buildings,
  camps: [
    { x: 450, y: 290 },
    { x: 690, y: 940 },
    { x: 690, y: 1490 },
  ],
  layout,
  investments: {},
  contents,
  treasures: [
    { id: "mist-east", x: 790, y: 800, zone: 1, coin: 35 },
    { id: "mist-west", x: 90, y: 1210, zone: 1, coin: 35 },
    { id: "dawn-east", x: 780, y: 1370, zone: 2, coin: 50 },
    { id: "dawn-west", x: 100, y: 1740, zone: 2, coin: 50 },
  ],
};
export const frostStage: StageDefinition = {
  id: "frost",
  name: "霜灯群島",
  destination: "frontier",
  spawn: { x: 450, y: 360 },
  resourceSeed: 23,
  raid: {
    x: 470,
    y: 1050,
    unlock: 1,
    lanes: [
      { x: 150, y: 1050, name: "西" },
      { x: 790, y: 1050, name: "東" },
      { x: 470, y: 800, name: "北" },
    ],
  },
  areas: [
    {
      id: "frostwood",
      name: "霜根の森",
      start: -80,
      end: 692,
      grass: 0xd3e4db,
      cliff: 0x96aeb6,
      enemies: [3, 2, 4],
    },
    {
      id: "crystal",
      name: "晶石渓谷",
      start: 768,
      end: 1242,
      grass: 0xa9c7d3,
      cliff: 0x879fad,
      enemies: [3, 4, 1],
    },
    {
      id: "ember",
      name: "熔灯高原",
      start: 1318,
      end: 1965,
      grass: 0xd1b79e,
      cliff: 0x9c817b,
      enemies: [4, 3, 2],
    },
  ],
  buildings: [
    {
      name: "霜渡り橋",
      y: 730,
      cost: { wood: 45, stone: 25, food: 6 },
      zone: 1,
    },
    {
      name: "晶石の門",
      y: 1280,
      cost: { wood: 85, stone: 100, food: 15 },
      zone: 2,
    },
    {
      name: "熔灯の灯台",
      y: 1830,
      cost: { wood: 160, stone: 180, food: 30 },
      zone: 3,
    },
  ],
  camps: [
    { x: 450, y: 290 },
    { x: 690, y: 940 },
    { x: 690, y: 1490 },
  ],
  layout: {
    ...layout,
    turretPoint: { x: 550, y: 1050 },
    drillPoint: { x: 230, y: 1150 },
    towerPoint: { x: 520, y: 1540 },
  },
  investments: { bounty: { x: 330, y: 970 } },
  contents: contents.map((c) => ({
    ...c,
    ...(
      {
        portal: { x: 740, y: 230, unlock: 0 },
        orchard: { x: 740, y: 580 },
        lumberCamp: { x: 170, y: 900 },
        minerCamp: { x: 740, y: 1190 },
        kiln: { x: 180, y: 1620 },
        snare: { x: 370, y: 1430 },
        shrine: { x: 170, y: 1410, unlock: 2 },
      } as Partial<Record<string, Partial<ContentPlacement>>>
    )[c.id],
  })),
  treasures: [
    { id: "frost-north", x: 120, y: 240, zone: 0, coin: 30 },
    { id: "crystal-east", x: 790, y: 820, zone: 1, coin: 60 },
    { id: "ember-west", x: 90, y: 1770, zone: 2, coin: 90 },
  ],
};
/** Reuse the common three-island progression with independent saved economies. */
type ThemeSpec = {
  id: string;
  name: string;
  seed: number;
  areas: [string, string, string];
  grass: [number, number, number];
  cliff: [number, number, number];
  enemies: [number[], number[], number[]];
  goals: [string, string, string];
  costs: [number[], number[], number[]];
};
function themedStage(spec: ThemeSpec): StageDefinition {
  const { id, seed } = spec;
  const industrial = id === "ice" || id === "volcano";
  const trade = id === "park" || id === "desert";
  const placements: Partial<Record<string, Partial<ContentPlacement>>> = {
    portal: { x: 740, y: 230, unlock: 0 },
    orchard: { price: id === "park" ? 35 : 55 },
    lumberCamp: { x: 170, y: 900, price: id === "forest" ? 45 : id === "desert" ? 110 : 80 },
    minerCamp: { price: id === "ice" ? 55 : 95 },
    kiln: { price: id === "volcano" ? 85 : 160 },
    snare: { price: id === "snow" ? 65 : 120 },
    shrine: { price: id === "desert" ? 45 : 75 },
    splitter: { price: id === "park" ? 40 : 70 },
  };
  return {
    id, name: spec.name, destination: "frontier",
    spawn: { ...frontierStage.spawn }, resourceSeed: seed,
    areas: frontierStage.areas.map((a, i) => ({
      ...a, id: id + "-" + i, name: spec.areas[i],
      grass: spec.grass[i], cliff: spec.cliff[i], enemies: [...spec.enemies[i]],
    })),
    buildings: frontierStage.buildings.map((b, i) => ({
      ...b, name: spec.goals[i],
      cost: { wood: spec.costs[i][0], stone: spec.costs[i][1], food: spec.costs[i][2] },
    })),
    camps: frontierStage.camps.map((c) => ({ ...c })),
    layout: {
      ...layout,
      turretPoint: industrial ? { x: 525, y: 1030 } : { x: 400, y: 1000 },
      drillPoint: trade ? { x: 215, y: 1120 } : { x: 170, y: 1120 },
      towerPoint: { x: trade ? 520 : 450, y: 1550 },
    },
    investments: { bounty: { x: industrial ? 320 : 535, y: 965 } },
    contents: contents.map((c) => ({ ...c, ...placements[c.id] })),
    machineRules: {
      drill: { price: id === "ice" ? 75 : 120 },
      turret: { price: id === "volcano" ? 90 : 150 },
      collector: { price: id === "desert" ? 85 : 140 },
    },
    treasures: [
      { id: id + "-arrival", x: 120, y: 245, zone: 0, coin: 30 },
      { id: id + "-east", x: 790, y: 820, zone: 1, coin: 55 + seed % 20 },
      { id: id + "-west", x: 105, y: 1760, zone: 2, coin: 85 + seed % 30 },
    ],
    raid: {
      x: industrial ? 560 : 500, y: 1040, unlock: 1,
      lanes: [
        { x: 175, y: 1040, name: "西" },
        { x: 790, y: 1040, name: "東" },
        { x: industrial ? 560 : 500, y: 800, name: "北" },
      ],
    },
  };
}
const forestStage = themedStage({
  id: "forest", name: "翠樹群島", seed: 41,
  areas: ["巨木の森", "苔むす谷", "樹海の聖域"],
  grass: [0x92bf79, 0x6fa77b, 0x9abf72], cliff: [0x806f50, 0x617c62, 0x897853],
  enemies: [[0, 1, 2], [1, 0, 2], [1, 4, 2]],
  goals: ["巨木の橋", "樹海の門", "森の大灯樹"],
  costs: [[60, 20, 4], [130, 55, 12], [240, 95, 24]],
});
const snowStage = themedStage({
  id: "snow", name: "白雪群島", seed: 67,
  areas: ["雪原の村", "白樺の雪林", "吹雪の峠"],
  grass: [0xe1eee8, 0xd2e6e8, 0xc4dae4], cliff: [0x91aab8, 0x8ba1ae, 0x8297aa],
  enemies: [[0, 3, 2], [3, 2, 0], [3, 4, 2]],
  goals: ["雪渡り橋", "吹雪避けの門", "白雪の灯台"],
  costs: [[65, 40, 12], [110, 90, 26], [170, 150, 50]],
});
const iceStage = themedStage({
  id: "ice", name: "氷晶群島", seed: 83,
  areas: ["青氷湖", "氷晶洞窟", "永久凍土"],
  grass: [0x9fd9e7, 0x83bedc, 0xa8c9ee], cliff: [0x598cae, 0x6489bf, 0x668db4],
  enemies: [[3, 0, 2], [4, 3, 2], [4, 3, 4]],
  goals: ["氷晶橋", "結晶の門", "氷晶の灯台"],
  costs: [[45, 85, 8], [95, 180, 18], [155, 320, 30]],
});
const volcanoStage = themedStage({
  id: "volcano", name: "熔火群島", seed: 101,
  areas: ["黒曜の荒野", "溶岩の峡谷", "火口要塞"],
  grass: [0x9d8580, 0x9e6f60, 0x88736f], cliff: [0x50494d, 0x624342, 0x493f48],
  enemies: [[2, 0, 1], [2, 4, 1], [4, 2, 1]],
  goals: ["耐熱橋", "黒曜の防壁", "熔火の灯台"],
  costs: [[70, 75, 8], [130, 150, 20], [250, 280, 36]],
});
const desertStage = themedStage({
  id: "desert", name: "砂陽群島", seed: 127,
  areas: ["砂漠のオアシス", "古代遺跡", "黄金の砂丘"],
  grass: [0xe9ca84, 0xd6b16d, 0xe3c184], cliff: [0xa98251, 0xb08b60, 0xa37a50],
  enemies: [[2, 0, 1], [2, 1, 0], [2, 4, 1]],
  goals: ["砂渡り橋", "遺跡の門", "太陽の塔"],
  costs: [[55, 55, 12], [105, 120, 24], [180, 230, 40]],
});
const parkStage = themedStage({
  id: "park", name: "夢灯遊園群島", seed: 149,
  areas: ["お祭り広場", "おもちゃの庭", "星明かり遊園地"],
  grass: [0xa7d7a9, 0xb5c9e7, 0xe0b6cc], cliff: [0x8aa5a6, 0x858eb1, 0xaa819b],
  enemies: [[0, 2, 1], [0, 2, 0], [2, 1, 4]],
  goals: ["虹色の橋", "お祭りの門", "夢灯の大塔"],
  costs: [[65, 35, 15], [120, 90, 30], [200, 150, 55]],
});
export const stages: Record<string, StageDefinition> = {
  frontier: frontierStage, frost: frostStage,
  forest: forestStage, snow: snowStage, ice: iceStage,
  volcano: volcanoStage, desert: desertStage, park: parkStage,
};
/** Keep existing default routes while allowing selection of any other theme. */
const travelNetwork = ["frontier", "frost", "forest", "snow", "ice", "volcano", "desert", "park"];
export function stageDestinations(stage: StageDefinition): StageDefinition[] {
  const ids = travelNetwork.includes(stage.id)
    ? [stage.destination, ...travelNetwork]
    : [stage.destination];
  return [...new Set(ids)].filter((id) => id !== stage.id && Object.hasOwn(stages, id))
    .map((id) => stages[id]);
}
export const getStage = (id?: string) =>
  stages[id ?? "frontier"] ?? frontierStage;
