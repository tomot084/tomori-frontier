// Run the browser suite against the built assets, with a server owned by this process.
import { preview } from "vite";
import { spawn } from "node:child_process";
const server = await preview({
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
});
try {
  const child = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        GAME_URL: "http://127.0.0.1:4173/tomori-frontier/",
      },
    },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await server.close();
}
