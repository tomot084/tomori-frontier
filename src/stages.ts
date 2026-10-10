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
export const stages: Record<string, StageDefinition> = {
  frontier: frontierStage,
  frost: frostStage,
};
export const getStage = (id?: string) =>
  stages[id ?? "frontier"] ?? frontierStage;
