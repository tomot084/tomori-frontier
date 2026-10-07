import { test, expect } from "@playwright/test";

test("self-hosted character is ready before play and animates during real movement and gathering", async ({
  page,
}) => {
  const errors: string[] = [];
  const modelResponses: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(response.url());
    if (new URL(response.url()).pathname.endsWith("models/keeper.glb"))
      modelResponses.push(response.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("?e2e");
  await page.getByRole("button", { name: "島へ降りる" }).click();
  const inspect = () => page.evaluate(() => (window as any).__game.inspect());
  const keeper = (await inspect()).keeper;
  expect(keeper.ready).toBe(true);
  expect(keeper.source).toBe("KayKit Adventurers Rogue");
  expect(keeper.clips).toEqual(
    expect.arrayContaining(["Idle", "Run", "Punch", "PickUp"]),
  );
  expect(modelResponses).toHaveLength(1);
  expect(new URL(modelResponses[0]).searchParams.get("v")).toBe("be37133ee215");
  expect(new URL(modelResponses[0]).origin).toBe(new URL(page.url()).origin);
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => (await inspect()).keeper.clip).toBe("Run");
  await page.keyboard.up("ArrowRight");
  await page.evaluate(() => (window as any).__game.position(140, 390));
  await expect
    .poll(async () => (await inspect()).keeper.clip, { timeout: 10000 })
    .toBe("Punch");
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window as any).__game.state().resources.wood),
      { timeout: 12000 },
    )
    .toBeGreaterThan(0);
  expect((await inspect()).cargo.wood).toBeGreaterThan(0);
  expect((await inspect()).meshes).toBeLessThan(1100);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "screenshots/assets-tested-gather-390.png" });
});
