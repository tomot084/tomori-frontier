import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 360000,
  workers: 1,
  use: {
    baseURL: process.env.GAME_URL || "http://localhost:5173/tomori-frontier/",
    headless: true,
  },
  webServer: process.env.GAME_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:5173/tomori-frontier/",
        reuseExistingServer: true,
      },
});
