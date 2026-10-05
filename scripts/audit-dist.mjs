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
  if (!(
    name === "index.html" ||
    name === "models/keeper.glb" ||
    /^assets\/[\w.-]+\.(js|css)$/.test(name)
  ))
    throw Error(`Unexpected public artifact: ${name}`);
  const bytes = await readFile(path);
  if (name === "models/keeper.glb") {
    if (
      bytes.readUInt32LE(0) !== 0x46546c67 ||
      bytes.readUInt32LE(4) !== 2 ||
      bytes.readUInt32LE(8) !== bytes.length
    )
      throw Error("Invalid approved character GLB");
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(
      bytes.subarray(20, 20 + jsonLength).toString("utf8"),
    );
    if (
      [...(gltf.buffers || []), ...(gltf.images || [])].some(
        (entry) => entry.uri,
      )
    )
      throw Error("Character must embed all geometry and textures");
    for (const clip of gltf.animations || [])
      if (!["Idle", "Run", "Punch", "PickUp", "RecieveHit"].includes(clip.name))
        throw Error(`Unexpected character animation: ${clip.name}`);
  }
  const content = bytes.toString("utf8");
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
  `dist audit passed: ${files.length} files; only index.html, built JS/CSS and approved keeper.glb; no local references, source maps, or work files.`,
);
