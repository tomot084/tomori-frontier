import { test, expect } from "@playwright/test";
test("unlocked helper harvests and carries real materials, pauses in shop, and resumes after reload", async ({
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
  await page.addInitScript(() => {
    if (!localStorage.getItem("tomori-frontier-v1"))
      localStorage.setItem(
        "tomori-frontier-v1",
        JSON.stringify({
          version: 1,
          zone: 1,
          x: 690,
          y: 940,
          hp: 80,
          kills: 0,
          time: 0,
          won: false,
          resources: { wood: 0, stone: 0, food: 0, coin: 8 },
          levels: { attack: 0, gather: 0, speed: 0, health: 0, capacity: 0 },
          progress: [
            { wood: 20, stone: 10, food: 0 },
            { wood: 0, stone: 0, food: 0 },
            { wood: 0, stone: 0, food: 0 },
          ],
        }),
      );
  });
  await page.goto("?e2e");
  await page.getByRole("button", { name: "島へ降りる" }).click();
  await expect
    .poll(
      () => page.evaluate(() => (window as any).__game.inspect().crew[0].cargo),
      { timeout: 15000 },
    )
    .toBe(5);
  expect(
    await page.evaluate(() => (window as any).__game.state().resources.wood),
  ).toBe(0);
  await page.getByRole("button", { name: "工房を開く" }).click();
  const paused = await page.evaluate(
    () => (window as any).__game.inspect().crew,
  );
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() => (window as any).__game.inspect().crew),
  ).toEqual(paused);
  await page.getByRole("button", { name: "工房を閉じる" }).click();
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as any).__game.state().progress[1].wood),
      { timeout: 15000 },
    )
    .toBeGreaterThanOrEqual(5);
  await page.evaluate(() => (window as any).__game.position(640, 1170));
  await page.waitForTimeout(650);
  await page.screenshot({ path: "screenshots/finish-crew-tested-390.png" });
  await page.evaluate(() => (window as any).__game.save());
  const saved = await page.evaluate(() => (window as any).__game.state());
  await page.reload();
  await page.getByRole("button", { name: "島へ降りる" }).click();
  expect(
    await page.evaluate(() => (window as any).__game.state().progress),
  ).toEqual(saved.progress);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__game.inspect().crew.filter((w: any) => w.active)
            .length,
      ),
    )
    .toBe(1);
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.getByRole("button", { name: "音・完成時の振動：ON" }).click();
  expect(
    await page.evaluate(
      () => (window as any).__game.inspect().feedback.enabled,
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "戻る" }).click();
  expect(errors).toEqual([]);
});
