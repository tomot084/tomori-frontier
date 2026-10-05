export type Resource = "wood" | "stone" | "food" | "coin";
export type Upgrade = "attack" | "gather" | "speed" | "health" | "capacity";
export const resourceData = {
  wood: { name: "木", icon: "木", color: 0xc49a64 },
  stone: { name: "石", icon: "石", color: 0xa8c1c7 },
  food: { name: "実", icon: "実", color: 0xed9582 },
  coin: { name: "灯貨", icon: "✦", color: 0xffdd83 },
};
export const gatherableData = {
  wood: { hp: 6, yield: 5, tool: "斧", respawn: 18 },
  stone: { hp: 9, yield: 5, tool: "鎚", respawn: 22 },
  food: { hp: 3, yield: 3, tool: "手", respawn: 15 },
};
export const enemyData = [
  {
    id: "mote",
    name: "霧ころ",
    hp: 12,
    attack: 4,
    speed: 48,
    range: 28,
    color: 0xb5a4cc,
    drop: 5,
  },
  {
    id: "shell",
    name: "苔かぶと",
    hp: 32,
    attack: 7,
    speed: 28,
    range: 32,
    color: 0x86a998,
    drop: 10,
  },
  {
    id: "dart",
    name: "宵ばね",
    hp: 9,
    attack: 3,
    speed: 90,
    range: 25,
    color: 0xe6a57b,
    drop: 6,
  },
];
export const upgradeData: Record<
  Upgrade,
  { name: string; base: number; description: string }
> = {
  attack: { name: "灯刃", base: 8, description: "攻撃 +2" },
  gather: { name: "道具", base: 7, description: "木を一撃で採集 · 速度 +25%" },
  speed: { name: "旅靴", base: 6, description: "移動 +12%" },
  health: { name: "灯衣", base: 6, description: "最大HP +20" },
  capacity: { name: "背かご", base: 5, description: "容量 +10" },
};
export const buildingData: Building[] = [
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
export interface Save {
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
  gather: 650 / (1 + s.levels.gather * 0.25),
  speed: 130 * (1 + s.levels.speed * 0.12),
  hp: 80 + s.levels.health * 20,
  capacity: 20 + s.levels.capacity * 10,
});
export const cost = (s: Save, u: Upgrade) =>
  Math.ceil(upgradeData[u].base * 1.55 ** s.levels[u]);
export function deposit(s: Save, index: number, r: "wood" | "stone" | "food") {
  const need = buildingData[index].cost[r];
  if (s.resources[r] > 0 && s.progress[index][r] < need) {
    s.resources[r]--;
    s.progress[index][r]++;
    return true;
  }
  return false;
}
export function complete(s: Save, index: number) {
  return Object.entries(buildingData[index].cost).every(
    ([r, n]) => s.progress[index][r] >= n,
  );
}
export function upgrade(s: Save, u: Upgrade) {
  const c = cost(s, u);
  if (s.resources.coin < c || s.levels[u] >= 5) return false;
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
      x: Math.max(70, Math.min(830, v.x)),
      y: Math.max(
        180,
        Math.min(v.zone < 3 ? buildingData[v.zone].y - 45 : 1950, v.y),
      ),
      hp: Math.max(1, Math.min(stats(v).hp, v.hp)),
    };
  } catch {
    return fresh();
  }
}
