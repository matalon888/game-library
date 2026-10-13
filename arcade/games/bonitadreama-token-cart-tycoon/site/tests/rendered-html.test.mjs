import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://token-cart.example/", {
      headers: {
        accept: "text/html",
        host: "token-cart.example",
        "x-forwarded-host": "token-cart.example",
        "x-forwarded-proto": "https",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Token Cart game host and social metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.ok((response.headers.get("content-type") ?? "").startsWith("text/html"));

  const html = await response.text();
  assert.match(html, /<title>Token Cart Tycoon<\/title>/i);
  assert.match(html, /src="\/game\/index\.html"/i);
  assert.match(html, /title="Play Token Cart Tycoon"/i);
  assert.match(html, /https:\/\/token-cart\.example\/og\.png/i);
  assert.match(html, /href="\/favicon\.svg"/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("packages the complete dependency-free browser game", async () => {
  const gameRoot = new URL("../public/game/", import.meta.url);
  await Promise.all([
    access(new URL("index.html", gameRoot)),
    access(new URL("css/styles.css", gameRoot)),
    access(new URL("css/styles-v2.css", gameRoot)),
    access(new URL("js/actions.js", gameRoot)),
    access(new URL("js/app.js", gameRoot)),
    access(new URL("js/events.js", gameRoot)),
    access(new URL("js/game.js", gameRoot)),
    access(new URL("js/ui.js", gameRoot)),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  const index = await readFile(new URL("index.html", gameRoot), "utf8");
  assert.match(index, /<title>Token Cart Tycoon<\/title>/i);
  assert.match(index, /type="module" src="js\/app\.js"/i);
  assert.doesNotMatch(index, /<script[^>]+src=["']https?:\/\//i);
});
