#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

const required = [
  "index.html",
  "package.json",
  "README.md",
  "AGENTS.md",
  "src/main.js",
  "src/game.js",
  "src/hero.js",
  "src/net.js",
  "src/ui.js",
  "src/styles.css",
  "docs/architecture.md",
  "docs/game-design.md",
  "docs/multiplayer.md",
  "docs/roadmap.md",
  "docs/agent-harness.md",
];

let failed = false;
console.log("Lowpoly Roguelike MOBA Agent Harness\n");
console.log("Required files:");
for (const path of required) {
  const ok = existsSync(path);
  console.log(`${ok ? "✓" : "✗"} ${path}`);
  if (!ok) failed = true;
}

console.log("\nSource modules:");
for (const file of readdirSync("src").filter((f) => f.endsWith(".js") || f.endsWith(".css")).sort()) {
  console.log(`- src/${file}`);
}

console.log("\nContinuation docs:");
for (const file of readdirSync("docs").filter((f) => f.endsWith(".md")).sort()) {
  console.log(`- docs/${file}`);
}

console.log("\nRecommended commands:");
console.log("- npm run check");
console.log("- npm run dev");
console.log("- open http://localhost:5173");

try {
  const status = execSync("git status --short", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  console.log("\nGit status:");
  console.log(status || "clean");
} catch {
  console.log("\nGit status: not a git repository yet");
}

if (failed) {
  console.error("\nHarness failed: missing required files.");
  process.exit(1);
}

console.log("\nHarness passed.");
