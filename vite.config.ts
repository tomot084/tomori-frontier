import { defineConfig } from "vite";
export default defineConfig({
  base: "/tomori-frontier/",
  server: {
    watch: {
      ignored: ["**/input/**", "**/screenshots/**", "**/test-results/**"],
    },
  },
  build: { chunkSizeWarningLimit: 1600 },
});
