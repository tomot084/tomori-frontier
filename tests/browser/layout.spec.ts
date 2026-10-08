import { test, expect } from "@playwright/test";
for (const viewport of [
  { width: 844, height: 390 },
  { width: 915, height: 412 },
])
  test(`landscape and resize ${viewport.width}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto("?e2e");
    await page.getByRole("button", { name: "島へ降りる" }).click();
    await page.waitForTimeout(500);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth === innerWidth &&
          document.documentElement.scrollHeight === innerHeight,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const canvas = page.locator("canvas");
    const rect = await canvas.boundingBox();
    expect(rect?.width).toBeCloseTo(390, 0);
    expect(rect?.height).toBeCloseTo(844, 0);
    await page.getByRole("button", { name: "設定" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "セーブデータをリセット" }).click();
    await page.getByRole("button", { name: "キャンセル" }).tap();
    await page.getByRole("button", { name: "戻る" }).click();
    expect(
      (await page.evaluate(() => (window as any).__game.state())).zone,
    ).toBe(0);
    await page.screenshot({
      path: `screenshots/landscape-resize-${viewport.width}.png`,
    });
    await context.close();
  });
