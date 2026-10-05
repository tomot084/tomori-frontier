import { test, expect } from "@playwright/test";
test("small deliveries fund an early tool upgrade and the workshop pauses play", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("?e2e");
  await page.getByRole("button", { name: "島へ降りる" }).click();
  await expect(page.locator("#goal b")).toContainText("木をあと5集めよう");
  for (let delivery = 0; delivery < 2; delivery++) {
    await page.evaluate(() => {
      const g = (window as any).__game;
      const p = g.inspect().guidance.target;
      g.position(p.x, p.y);
    });
    await expect
      .poll(
        () =>
          page.evaluate(() => (window as any).__game.state().resources.wood),
        { timeout: 15000 },
      )
      .toBeGreaterThanOrEqual(5);
    await page.evaluate(() => (window as any).__game.position(450, 682));
    await expect
      .poll(
        () =>
          page.evaluate(() => (window as any).__game.state().progress[0].wood),
        { timeout: 12000 },
      )
      .toBeGreaterThanOrEqual((delivery + 1) * 5);
    await expect
      .poll(
        () =>
          page.evaluate(() => (window as any).__game.state().resources.wood),
        { timeout: 12000 },
      )
      .toBe(0);
  }
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__game.state().resources.coin),
    )
    .toBe(8);
  await page.getByRole("button", { name: "工房を開く" }).click();
  const before = await page.evaluate(() => (window as any).__game.state());
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => (window as any).__game.state())).toEqual(
    before,
  );
  await page.locator('[data-u="gather"]').click();
  expect(
    await page.evaluate(() => (window as any).__game.state().levels.gather),
  ).toBe(1);
  await page.getByRole("button", { name: "工房を閉じる" }).click();
  await page.screenshot({ path: "screenshots/rethink-tested-390.png" });
  expect(errors).toEqual([]);
});
