import { defineConfig } from "vite";
export default defineConfig({
  base: "/tomori-frontier/",
  build: { chunkSizeWarningLimit: 1600 },
});
