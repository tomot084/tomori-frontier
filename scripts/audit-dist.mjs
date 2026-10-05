import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
const root = new URL("../dist/", import.meta.url).pathname;
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push(path);
  }
}
await walk(root);
for (const path of files) {
  const name = relative(root, path);
  if (!(name === "index.html" || /^assets\/[\w.-]+\.(js|css)$/.test(name)))
    throw Error(`Unexpected public artifact: ${name}`);
  const content = await readFile(path, "utf8");
  if (
    /input\/reference-images|ChatGPT 画像|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{30,}/.test(
      content,
    )
  )
    throw Error(`Local reference or credential found: ${name}`);
}
const html = await readFile(join(root, "index.html"), "utf8");
for (const match of html.matchAll(
  /(?:src|href)="\/tomori-frontier\/([^"?#]+)"/g,
))
  await stat(join(root, match[1]));
console.log(
  `dist audit passed: ${files.length} files; only index.html and built JS/CSS; no local references, source maps, or work files.`,
);
