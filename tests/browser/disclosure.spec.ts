import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 1280, height: 720 },
]) {
  test(`local actions and quiet field ${viewport.width}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport.width < 500,
      isMobile: viewport.width < 500,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (["warning", "error"].includes(m.type())) errors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("?e2e");
    await page.locator("#start").click();
    const go = async (x: number, y: number) => {
      await page.evaluate(
        ([x, y]) => (window as any).__game.position(x, y),
        [x, y],
      );
      await page.waitForTimeout(450);
    };
    const oneAction = async () => {
      expect(
        await page
          .locator("#tile-action:visible, #shop-toggle:visible")
          .count(),
      ).toBeLessThanOrEqual(1);
      expect(
        await page.evaluate(() => {
          const boxes = [
            "hud",
            "settings",
            "invest-toggle",
            "tile-action",
            "shop-toggle",
            "stick",
          ]
            .map((id) => document.getElementById(id)!)
            .filter((e) => e.getClientRects().length)
            .map((e) => ({ id: e.id, r: e.getBoundingClientRect() }));
          const overlap = (a: DOMRect, b: DOMRect) =>
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top;
          // Heading intentionally reserves space for the two toolbar controls.
          const resources = document
            .getElementById("resources")!
            .getBoundingClientRect();
          return (
            boxes.every(
              (a) =>
                a.r.left >= 0 &&
                a.r.right <= innerWidth &&
                a.r.top >= 0 &&
                a.r.bottom <= innerHeight &&
                boxes.every(
                  (b) =>
                    a.id === b.id ||
                    (a.id === "hud" || b.id === "hud"
                      ? !overlap(resources, a.id === "hud" ? b.r : a.r)
                      : !overlap(a.r, b.r)),
                ),
            ) &&
            document.documentElement.scrollHeight === innerHeight &&
            document.documentElement.scrollWidth === innerWidth
          );
        }),
      ).toBe(true);
    };
    await go(380, 430);
    await expect(page.locator("#tile-action")).toContainText("製材所");
    await oneAction();
    await page.locator("#tile-action").click();
    await expect(page.locator("#investment-panel")).toBeVisible();
    await expect(page.locator("#tile-action")).toBeHidden();
    await page.locator("#invest-close").click();
    await go(610, 500);
    await expect(page.locator("#tile-action")).toContainText("灯材市場");
    await oneAction();
    await go(570, 240);
    await expect(page.locator("#tile-action")).toContainText("木こり");
    await oneAction();
    await go(450, 290);
    await expect(page.locator("#shop-toggle")).toBeVisible();
    await expect(page.locator("#tile-action")).toBeHidden();
    await oneAction();
    await page.locator("#shop-toggle").click();
    await expect(page.locator("#shop-panel")).toBeVisible();
    await expect(page.locator("#shop-toggle")).toBeHidden();
    await page.locator("#shop-close").click();
    await go(450, 510);
    await expect(page.locator("#tile-action")).toBeHidden();
    await expect(page.locator("#shop-toggle")).toBeHidden();
    await expect(page.locator(".line-label:visible")).toHaveCount(0);
    await oneAction();
    await page.waitForTimeout(3200);
    await page.screenshot({
      path: `screenshots/declutter-final-${viewport.width}.png`,
    });
    await go(465, 430);
    await expect(page.locator("#tile-action")).toContainText("製材所");
    await expect(page.locator(".line-label:visible")).toHaveCount(0); // Empty input stays quiet even nearby.
    if (viewport.width < 500) {
      await page.setViewportSize({
        width: viewport.height,
        height: viewport.width,
      });
      await go(450, 290);
      await oneAction();
      await page.locator("#shop-toggle").click();
      await expect(page.locator("#shop-panel")).toBeVisible();
      await page.locator("#shop-close").click();
      await page.screenshot({
        path: `screenshots/declutter-landscape-${viewport.width}.png`,
      });
    }
    expect(errors).toEqual([]);
    await context.close();
  });
}
