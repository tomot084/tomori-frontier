import { test, expect, type Page } from "@playwright/test";
import { fresh, freshProduction } from "../../src/data";
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const state = (page: Page) =>
  page.evaluate(() => (window as any).__game.state());
const inspect = (page: Page) =>
  page.evaluate(() => (window as any).__game.inspect());
const pos = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__game.position(x, y), [x, y]);
async function prepare(page: Page, stage = "frontier") {
  const s = fresh();
  s.zone = 2;
  s.levels.attack = 3;
  s.resources = { coin: 2000, wood: 100, stone: 100, food: 0 };
  s.x = 690;
  s.y = 940;
  s.progress[0] = { wood: 20, stone: 10, food: 0 };
  s.progress[1] = { wood: 55, stone: 45, food: 8 };
  if (stage === "frost") {
    s.stage = stage;
    s.progress[0] = { wood: 45, stone: 25, food: 6 };
    s.progress[1] = { wood: 85, stone: 100, food: 15 };
  }
  s.economy!.production = { ...freshProduction(), input: 30, conveyor: true };
  await page.addInitScript((s) => {
    if (!localStorage.getItem("tomori-frontier-v1"))
      localStorage.setItem("tomori-frontier-v1", JSON.stringify(s));
  }, s);
  await page.goto("?e2e");
  await page.locator("#start").click();
}
async function location(page: Page, id: string) {
  return page.evaluate(
    (id) =>
      (window as any).__game.entities().contents.find((c: any) => c.id === id),
    id,
  );
}
async function buy(page: Page, id: string) {
  const at = await location(page, id);
  await pos(page, at.x, at.y);
  await page.locator("#invest-toggle").click();
  await page.locator(`[data-investment="${id}"]`).click();
  await expect(page.locator("#investment-panel")).toBeHidden();
}
async function snapshot(page: Page, id: string) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `screenshots/expansion-${id}-390.png` });
}
test("constructs gardens, independent harvesting crews, kiln production, branch routing and slow fields", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await prepare(page);
  const orchard = await location(page, "orchard");
  await pos(page, orchard.x - 90, orchard.y + 70);
  await snapshot(page, "garden-before");
  await buy(page, "orchard");
  await pos(page, 650, 640);
  await snapshot(page, "garden-after");
  await buy(page, "lumberCamp");
  await buy(page, "minerCamp");
  await pos(page, 250, 900);
  await snapshot(page, "lumber-workers");
  await pos(page, 690, 940);
  await expect
    .poll(async () => (await inspect(page)).settlements.stock.food ?? 0, {
      timeout: 30000,
    })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await inspect(page)).settlements.stock.stone ?? 0, {
      timeout: 45000,
    })
    .toBeGreaterThan(0);
  expect(
    (await inspect(page)).settlements.workers
      .filter((w: any) => ["lumberCamp", "minerCamp"].includes(w.id))
      .some((w: any) => w.x !== 0 && w.y !== 0),
  ).toBe(true);
  await buy(page, "splitter");
  await page.locator("#tile-action").click();
  await page.locator('[data-board-route="market"]').click();
  await page.locator("#invest-close").click();
  expect((await state(page)).economy.boardRoute).toBe("market");
  const kiln = await location(page, "kiln");
  await pos(page, kiln.x + 85, kiln.y + 70);
  await snapshot(page, "kiln-before");
  await buy(page, "kiln");
  await page.waitForTimeout(2500);
  await pos(page, kiln.x + 85, kiln.y + 70);
  await snapshot(page, "kiln-after");
  await expect
    .poll(async () => (await inspect(page)).settlements.stock.brick ?? 0, {
      timeout: 20000,
    })
    .toBeGreaterThan(0);
  await buy(page, "snare");
  await snapshot(page, "slow-field");
  await pos(page, 690, 1490);
  await expect
    .poll(async () => (await state(page)).economy.production.uncollected, {
      timeout: 45000,
    })
    .toBeGreaterThan(0);
  // Startup retains the existing 1400 limit; a staffed district also includes idle cargo/effect pools.
  const budget = await inspect(page);
  expect(budget.meshes).toBeLessThan(1700);
  expect(budget.active).toBeLessThan(300);
  expect(budget.particles).toBeLessThanOrEqual(48);
  expect(budget.drops).toBeLessThanOrEqual(128);
  await page.locator("#settings").click();
  await page.evaluate(() => (window as any).__game.save());
  const saved = await state(page);
  await page.reload();
  await page.waitForFunction(() => (window as any).__game);
  expect((await state(page)).economy).toEqual(saved.economy);
  expect(errors).toEqual([]);
});
test("discovers a persistent treasure, fights a guardian and travels between independent worlds", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await prepare(page);
  const treasure = await page.evaluate(
    () => (window as any).__game.entities().treasures[0],
  );
  await pos(page, treasure.x, treasure.y);
  await expect
    .poll(async () => (await state(page)).economy.discoveries ?? [])
    .toContain(treasure.id);
  await snapshot(page, "treasure");
  await buy(page, "shrine");
  await pos(page, 610, 860);
  await snapshot(page, "guardian");
  await expect
    .poll(async () => (await inspect(page)).settlements.boss)
    .toBe(true);
  const boss = await page.evaluate(() =>
    (window as any).__game.entities().enemies.at(-1),
  );
  await pos(page, boss.x, boss.y);
  await expect
    .poll(async () => (await state(page)).economy.bossDefeated ?? false, {
      timeout: 25000,
    })
    .toBe(true);
  await snapshot(page, "guardian-defeated");
  await buy(page, "portal");
  await snapshot(page, "portal");
  const before = await state(page);
  await page.locator("#tile-action").click();
  await page.locator("#stage-travel").click();
  await page.waitForFunction(
    () => (window as any).__game?.state().stage === "frost",
  );
  expect((await state(page)).zone).toBe(0);
  expect((await state(page)).economy.content?.shrine).toBeUndefined();
  await page.locator("#start").click();
  await snapshot(page, "frostwood");
  const enemyTypes = await page.evaluate(() =>
    (window as any).__game.entities().enemies.map((e: any) => e.type),
  );
  expect(enemyTypes).toContain(3);
  expect(enemyTypes).toContain(4);
  const portal = await location(page, "portal");
  await pos(page, portal.x, portal.y);
  await snapshot(page, "return-portal");
  await page.locator("#tile-action").click();
  await page.locator("#stage-travel").click();
  await page.waitForFunction(
    () => (window as any).__game?.state().stage === "frontier",
  );
  const restored = await state(page);
  expect(restored.progress).toEqual(before.progress);
  expect(restored.economy.bossDefeated).toBe(before.economy.bossDefeated);
  expect(restored.economy.content.shrine).toBe(1);
  expect(restored.economy.discoveries).toContain(treasure.id);
  expect(restored.worlds.frost).toBeTruthy();
  expect(errors).toEqual([]);
});

test("frost districts reuse turrets and mining with their own placements and enemy populations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await prepare(page, "frost");
  const turret = { x: 550, y: 1050 };
  await pos(page, turret.x, turret.y);
  await snapshot(page, "crystal-valley");
  await page.locator("#invest-toggle").click();
  await page.locator('[data-investment="turret"]').click();
  await expect(page.locator("#investment-panel")).toBeHidden();
  await pos(page, 690, 940);
  await expect
    .poll(async () => (await inspect(page)).machines.kills, { timeout: 30000 })
    .toBeGreaterThan(0);
  await pos(page, 230, 1150);
  await page.locator("#invest-toggle").click();
  await page.locator('[data-investment="drill"]').click();
  await expect(page.locator("#investment-panel")).toBeHidden();
  await pos(page, 690, 940);
  await expect
    .poll(async () => (await inspect(page)).machines.drillStock, {
      timeout: 20000,
    })
    .toBeGreaterThan(0);
  await pos(page, 450, 1550);
  await snapshot(page, "ember-plateau");
  expect((await state(page)).stage).toBe("frost");
  expect((await inspect(page)).settlements.stage).toBe("frost");
  expect(errors).toEqual([]);
});
