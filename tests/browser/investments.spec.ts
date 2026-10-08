import { test, expect } from "@playwright/test";
for (const size of [
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 1280, height: 720 },
]) {
  test(`physical timber economy, world purchases and save restore ${size.width}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      viewport: size,
      hasTouch: size.width < 500,
      isMobile: size.width < 500,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (["error", "warning"].includes(m.type())) errors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(baseURL + "?e2e");
    await page.locator("#start").click();
    const state = () => page.evaluate(() => (window as any).__game.state());
    const pos = async (x: number, y: number) => {
      await page.evaluate(
        ([x, y]) => (window as any).__game.position(x, y),
        [x, y],
      );
    };
    // Actual controls, then real harvesting. The position hook only skips travel.
    const before = await page.evaluate(() => (window as any).__game.state().x);
    if (size.width < 500) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 80, y: size.height - 120 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 125, y: size.height - 120 }],
      });
      await expect
        .poll(async () => Math.abs((await state()).x - before))
        .toBeGreaterThan(5);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      await page.keyboard.down("ArrowRight");
      await expect
        .poll(async () => Math.abs((await state()).x - before))
        .toBeGreaterThan(5);
      await page.keyboard.up("ArrowRight");
    }
    const stopped = await state();
    await page.waitForTimeout(350);
    expect((await state()).x).toBeCloseTo(stopped.x, 1);
    for (let i = 0; i < 8 && (await state()).resources.wood < 20; i++) {
      const n = await page.evaluate(() =>
        (window as any).__game
          .entities()
          .nodes.find((n: any) => n.kind === "wood" && n.zone === 0 && !n.dead),
      );
      const count = (await state()).resources.wood;
      if (count >= 20) break;
      await pos(n.x, n.y);
      await expect
        .poll(async () => (await state()).resources.wood, { timeout: 30000 })
        .toBeGreaterThanOrEqual(count + 20);
      await page.waitForTimeout(500);
    }
    await pos(450, 360);
    await expect.poll(async () => (await state()).resources.wood).toBe(20);
    expect(
      await page.evaluate(() => (window as any).__game.inspect().cargo.wood),
    ).toBe(12);
    await page.screenshot({ path: `screenshots/loop-stack-${size.width}.png` });
    await pos(465, 430);
    await expect
      .poll(async () => (await state()).resources.wood, { timeout: 12000 })
      .toBe(0);
    await pos(380, 470);
    await expect
      .poll(async () => (await state()).economy.production.output, {
        timeout: 60000,
      })
      .toBe(20);
    expect(
      await page.evaluate(
        () => (window as any).__game.inspect().production.piles[1],
      ),
    ).toEqual({ count: 20, buffer: true });
    await page.screenshot({
      path: `screenshots/loop-output-${size.width}.png`,
    });
    await pos(295, 430);
    await expect
      .poll(async () => (await state()).economy.production.carried, {
        timeout: 12000,
      })
      .toBe(20);
    await pos(610, 500);
    await expect
      .poll(async () => (await state()).economy.sold, { timeout: 12000 })
      .toBe(20);
    await pos(650, 560);
    await expect
      .poll(async () => (await state()).resources.coin, { timeout: 12000 })
      .toBe(40);
    await expect(page.locator('[data-resource="coin"] strong')).toHaveText(
      "40",
    );
    async function buy(id: string, x: number, y: number) {
      await pos(x, y);
      await page.locator("#invest-toggle").click();
      await page.locator(`[data-investment="${id}"]`).click();
      await expect(page.locator("#investment-panel")).toBeHidden();
    }
    await buy("carrier", 570, 240);
    await buy("hauler", 700, 430);
    await buy("sawyer", 300, 330);
    // Route integrates with existing crew; no free resources or forced ownership.
    await pos(570, 240);
    await page.locator("#tile-action").click();
    await page.locator('[data-route="market"]').click();
    await page.locator("#invest-close").click();
    await pos(380, 470);
    await expect
      .poll(async () => (await state()).economy.production.output, {
        timeout: 30000,
      })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => (await state()).economy.stock, { timeout: 45000 })
      .toBeGreaterThanOrEqual(5);
    // Hand-sell NPC-produced stock, collect enough to choose a different automation investment.
    await pos(610, 500);
    await page.locator("#tile-action").click();
    await page.locator("#market-supply").click();
    await expect(page.locator("#investment-panel")).toBeHidden();
    await expect
      .poll(async () => (await state()).resources.coin, { timeout: 30000 })
      .toBeGreaterThanOrEqual(16);
    await buy("waiter", 600, 365);
    await pos(650, 560);
    await expect
      .poll(async () => (await state()).resources.coin, { timeout: 60000 })
      .toBeGreaterThanOrEqual(24);
    await buy("conveyor", 470, 320);
    await pos(450, 510);
    await expect
      .poll(async () =>
        page.evaluate(
          () => (window as any).__game.inspect().production.conveyor,
        ),
      )
      .toBe(true);
    await expect
      .poll(async () => (await state()).economy.sold, { timeout: 30000 })
      .toBeGreaterThan(25);
    await page.screenshot({
      path: `screenshots/loop-automation-${size.width}.png`,
    });
    await page.locator("#settings").click();
    await page.evaluate(() => (window as any).__game.save());
    const saved = await state();
    await page.reload();
    await page.waitForFunction(() => (window as any).__game);
    const restored = await state();
    expect(restored.economy).toEqual(saved.economy);
    expect(restored.resources).toEqual(saved.resources);
    expect(restored.progress).toEqual(saved.progress);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await context.close();
  });
}
