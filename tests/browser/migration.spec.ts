import { test, expect } from "@playwright/test";
test("resumes existing Phaser v1 progress in 3D with bounded cargo and high-DPI resolution", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  const p = await context.newPage();
  const legacy = {
    version: 1,
    resources: { wood: 18, stone: 14, food: 7, coin: 43 },
    levels: { attack: 2, gather: 1, speed: 1, health: 1, capacity: 2 },
    progress: [
      { wood: 20, stone: 10, food: 0 },
      { wood: 55, stone: 45, food: 8 },
      { wood: 23, stone: 17, food: 4 },
    ],
    zone: 2,
    x: 690,
    y: 1490,
    hp: 82,
    kills: 11,
    time: 230,
    won: false,
  };
  await p.addInitScript(
    (s) => localStorage.setItem("tomori-frontier-v1", JSON.stringify(s)),
    legacy,
  );
  await p.goto("?e2e");
  await p.waitForFunction(() => (window as any).__game);
  expect(await p.evaluate(() => (window as any).__game.state())).toEqual({
    ...legacy,
    economy: { carriers: 2, waiter: false, market: 0, stock: 0, sold: 0 },
  });
  await p.getByRole("button", { name: "島へ降りる" }).click();
  await p.waitForTimeout(500);
  const stats = await p.evaluate(() => (window as any).__game.inspect());
  expect(stats.renderer).toBe("Babylon.js WebGL");
  expect(stats.orthographic).toBe(true);
  expect(stats.cargo.wood).toBe(8);
  expect(stats.cargo.stone).toBe(4);
  expect(stats.internalSize[0]).toBeLessThanOrEqual(488);
  expect(stats.internalSize[1]).toBeLessThanOrEqual(1056);
  expect(stats.particles).toBeLessThanOrEqual(48);
  expect(stats.meshes).toBeLessThan(400);
  await p.screenshot({ path: "screenshots/3d-legacy-save.png" });
  await context.close();
});
