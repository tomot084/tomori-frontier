import { test, expect } from "@playwright/test";
for (const size of [
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 1280, height: 720 },
]) {
  test(`mass gathering, pack combat, stacks and touch reset ${size.width}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      viewport: size,
      hasTouch: true,
      isMobile: size.width < 500,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(baseURL + "?e2e");
    await page.locator("#start").tap();
    const state = () => page.evaluate(() => (window as any).__game.state());
    const inspect = () => page.evaluate(() => (window as any).__game.inspect());
    const pos = (x: number, y: number) =>
      page.evaluate(([x, y]) => (window as any).__game.position(x, y), [x, y]);
    await page.screenshot({
      path: `screenshots/tempo-after-${size.width}.png`,
    });
    const before = await state();
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
      .poll(async () => (await state()).x)
      .toBeGreaterThan(before.x + 30);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const stopped = await state();
    await page.waitForTimeout(200);
    expect((await state()).x).toBeCloseTo(stopped.x, 0);
    // Gather real drops, carry them to the bridge and unlock combat without granting progress.
    async function gather(kind: string, target: number) {
      for (
        let i = 0;
        i < 100 && (await state()).resources[kind] < target;
        i++
      ) {
        const n = await page.evaluate(
          (kind) =>
            (window as any).__game
              .entities()
              .nodes.find(
                (n: any) => n.zone === 0 && n.kind === kind && !n.dead,
              ),
          kind,
        );
        if (!n) {
          await page.waitForTimeout(800);
          continue;
        }
        const count = (await state()).resources[kind];
        await pos(n.x, n.y);
        await expect
          .poll(async () => (await state()).resources[kind], { timeout: 15000 })
          .toBeGreaterThan(count);
        await page.waitForTimeout(650);
      }
      expect((await state()).resources[kind]).toBeGreaterThanOrEqual(target);
    }
    console.log(size.width, "movement verified");
    await gather("wood", 100);
    await page.screenshot({ path: `screenshots/tempo-100-${size.width}.png` });
    await gather("stone", 10);
    await pos(450, 682);
    await expect
      .poll(async () => (await state()).zone, { timeout: 15000 })
      .toBe(1);
    // A pack plus its neighbouring pack remain on screen; clear repeated waves through real combat.
    await pos(180, 870);
    await page.waitForTimeout(150);
    expect(
      await page.evaluate(
        () =>
          (window as any).__game
            .entities()
            .enemies.filter(
              (e: any) =>
                e.zone === 1 &&
                !e.dead &&
                Math.hypot(e.x - 180, e.y - 870) < 285,
            ).length,
      ),
    ).toBeGreaterThanOrEqual(10);
    await page.screenshot({ path: `screenshots/tempo-pack-${size.width}.png` });
    await expect
      .poll(async () => (await state()).kills, { timeout: 12000 })
      .toBeGreaterThanOrEqual(8);
    await page.screenshot({ path: `screenshots/tempo-loot-${size.width}.png` });
    await expect
      .poll(async () => (await state()).resources.coin, { timeout: 12000 })
      .toBeGreaterThanOrEqual(45);
    await pos(690, 940);
    await page.locator("#shop-toggle").tap();
    for (let i = 0; i < 3; i++) await page.locator('[data-u="capacity"]').tap();
    for (let i = 0; i < 2; i++) await page.locator('[data-u="gather"]').tap();
    await page.locator("#shop-close").tap();
    console.log(size.width, "pack cleared and upgrades purchased");
    await gather("wood", 1000);
    await pos(450, 360);
    await page.waitForTimeout(300);
    expect((await inspect()).cargo.wood).toBeGreaterThanOrEqual(56);
    expect((await inspect()).cargo.wood).toBeLessThanOrEqual(100);
    await page.screenshot({ path: `screenshots/tempo-1000-${size.width}.png` });
    await page.locator("#settings").tap();
    await page.evaluate(() => (window as any).__game.save());
    const saved = await state();
    await page.reload();
    await page.waitForFunction(() => (window as any).__game);
    expect((await state()).resources).toEqual(saved.resources);
    await page.locator("#start").tap();
    await page.locator("#settings").tap();
    // Exercise milestone representations from compatible saved inventory, with no debug resource setter.
    await page.addInitScript(() => {
      const fixture = sessionStorage.getItem("tempo-fixture");
      if (fixture) localStorage.setItem("tomori-frontier-v1", fixture);
    });
    let stackMeshes: number | undefined;
    for (const [amount, pieces, bulk] of [
      [10, 10, 1],
      [100, 24, 1],
      [500, 42, 1.15],
      [1000, 56, 1.3],
      [5000, 80, 1.75],
      [10000, 100, 2.3],
    ]) {
      await page.evaluate((amount) => {
        const s = (window as any).__game.state();
        s.resources.wood = amount;
        sessionStorage.setItem("tempo-fixture", JSON.stringify(s));
      }, amount);
      await page.reload();
      await page.waitForFunction(() => (window as any).__game);
      expect((await inspect()).cargo.woodUnits).toBe(amount);
      await expect.poll(async () => (await inspect()).cargo.wood).toBe(pieces);
      const metrics = await inspect();
      expect(metrics.cargo.bulk).toBeCloseTo(bulk, 3);
      expect(metrics.cameraSpan[1]).toBeCloseTo(
        size.width < 500 ? 22.2 : 23.2,
        3,
      );
      if (stackMeshes !== undefined) expect(metrics.meshes).toBe(stackMeshes);
      stackMeshes = metrics.meshes;
      await page.screenshot({
        path: `screenshots/tempo-stack-${amount}-${size.width}.png`,
        style: "#intro { visibility: hidden !important; }",
      });
    }
    await page.evaluate(() => sessionStorage.removeItem("tempo-fixture"));
    console.log(size.width, "six stack milestones verified");
    await page.locator("#start").tap();
    await pos(465, 430);
    await expect
      .poll(async () => (await state()).resources.wood, { timeout: 45000 })
      .toBe(0);
    const production = (await state()).economy.production;
    expect(production.input + production.output + production.processing).toBe(
      10000,
    );
    await page.screenshot({
      path: `screenshots/tempo-unload-${size.width}.png`,
    });
    await page.locator("#settings").tap();
    await page.evaluate(() => (window as any).__game.save());
    const prior = await state();
    const raw = await page.evaluate(() =>
      localStorage.getItem("tomori-frontier-v1"),
    );
    await page.locator("#reset").tap();
    await expect(page.locator("#reset-confirm")).toBeVisible();
    await page.locator("#reset-cancel").tap();
    expect(await state()).toEqual(prior);
    expect(
      await page.evaluate(() => localStorage.getItem("tomori-frontier-v1")),
    ).toBe(raw);
    await page.locator("#reset").tap();
    await page.locator("#reset-execute").tap();
    await page.waitForFunction(
      () =>
        (window as any).__game &&
        !(document.querySelector("#start") as HTMLButtonElement).disabled,
    );
    expect(
      await page.evaluate(() => localStorage.getItem("tomori-frontier-v1")),
    ).toBeNull();
    const fresh = await state();
    expect(fresh.zone).toBe(0);
    expect(fresh.kills).toBe(0);
    expect(fresh.resources).toEqual({ wood: 0, stone: 0, food: 0, coin: 0 });
    expect((await inspect()).cargo.wood).toBe(0);
    expect((await inspect()).investments.economy.production.input).toBe(0);
    await page.locator("#start").tap();
    await pos(140, 390);
    await expect
      .poll(async () => (await state()).resources.wood, { timeout: 12000 })
      .toBe(20);
    expect(errors).toEqual([]);
    await context.close();
  });
}
