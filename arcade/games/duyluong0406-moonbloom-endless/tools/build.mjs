import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await mkdir(resolve(dist, "assets"), { recursive: true });
await Promise.all([
  cp(resolve(root, "index.html"), resolve(dist, "index.html")),
  cp(resolve(root, "src"), resolve(dist, "src"), { recursive: true }),
  cp(resolve(root, "assets", "runtime"), resolve(dist, "assets", "runtime"), { recursive: true }),
  cp(resolve(root, "assets", "fonts"), resolve(dist, "assets", "fonts"), { recursive: true }),
]);

console.log(`Built Moonbloom Endless to ${dist}`);
