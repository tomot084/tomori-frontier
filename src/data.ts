import { getStage, stages, type StageArchive } from "./stages";
import { contentIds, workshopKeys, type ContentId } from "./content";
export type Resource = "wood" | "stone" | "food" | "coin";
export type Upgrade = "attack" | "gather" | "speed" | "health" | "capacity";
export const resourceData = {
  wood: { name: "木", icon: "木", color: 0xc49a64 },
  stone: { name: "石", icon: "石", color: 0xa8c1c7 },
  food: { name: "実", icon: "実", color: 0xed9582 },
  coin: { name: "灯貨", icon: "✦", color: 0xffdd83 },
};
export const gatherableData = {
  wood: { hp: 6, yield: 20, tool: "斧", respawn: 7 },
  stone: { hp: 9, yield: 15, tool: "鎚", respawn: 8 },
  food: { hp: 3, yield: 6, tool: "手", respawn: 6 },
};
export const enemyData = [
  {
    id: "mote",
    name: "霧ころ",
    hp: 6,
    attack: 2,
    speed: 48,
    range: 28,
    color: 0xb5a4cc,
    drop: 5,
  },
  {
    id: "shell",
    name: "苔かぶと",
    hp: 9,
    attack: 3,
    speed: 28,
    range: 32,
    color: 0x86a998,
    drop: 10,
  },
  {
    id: "dart",
    name: "宵ばね",
    hp: 3,
    attack: 2,
    speed: 76,
    range: 25,
    color: 0xe6a57b,
    drop: 6,
  },
  {
    id: "frostwolf",
    name: "霜牙",
    hp: 12,
    attack: 4,
    speed: 65,
    range: 30,
    color: 0x91bfd3,
    drop: 12,
  },
  {
    id: "crystalback",
    name: "晶甲",
    hp: 18,
    attack: 5,
    speed: 32,
    range: 34,
    color: 0xa7a1d2,
    drop: 18,
  },
  {
    id: "guardian",
    name: "霧の守護獣",
    hp: 90,
    attack: 9,
    speed: 38,
    range: 50,
    color: 0xd3ad70,
    drop: 120,
  },
];
export const upgradeData: Record<
  Upgrade,
  { name: string; base: number; description: string }
> = {
  attack: { name: "灯刃", base: 8, description: "攻撃 +2" },
  gather: {
    name: "道具",
    base: 7,
    description: "採集威力・速度・収量を大幅強化",
  },
  speed: { name: "旅靴", base: 6, description: "移動 +12%" },
  health: { name: "灯衣", base: 6, description: "最大HP +20" },
  capacity: {
    name: "背かご",
    base: 5,
    description: "容量 500 → 2000 → 5000 → 10000",
  },
};
export const buildingData = getStage().buildings;
export type Perk =
  "sawmill" | "quarry" | "depot" | "cart" | "magnet" | "bounty";
export const perkIds: Perk[] = [
  "sawmill",
  "quarry",
  "depot",
  "cart",
  "magnet",
  "bounty",
];
export interface Production {
  input: number;
  output: number;
  carried: number;
  processing: number;
  clock: number;
  conveyor: boolean;
  hauler: boolean;
  sawyer: boolean;
  uncollected: number;
  collecting?: number;
  collectionClock?: number;
}
export const freshProduction = (): Production => ({
  input: 0,
  output: 0,
  carried: 0,
  processing: 0,
  clock: 0,
  conveyor: false,
  hauler: false,
  sawyer: false,
  uncollected: 0,
  collecting: 0,
  collectionClock: 0,
});
export const machineIds = [
  "turret",
  "turretReach",
  "turretTwin",
  "drill",
  "collector",
  "fastbelt",
] as const;
export type Machine = (typeof machineIds)[number];
export interface Economy {
  content?: Partial<Record<ContentId, number>>;
  workshops?: Partial<Record<string, number>>;
  discoveries?: string[];
  boardRoute?: "build" | "market";
  bossDefeated?: boolean;
  machines?: Partial<Record<Machine, number>>;
  drillStock?: number;
  towerStock?: Partial<Record<Resource, number>>;
  production?: Production;
  perks?: Partial<Record<Perk, number>>;
  route?: "build" | "market";
  carriers: number;
  waiter: boolean;
  market: number;
  stock: number;
  sold: number;
}
export interface Save {
  stage?: string;
  worlds?: Partial<Record<string, StageArchive>>;
  economy?: Economy;
  version: 1;
  resources: Record<Resource, number>;
  levels: Record<Upgrade, number>;
  progress: Record<string, number>[];
  zone: number;
  x: number;
  y: number;
  hp: number;
  kills: number;
  time: number;
  won: boolean;
}
export const fresh = (): Save => ({
  version: 1,
  economy: { carriers: 0, waiter: false, market: 0, stock: 0, sold: 0 },
  resources: { wood: 0, stone: 0, food: 0, coin: 0 },
  levels: { attack: 0, gather: 0, speed: 0, health: 0, capacity: 0 },
  progress: [
    { wood: 0, stone: 0, food: 0 },
    { wood: 0, stone: 0, food: 0 },
    { wood: 0, stone: 0, food: 0 },
  ],
  zone: 0,
  x: 450,
  y: 360,
  hp: 80,
  kills: 0,
  time: 0,
  won: false,
});
export interface PlayerStats {
  attack: number;
  gather: number;
  speed: number;
  hp: number;
  capacity: number;
}
export interface UnlockZone {
  zone: number;
  y: number;
}
export interface Building extends UnlockZone {
  name: string;
  cost: Record<"wood" | "stone" | "food", number>;
}
export const stats = (s: Save): PlayerStats => ({
  attack: 3 + s.levels.attack * 2,
  gather: 420 / (1 + s.levels.gather * 0.65),
  speed: 182 * (1 + s.levels.speed * 0.12),
  hp: 80 + s.levels.health * 20,
  capacity: [500, 2000, 5000, 10000, 10000, 10000][s.levels.capacity],
});
export const upgradeLimit = (u: Upgrade) => (u === "capacity" ? 3 : 5);
export const cost = (s: Save, u: Upgrade) =>
  Math.ceil(upgradeData[u].base * 1.55 ** s.levels[u]);
