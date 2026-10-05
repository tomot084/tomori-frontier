import { test, expect } from "@playwright/test";
test("right-side touch works and real pickup updates the objective and HUD", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("?e2e");
  await page.getByRole("button", { name: "島へ降りる" }).click();
  const start = await page.evaluate(() => (window as any).__game.state());
  const touch = await context.newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 305, y: 610 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 350, y: 610 }],
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__game.state().x))
    .toBeGreaterThan(start.x + 10);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(
    await page.evaluate(() => (window as any).__game.inspect().stick.id),
  ).toBe(-1);
  await page.evaluate(() => (window as any).__game.position(140, 390));
  await expect
    .poll(
      () => page.evaluate(() => (window as any).__game.state().resources.wood),
      { timeout: 12000 },
    )
    .toBe(5);
  await expect(page.locator('[data-resource="wood"] strong')).toHaveText("5");
  await expect(page.locator("#goal small")).toContainText("木 あと15");
  await expect(page.locator('[data-resource="wood"]')).toHaveClass(/collected/);
  await page.screenshot({ path: "screenshots/polish-feedback-390.png" });
  await context.close();
});
