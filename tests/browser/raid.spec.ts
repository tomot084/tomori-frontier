import { test, expect } from "@playwright/test";
import { fresh, KEY } from "../../src/data";
test("390 touch beacon, actual waves, machinery, cargo budget and interrupted reload", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  const s = fresh();
  s.zone = 2;
  s.x = 500;
  s.y = 1040;
  s.levels.attack = 1;
  s.levels.capacity = 3;
  s.resources.wood = 10000;
  s.resources.stone = 10000;
  s.economy!.machines = { turret: 1, turretReach: 1, turretTwin: 1 };
  s.economy!.content = { snare: 1 };
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(save));
    },
    { key: KEY, save: s },
  );
  await page.goto("?e2e");
  await page.getByRole("button", { name: "島へ降りる" }).tap();
  await page.locator("#raid-start").tap();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__game.inspect().raid.active),
    )
    .toBe(true);
  const session = await context.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 90, y: 690 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 130, y: 665 }],
  });
  await page.waitForTimeout(250);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(
      () => page.evaluate(() => (window as any).__game.inspect().raid.alive),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
  const activeCargo = await page.evaluate(
    () => (window as any).__game.inspect().cargo,
  );
  expect(activeCargo.raidCompact).toBe(true);
  expect(activeCargo.woodUnits).toBe(10000);
  expect(activeCargo.wood).toBe(24);
  expect(activeCargo.stone).toBe(24);
  await page.screenshot({ path: "screenshots/raid-wave-390.png" });
  await page.evaluate(() => {
    (window as any).__raidSteer = setInterval(() => {
      const api = (window as any).__game,
        p = api.state(),
        r = api.inspect().raid;
      if (!r.active || r.countdown > 0) {
        api.input(0, 0);
        return;
      }
      // The final slot stays reserved even before the shrine makes it a guardian.
      const enemies = api
        .entities()
        .enemies.slice(0, -1)
        .filter((e: any) => !e.dead);
      enemies.sort(
        (a: any, b: any) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
      );
      const e = enemies[0],
        d = e ? Math.hypot(e.x - p.x, e.y - p.y) : 0;
      api.input(
        e && d > 48 ? (e.x - p.x) / d : 0,
        e && d > 48 ? (e.y - p.y) / d : 0,
      );
    }, 100);
  });
  await expect
    .poll(
      () => page.evaluate(() => (window as any).__game.inspect().raid.result),
      { timeout: 90000 },
    )
    .toBe("victory");
  const metrics = await page.evaluate(() => (window as any).__game.inspect());
  expect(metrics.effects).toBeLessThanOrEqual(48);
  expect(metrics.meshes).toBeLessThan(1700);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__game.inspect().cargo.wood),
    )
    .toBe(100);
  expect(
    (await page.evaluate(() => (window as any).__game.inspect().cargo))
      .raidCompact,
  ).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    clearInterval((window as any).__raidSteer);
    (window as any).__game.position(500, 1040);
    (window as any).__game.save();
  });
  await expect(page.locator("#raid-hard")).toBeVisible();
  await page.locator("#raid-hard").tap();
  await page.evaluate(() => (window as any).__game.save());
  await page.reload();
  await page.getByRole("button", { name: "島へ降りる" }).tap();
  expect(
    await page.evaluate(() => (window as any).__game.inspect().raid.active),
  ).toBe(false);
  expect(
    await page.evaluate(
      () => (window as any).__game.state().economy.raidClears,
    ),
  ).toBe(1);
  expect(errors).toEqual([]);
  await context.close();
});
