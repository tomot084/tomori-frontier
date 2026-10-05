import { test, expect } from "@playwright/test";
test("real gathered wood funds optional hiring, waiter delivery and a different second investment", async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.url());
    if (
      r.url().startsWith("http") &&
      new URL(r.url()).origin !== new URL(baseURL!).origin
    )
      external.push(r.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("?e2e");
  await page.getByRole("button", { name: "島へ降りる" }).click();
  await page.getByRole("button", { name: "投資先を見る" }).click();
  await expect(page.locator(".investment-card")).toHaveCount(5);
  await page.locator('[data-investment="market"]').click();
  await expect(page.locator("#goal b")).toContainText("灯材市場タイルへ行こう");
  await page.getByRole("button", { name: "投資先を見る" }).click();
  await page.getByRole("button", { name: "開拓の目印に戻す" }).click();
  await expect(page.locator("#goal b")).toContainText("木をあと5集めよう");
  // Position hook speeds up travel only; every resource is gathered by the real simulation.
  async function collect(target: number) {
    for (let i = 0; i < 12; i++) {
      const before = await page.evaluate(
        () => (window as any).__game.state().resources.wood,
      );
      if (before >= target) return;
      const node = await page.evaluate(() =>
        (window as any).__game
          .entities()
          .nodes.find((n: any) => n.zone === 0 && n.kind === "wood" && !n.dead),
      );
      await page.evaluate(
        (n) => (window as any).__game.position(n.x, n.y),
        node,
      );
      await expect
        .poll(
          () =>
            page.evaluate(() => (window as any).__game.state().resources.wood),
          { timeout: 15000 },
        )
        .toBeGreaterThan(before);
      await page.waitForTimeout(400);
    }
    throw new Error("could not gather actual wood");
  }
  async function market() {
    await page.evaluate(() => (window as any).__game.position(610, 500));
    await expect(page.locator("#tile-action")).toContainText("灯材市場");
    await page.locator("#tile-action").click();
  }
  await collect(20);
  await market();
  const wood = await page.evaluate(
    () => (window as any).__game.state().resources.wood,
  );
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() => (window as any).__game.state().resources.wood),
  ).toBe(wood);
  await page.getByRole("button", { name: "木5を売る", exact: true }).click();
  await expect(
    page.locator(".float-number").filter({ hasText: "+4 灯貨" }),
  ).toHaveCount(1);

  await page.getByRole("button", { name: "木5を売る", exact: true }).click();
  expect(
    await page.evaluate(() => (window as any).__game.state().resources.coin),
  ).toBe(8);
  await expect(page.locator("#shop")).toBeHidden();
  await page.getByRole("button", { name: "投資先を閉じる" }).click();
  await page.evaluate(() => (window as any).__game.position(600, 365));
  await page.locator("#tile-action").click();
  await page.locator('[data-investment="waiter"]').click();
  expect(
    await page.evaluate(() => (window as any).__game.state().economy.waiter),
  ).toBe(true);
  expect(
    await page.evaluate(() => (window as any).__game.state().levels.gather),
  ).toBe(0);
  await page.getByRole("button", { name: "投資先を閉じる" }).click();
  await market();
  await page.getByRole("button", { name: "持っている木を預ける" }).click();
  expect(
    await page.evaluate(() => (window as any).__game.state().economy.stock),
  ).toBe(10);
  await page.getByRole("button", { name: "投資先を閉じる" }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as any).__game.inspect().investments.waiter.cargo,
        ),
      { timeout: 12000 },
    )
    .toBe(5);
  await page.screenshot({ path: "screenshots/invest-tested-delivery-390.png" });
  await page.getByRole("button", { name: "投資先を見る" }).click();
  const paused = await page.evaluate(
    () => (window as any).__game.inspect().investments.waiter,
  );
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(
      () => (window as any).__game.inspect().investments.waiter,
    ),
  ).toEqual(paused);
  await page.getByRole("button", { name: "投資先を閉じる" }).click();
  await expect
    .poll(
      () => page.evaluate(() => (window as any).__game.state().resources.coin),
      { timeout: 20000 },
    )
    .toBe(10);
  await page.evaluate(() => (window as any).__game.position(390, 210));
  await page.locator("#tile-action").click();
  await page.locator('[data-investment="basket"]').click();
  expect(
    await page.evaluate(() => (window as any).__game.state().levels.capacity),
  ).toBe(1);
  expect(
    await page.evaluate(() => (window as any).__game.state().levels.gather),
  ).toBe(0);
  await page.getByRole("button", { name: "投資先を閉じる" }).click();
  await page.evaluate(() => (window as any).__game.save());
  await page.reload();
  await page.getByRole("button", { name: "島へ降りる" }).click();
  expect(
    await page.evaluate(() => (window as any).__game.state().economy.sold),
  ).toBe(20);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