export function deposit(s: Save, index: number, r: "wood" | "stone" | "food") {
  const need = getStage(s.stage).buildings[index].cost[r];
  if (s.resources[r] > 0 && s.progress[index][r] < need) {
    s.resources[r]--;
    s.progress[index][r]++;
    return true;
  }
  return false;
}
export function complete(s: Save, index: number) {
  return Object.entries(getStage(s.stage).buildings[index].cost).every(
    ([r, n]) => s.progress[index][r] >= n,
  );
}
export function upgrade(s: Save, u: Upgrade) {
  const c = cost(s, u);
  if (s.resources.coin < c || s.levels[u] >= upgradeLimit(u)) return false;
  s.resources.coin -= c;
  s.levels[u]++;
  if (u === "health") s.hp = stats(s).hp;
  return true;
}
export const KEY = "tomori-frontier-v1";
export function load(raw: string | null): Save {
  try {
    const v = JSON.parse(raw || "null");
    if (v?.version !== 1) return fresh();
    const f = fresh();
    for (const r of Object.keys(f.resources) as Resource[])
      if (!Number.isFinite(v.resources?.[r]) || v.resources[r] < 0) return f;
    for (const u of Object.keys(f.levels) as Upgrade[])
      if (
        !Number.isInteger(v.levels?.[u]) ||
        v.levels[u] < 0 ||
        v.levels[u] > 5
      )
        return f;
    if (
      !Array.isArray(v.progress) ||
      v.progress.length !== 3 ||
      !v.progress.every((p: Record<string, number>) =>
        ["wood", "stone", "food"].every(
          (r) => Number.isFinite(p[r]) && p[r] >= 0,
        ),
      )
    )
      return f;
    if (
      !Number.isInteger(v.zone) ||
      v.zone < 0 ||
      v.zone > 3 ||
      ![v.x, v.y, v.hp, v.time, v.kills].every(Number.isFinite)
    )
      return f;
    return {
      ...f,
      ...v,
      ...(v.stage !== undefined ? { stage: getStage(v.stage).id } : {}),
      economy: v.economy
        ? {
            ...(v.economy.content
              ? {
                  content: Object.fromEntries(
                    contentIds
                      .filter((id) => id in v.economy.content)
                      .map((id) => [id, v.economy.content[id] === 1 ? 1 : 0]),
                  ),
                }
              : {}),
            ...(v.economy.workshops
              ? {
                  workshops: Object.fromEntries(
                    workshopKeys.map((id) => [
                      id,
                      Number.isSafeInteger(v.economy.workshops[id])
                        ? Math.max(0, Math.min(2000, v.economy.workshops[id]))
                        : 0,
                    ]),
                  ),
                }
              : {}),
            ...(Array.isArray(v.economy.discoveries)
              ? {
                  discoveries: [
                    ...new Set(
                      v.economy.discoveries.filter(
                        (id: unknown) =>
                          typeof id === "string" &&
                          getStage(v.stage).treasures.some((t) => t.id === id),
                      ),
                    ),
                  ] as string[],
                }
              : {}),
            ...(v.economy.boardRoute
              ? {
                  boardRoute:
                    v.economy.boardRoute === "market" ? "market" : "build",
                }
              : {}),
            ...(v.economy.bossDefeated === true ? { bossDefeated: true } : {}),
            ...(v.economy.machines
              ? {
                  machines: Object.fromEntries(
                    machineIds
                      .filter((id) => id in v.economy.machines)
                      .map((id) => [id, v.economy.machines[id] === 1 ? 1 : 0]),
                  ),
                }
              : {}),
            ...(v.economy.drillStock !== undefined
              ? {
                  drillStock: Number.isSafeInteger(v.economy.drillStock)
                    ? Math.max(0, Math.min(500, v.economy.drillStock))
                    : 0,
                }
              : {}),
            ...(v.economy.towerStock
              ? {
                  towerStock: Object.fromEntries(
                    Object.keys(resourceData)
                      .filter((id) => id in v.economy.towerStock)
                      .map((id) => [
                        id,
                        Number.isSafeInteger(v.economy.towerStock[id])
                          ? Math.max(
                              0,
                              Math.min(2000, v.economy.towerStock[id]),
                            )
                          : 0,
                      ]),
                  ),
                }
              : {}),
            production: {
              ...freshProduction(),
              ...Object.fromEntries(
                [
                  "input",
                  "output",
                  "carried",
                  "processing",
                  "uncollected",
                  "collecting",
                ].map((k) => [
                  k,
                  Number.isSafeInteger(v.economy.production?.[k])
                    ? Math.max(0, Math.min(100000, v.economy.production[k]))
                    : 0,
                ]),
              ),
              clock: Number.isFinite(v.economy.production?.clock)
                ? Math.max(0, Math.min(10, v.economy.production.clock))
                : 0,
              collectionClock: Number.isFinite(
                v.economy.production?.collectionClock,
              )
                ? Math.max(0, Math.min(1, v.economy.production.collectionClock))
                : 0,
              conveyor: v.economy.production?.conveyor === true,
              hauler: v.economy.production?.hauler === true,
              sawyer: v.economy.production?.sawyer === true,
            },
            ...(v.economy.perks
              ? {
                  perks: Object.fromEntries(
                    perkIds.map((id) => [
                      id,
                      Number.isInteger(v.economy.perks[id])
                        ? Math.max(0, Math.min(3, v.economy.perks[id]))
                        : 0,
                    ]),
                  ),
                }
              : {}),
            ...(v.economy.route === "market" || v.economy.route === "build"
              ? { route: v.economy.route }
              : {}),
            carriers: Number.isInteger(v.economy.carriers)
              ? Math.max(0, Math.min(2, v.economy.carriers))
              : 0,
            waiter: v.economy.waiter === true,
            market: Number.isInteger(v.economy.market)
              ? Math.max(0, Math.min(3, v.economy.market))
              : 0,
            stock: Number.isInteger(v.economy.stock)
              ? Math.max(
                  0,
                  Math.min(
                    30 +
                      20 *
                        (Number.isInteger(v.economy.perks?.depot)
                          ? Math.max(0, Math.min(3, v.economy.perks.depot))
                          : 0),
                    v.economy.stock,
                  ),
                )
              : 0,
            sold: Number.isInteger(v.economy.sold)
              ? Math.max(0, v.economy.sold)
              : 0,
          }
        : {
            carriers: Math.min(2, v.zone),
            waiter: false,
            market: 0,
            stock: 0,
            sold: 0,
          },
      ...(v.worlds && typeof v.worlds === "object"
        ? {
            worlds: Object.fromEntries(
              Object.keys(stages)
                .filter((id) => v.worlds[id])
                .map((id) => {
                  const w = v.worlds[id];
                  const parsed = load(
                    JSON.stringify({
                      ...f,
                      ...w,
                      resources: v.resources,
                      levels: v.levels,
                      hp: v.hp,
                      kills: v.kills,
                      time: v.time,
                      stage: id,
                      worlds: undefined,
                    }),
                  );
                  return [
                    id,
                    {
                      zone: parsed.zone,
                      progress: parsed.progress,
                      economy: parsed.economy!,
                      x: parsed.x,
                      y: parsed.y,
                      won: parsed.won,
                    },
                  ];
                }),
            ),
          }
        : {}),
      x: Math.max(70, Math.min(830, v.x)),
      y: Math.max(
        180,
        Math.min(
          v.zone < 3 ? getStage(v.stage).buildings[v.zone].y - 45 : 1950,
          v.y,
        ),
      ),
      hp: Math.max(1, Math.min(stats(v).hp, v.hp)),
    };
  } catch {
    return fresh();
  }
}
