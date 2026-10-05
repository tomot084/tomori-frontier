import { test, expect } from "@playwright/test";
const state = (page: any) =>
  page.evaluate(() => (window as any).__game.state());
const pos = (page: any, x: number, y: number) =>
  page.evaluate(
    ([x, y]: number[]) => (window as any).__game.position(x, y),
    [x, y],
  );
for (const size of [
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 1280, height: 720 },
]) {
  test(`play and restore ${size.width}x${size.height}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: size,
      hasTouch: size.width < 500,
      isMobile: size.width < 500,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("console", (m) => {
      if (["error", "warning"].includes(m.type())) errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
    });
    await page.goto("?e2e");
    await page.getByRole("button", { name: "島へ降りる" }).click();
    await page.waitForTimeout(200);
    const initial = await state(page);
    if (size.width > 500) {
      await page.keyboard.down("ArrowRight");
      await expect
        .poll(async () => (await state(page)).x)
        .toBeGreaterThan(initial.x + 60);
      await page.keyboard.up("ArrowRight");
      await page.keyboard.down("W");
      await expect
        .poll(async () => (await state(page)).y)
        .toBeLessThan(initial.y - 15);
      await page.keyboard.up("W");
    } else {
      const session = await context.newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 80, y: size.height - 120 }],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 125, y: size.height - 145 }],
      });
      await page.waitForTimeout(450);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    await page.evaluate(() => (window as any).__game.save());
    expect((await state(page)).x).toBeGreaterThan(initial.x + 10);
    expect((await state(page)).y).toBeLessThan(initial.y - 10);
    const releasePosition = await state(page);
    await page.waitForTimeout(200);
    expect((await state(page)).x).toBeCloseTo(releasePosition.x, 0);
    expect((await state(page)).y).toBeCloseTo(releasePosition.y, 0);
    const stopped = await page.evaluate(() => (window as any).__game.inspect());
    expect(stopped.stick.id).toBe(-1);
    await pos(page, 140, 390);
    await expect
      .poll(async () => (await state(page)).resources.wood, { timeout: 12000 })
      .toBeGreaterThan(0);
    await pos(page, 695, 390);
    await expect
      .poll(async () => (await state(page)).resources.stone, { timeout: 12000 })
      .toBeGreaterThan(0);
    await page.screenshot({ path: `screenshots/review1-${size.width}.png` });
    // Real gathering/deposit routines; the hook moves between destinations only.
    async function collect(kind: string, target: number) {
      for (let attempt = 0; attempt < 75; attempt++) {
        const s = await state(page);
        if (s.resources[kind] >= target) return;
        const nodes = await page.evaluate(
          () => (window as any).__game.entities().nodes,
        );
        const n = nodes.find(
          (n: any) =>
            n.kind === kind &&
            !n.dead &&
            n.y < (s.zone === 0 ? 730 : s.zone === 1 ? 1280 : 1830),
        );
        if (!n) {
          await page.waitForTimeout(1000);
          continue;
        }
        await pos(page, n.x, n.y);
        await expect
          .poll(async () => (await state(page)).resources[kind], {
            timeout: 12000,
          })
          .toBeGreaterThan(s.resources[kind]);
        await page.waitForTimeout(350);
      }
      throw new Error("gather target failed " + kind);
    }
    await collect("wood", 20);
    await page.waitForTimeout(700);
    expect((await state(page)).resources.wood).toBe(20);
    await collect("stone", 10);
    await pos(page, 450, 682);
    await expect
      .poll(async () => (await state(page)).zone, { timeout: 10000 })
      .toBe(1);
    await pos(page, 180, 870);
    await expect
      .poll(async () => (await state(page)).kills, { timeout: 10000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => (await state(page)).resources.coin, { timeout: 5000 })
      .toBeGreaterThanOrEqual(5);
    await pos(page, 690, 940);
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "工房を開く" }).click();
    await page.getByRole("button", { name: /背かご/ }).click();
    await page.getByRole("button", { name: "工房を閉じる" }).click();
    expect((await state(page)).levels.capacity).toBe(1);
    await page.screenshot({ path: `screenshots/review2-${size.width}.png` });
    if (size.width === 390) {
      for (let index = 1; index < 3; index++) {
        const b = (
          await page.evaluate(() => (window as any).__game.entities().buildings)
        )[index];
        while ((await state(page)).zone === index) {
          for (const kind of ["wood", "stone", "food"]) {
            const s = await state(page);
            const remaining = b.cost[kind] - s.progress[index][kind];
            if (remaining > 0)
              await collect(
                kind,
                Math.min(remaining, kind === "food" ? 15 : 30),
              );
          }
          await pos(page, 450, b.y - 48);
          await page.waitForTimeout(5500);
        }
        if (index === 1) {
          await pos(page, 410, 1420);
          await page.waitForTimeout(2800);
          expect((await state(page)).zone).toBe(2);
        }
      }
      expect((await state(page)).won).toBe(true);
      await page.screenshot({ path: "screenshots/complete-390.png" });
    }
    await page.evaluate(() => (window as any).__game.save());
    const saved = await state(page);
    await page.reload();
    await page.getByRole("button", { name: "島へ降りる" }).click();
    const restored = await state(page);
    expect(restored.zone).toBe(saved.zone);
    expect(restored.levels).toEqual(saved.levels);
    expect(restored.resources).toEqual(saved.resources);
    expect(restored.progress).toEqual(saved.progress);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await context.close();
  });
}
