/* Build step (run by Vercel): writes config.js from environment variables so
   the public Supabase config reaches the static client without a bundler.
   Run locally too:  SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/build-config.mjs */

import { writeFile } from "node:fs/promises";

// Accept the various names different setups use (Vercel↔Supabase integration,
// Next/Vite prefixes, new publishable keys). First non-empty match wins.
function pick(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return { name: n, value: v.trim() };
  }
  return { name: null, value: "" };
}

const url = pick(
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_PROJECT_URL",
);
const key = pick(
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_KEY",
);

// Normalize to the bare project base URL. Some env vars (and the Vercel
// integration) carry a service path like ".../rest/v1/" or ".../storage/v1";
// supabase-js wants only "https://<ref>.supabase.co".
const supabaseUrl = url.value
  .replace(/\/(rest|auth|storage|realtime)\/v\d+\/?$/i, "")
  .replace(/\/+$/, "");
const supabaseAnonKey = key.value;

const banner = "/* AUTO-GENERATED at build time by scripts/build-config.mjs — do not edit. */\n";
const body = `window.__CALDERA_CONFIG__ = ${JSON.stringify({ supabaseUrl, supabaseAnonKey }, null, 2)};\n`;

await writeFile(new URL("../config.js", import.meta.url), banner + body);

if (supabaseUrl && supabaseAnonKey) {
  console.log(`config.js written — Supabase configured from env ${url.name} + ${key.name} (${supabaseUrl})`);
} else {
  const seen = Object.keys(process.env).filter((k) => /SUPABASE|POSTGRES|STORAGE/i.test(k));
  console.log("config.js written — no usable Supabase env; leaderboard runs offline.");
  console.log("  URL found:", url.name || "none", "| KEY found:", key.name || "none");
  console.log("  Supabase-ish vars present:", seen.length ? seen.join(", ") : "(none)");
}
