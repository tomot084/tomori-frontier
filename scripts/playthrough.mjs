// Continuous play review: shared movement input only. Never grants resources or progress.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader"] });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
await page.goto(
  process.env.GAME_URL || "http://localhost:5173/tomori-frontier/?e2e",
);
await page.getByRole("button", { name: "島へ降りる" }).click();
const read = () =>
  page.evaluate(() => {
    window.__game.save();
    return window.__game.state();
  });
const entities = () => page.evaluate(() => window.__game.entities());
const input = (x, y) =>
  page.evaluate(([x, y]) => window.__game.input(x, y), [x, y]);
const start = Date.now();
async function move(x, y) {
  for (let i = 0; i < 700; i++) {
    const s = await read();
    let tx = x,
      ty = y;
    const crosses = [730, 1280].filter(
      (b) => (s.y < b + 40 && y > b + 40) || (s.y > b - 40 && y < b - 40),
    );
    if (crosses.length) {
      const b = y > s.y ? crosses[0] : crosses.at(-1);
      if (Math.abs(s.x - 450) > 8) {
        tx = 450;
        ty = s.y;
      } else {
        tx = 450;
        ty = y > s.y ? b + 45 : b - 45;
      }
    }
    const dx = tx - s.x,
      dy = ty - s.y,
      d = Math.hypot(dx, dy);
    if (Math.hypot(x - s.x, y - s.y) < 14) {
      await input(0, 0);
      return;
    }
    await input(dx / Math.max(1, d), dy / Math.max(1, d));
    await page.waitForTimeout(100);
  }
  throw Error("movement stuck " + x + "," + y);
}
async function collect(kind, target) {
  for (let i = 0; i < 80; i++) {
    const s = await read();
    if (s.resources[kind] >= target) return;
    const es = await entities();
    const nodes = es.nodes
      .filter(
        (n) =>
          n.kind === kind &&
          !n.dead &&
          n.y < es.buildings[Math.min(s.zone, 2)].y,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y),
      );
    if (!nodes.length) {
      await page.waitForTimeout(800);
      continue;
    }
    const n = nodes[0];
    await move(n.x, n.y);
    await page.waitForTimeout(kind === "stone" ? 2000 : 1400);
  }
  throw Error("collect stuck " + kind);
}
try {
  for (let index = 0; index < 3; index++) {
    const b = (await entities()).buildings[index];
    while ((await read()).zone === index) {
      for (const r of ["wood", "stone", "food"]) {
        const s = await read(),
          cap = [500, 2000, 5000, 10000, 10000, 10000][s.levels.capacity],
          remaining = b.cost[r] - s.progress[index][r];
        if (remaining > 0)
          await collect(
            r,
            Math.min(remaining, r === "food" ? Math.floor(cap / 2) : cap),
          );
      }
      await move(450, b.y - 48);
      await page.waitForTimeout(6000);
    }
    console.log("Unlocked", index + 1, JSON.stringify(await read()));
    await page.screenshot({
      path: `screenshots/continuous-zone-${index + 1}.png`,
    });
    if (index < 2) {
      await move(690, 940 + index * 550);
      await page.waitForTimeout(4000);
      await page.getByRole("button", { name: "工房を開く" }).click();
      for (const pattern of [/背かご/, /灯刃/, /道具/]) {
        const button = page.getByRole("button", { name: pattern });
        if (await button.isEnabled()) await button.click();
      }
      await page.getByRole("button", { name: "工房を閉じる" }).click();
      await page.waitForTimeout(2000);
    }
  }
  console.log(
    "COMPLETE wall seconds",
    (Date.now() - start) / 1000,
    "state",
    JSON.stringify(await read()),
  );
} finally {
  await browser.close();
}
