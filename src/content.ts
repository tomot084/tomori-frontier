/** Reusable content catalogue. Placement and unlocks belong to stages, behavior to systems. */
export const contentCatalog = {
  orchard: {
    name: "灯実果樹園",
    price: 55,
    group: "採集",
    color: 0x9bbc70,
    effect: "苗木が育ち、庭師が実を摘んで箱へ保管",
    benefit: "回復用の実を育てる",
  },
  lumberCamp: {
    name: "木こり小屋",
    price: 80,
    group: "運営",
    color: 0xba986d,
    effect: "木こりが出勤。木へ歩き、伐採してINPUTへ運ぶ",
    benefit: "建築用の仲間とは別に生産ラインを育てる",
  },
  minerCamp: {
    name: "採掘班の詰所",
    price: 95,
    group: "採集",
    color: 0x789ca8,
    effect: "採掘班が岩へ移動して石材を集める",
    benefit: "自動採掘機と別の場所でも石を生産",
  },
  kiln: {
    name: "灯焼きレンガ窯",
    price: 160,
    group: "運営",
    color: 0xd58f68,
    effect: "木材1・石材2を焼き、レンガを出荷。1個8灯貨",
    benefit: "石と木を商品にする新しい仕事",
  },
  splitter: {
    name: "板材分岐所",
    price: 70,
    group: "運営",
    color: 0xd5b768,
    effect: "分岐の運搬係がOUTPUTから板材を建築か市場へ運ぶ",
    benefit: "生産した板材の使い道を選ぶ",
  },
  snare: {
    name: "霧止め装置",
    price: 120,
    group: "探索",
    color: 0x7ac4ca,
    effect: "光の輪の中で敵を減速。打撃と砲台を当てやすくする",
    benefit: "大きな群れを制御する",
  },
  shrine: {
    name: "守護獣の祠",
    price: 75,
    group: "探索",
    color: 0xaaa1d2,
    effect: "祠を修復して守護獣へ挑戦。撃破報酬120灯貨",
    benefit: "大型の敵を討伐する",
  },
  portal: {
    name: "群島への航路",
    price: 150,
    group: "探索",
    color: 0x7ab9cf,
    effect: "航路を復旧し、別の3エリアを持つ霜灯群島へ",
    benefit: "新しい森・敵・設備配置を探索する",
  },
} as const;
export type ContentId = keyof typeof contentCatalog;
export const contentIds = Object.keys(contentCatalog) as ContentId[];
export interface ContentPlacement {
  id: ContentId;
  x: number;
  y: number;
  unlock: number;
  price?: number;
}
export const isContent = (id: string): id is ContentId => id in contentCatalog;

export const workshopKeys = [
  "food",
  "stone",
  "wood",
  "brick",
  "kilnWood",
  "kilnStone",
  "kilnFuel",
] as const;
