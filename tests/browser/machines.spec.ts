import { test, expect, type Page } from "@playwright/test";
import { fresh, freshProduction } from "../../src/data";
const viewport = { width: 390, height: 844 };
async function prepare(page: Page, zone = 1, coins = 300) {
  const s = fresh();
  s.zone = zone;
  s.x = 450;
  s.y = 510;
  s.resources.coin = coins;
  s.progress[0] = { wood: 20, stone: 10, food: 0 };
  if (zone >= 2) s.progress[1] = { wood: 55, stone: 45, food: 8 };
  s.economy!.perks = { depot: 3 };
  s.economy!.production = { ...freshProduction(), input: 120 };
  await page.addInitScript((s) => {
    if (!localStorage.getItem("tomori-frontier-v1"))
      localStorage.setItem("tomori-frontier-v1", JSON.stringify(s));
  }, s);
  await page.goto("?e2e");
  await page.locator("#start").click();
}
const pos = (p: Page, x: number, y: number) =>
  p.evaluate(([x, y]) => (window as any).__game.position(x, y), [x, y]);
const state = (p: Page) => p.evaluate(() => (window as any).__game.state());
const inspect = (p: Page) => p.evaluate(() => (window as any).__game.inspect());
async function buy(p: Page, id: string, x: number, y: number) {
  await pos(p, x, y);
  await p.locator("#invest-toggle").click();
  await p.locator(`[data-investment="${id}"]`).click();
  await expect(p.locator("#investment-panel")).toBeHidden();
}
async function snap(p: Page, name: string) {
  await p.waitForTimeout(900);
  await p.screenshot({ path: `screenshots/content-${name}-390.png` });
}
test.use({ viewport, isMobile: true, hasTouch: true });
test("wide moving conveyor, idle manual sawmill, faster physical belt and competing investments", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await prepare(page);
  await pos(page, 450, 510);
  await snap(page, "conveyor-before");
  await pos(page, 690, 940);
  const paused = (await state(page)).economy.production.output;
  await page.waitForTimeout(1600);
  expect((await state(page)).economy.production.output).toBe(paused);
  await page.locator("#invest-toggle").click();
  for (const id of ["turret", "drill", "fastbelt", "tool"])
    await expect(page.locator(`[data-investment="${id}"]`)).toBeVisible();
  await expect(page.locator('[data-investment="fastbelt"]')).toBeDisabled();
  await snap(page, "investment-choices");
  await page.locator("#invest-close").click();
  await buy(page, "conveyor", 470, 320);
  await pos(page, 450, 510);
  await snap(page, "conveyor-after");
  expect((await inspect(page)).production.conveyor).toBe(true);
  await buy(page, "fastbelt", 470, 320);
  await pos(page, 450, 510);
  await snap(page, "conveyor-fast");
  const fastTravel = (await inspect(page)).production.beltTravel;
  await page.waitForTimeout(1000);
  expect(
    (await inspect(page)).production.beltTravel - fastTravel,
  ).toBeGreaterThan(0);
  expect((await inspect(page)).production.fastMotor).toBe(true);
  await pos(page, 690, 940);
  const output = (await state(page)).economy.production.output;
  await expect
    .poll(async () => (await state(page)).economy.production.output)
    .toBeGreaterThan(output);
  await page.locator("#settings").click();
  await page.evaluate(() => (window as any).__game.save());
  const saved = await state(page);
  await page.reload();
  await page.waitForFunction(() => (window as any).__game);
  expect((await state(page)).economy).toEqual(saved.economy);
  expect(errors).toEqual([]);
});
test("constructs turret and miner, shoots real bullets, kills and drops, handles a pack and restores", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await prepare(page, 1, 600);
  await pos(page, 480, 1040);
  await snap(page, "turret-before");
  await buy(page, "turret", 400, 1000);
  await pos(page, 480, 1040);
  await snap(page, "turret-after");
  await pos(page, 690, 940);
  await expect
    .poll(async () => (await inspect(page)).machines.kills, { timeout: 20000 })
    .toBeGreaterThan(0);
  expect((await inspect(page)).machines.hits).toBeGreaterThan(0);
  expect((await inspect(page)).machines.fired).toBeGreaterThan(0);
  await buy(page, "turretReach", 400, 1000);
  await buy(page, "turretTwin", 400, 1000);
  await pos(page, 480, 1040);
  await snap(page, "turret-upgraded");
  expect((await state(page)).economy.machines).toMatchObject({
    turretReach: 1,
    turretTwin: 1,
  });
  await pos(page, 480, 1040);
  await page.screenshot({ path: "screenshots/content-turret-combat-390.png" });
  const kills = (await state(page)).kills;
  await pos(page, 410, 1110);
  await expect
    .poll(async () => (await state(page)).kills, { timeout: 20000 })
    .toBeGreaterThan(kills + 2);
  await snap(page, "pack-combat");
  await pos(page, 170, 1120);
  await snap(page, "drill-before");
  await buy(page, "drill", 170, 1120);
  await pos(page, 290, 1190);
  await snap(page, "drill-after");
  await expect
    .poll(async () => (await inspect(page)).machines.drillStock, {
      timeout: 15000,
    })
    .toBeGreaterThan(0);
  await snap(page, "drill-stock");
  const stone = (await state(page)).resources.stone;
  await pos(page, 170, 1120);
  await expect
    .poll(async () => (await state(page)).resources.stone)
    .toBeGreaterThan(stone);
  expect((await inspect(page)).machines.pool).toBe(24);
  expect((await inspect(page)).drops).toBeLessThanOrEqual(128);
  await page.locator("#settings").click();
  await page.evaluate(() => (window as any).__game.save());
  const saved = await state(page);
  await page.reload();
  await page.waitForFunction(() => (window as any).__game);
  expect((await state(page)).economy).toEqual(saved.economy);
  expect(errors).toEqual([]);
});
test("third-island collection tower visibly attracts combat drops and stores them", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await prepare(page, 2);
  await pos(page, 530, 1580);
  await snap(page, "tower-before");
  await buy(page, "collector", 450, 1550);
  await pos(page, 530, 1580);
  await snap(page, "tower-after");
  const kills = (await state(page)).kills;
  await pos(page, 400, 1420);
  await expect
    .poll(async () => (await state(page)).kills, {
      timeout: 15000,
      intervals: [50],
    })
    .toBeGreaterThan(kills);
  await pos(page, 690, 1490);
  await expect
    .poll(async () => (await inspect(page)).machines.towerStock.coin ?? 0, {
      timeout: 20000,
    })
    .toBeGreaterThan(0);
  await pos(page, 540, 1550);
  await snap(page, "tower-stock");
  const coin = (await state(page)).resources.coin;
  await pos(page, 450, 1550);
  await expect
    .poll(async () => (await state(page)).resources.coin)
    .toBeGreaterThan(coin);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
