/* ============================================================
   leaderboard.js — optional online leaderboard via Supabase.
   Loads the Supabase client lazily from a CDN ONLY when configured,
   so the game stays fully functional (and offline-capable) without it.
   The anon key is public; data is protected by Row-Level Security.
   ============================================================ */

// @2 = latest v2 (supports both the legacy anon JWT and the new sb_publishable_ key)
const SUPABASE_ESM = "https://esm.sh/@supabase/supabase-js@2";

let client = null;
let loading = null;

export function isConfigured() {
  const c = window.__CALDERA_CONFIG__ || {};
  return !!(c.supabaseUrl && c.supabaseAnonKey);
}

async function getClient() {
  if (!isConfigured()) return null;
  if (client) return client;
  if (!loading) {
    loading = import(SUPABASE_ESM)
      .then((m) => {
        const c = window.__CALDERA_CONFIG__;
        const baseUrl = String(c.supabaseUrl || "")
          .replace(/\/(rest|auth|storage|realtime)\/v\d+\/?$/i, "")
          .replace(/\/+$/, "");
        client = m.createClient(baseUrl, c.supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        return client;
      })
      .catch((e) => { console.warn("Supabase load failed:", e); return null; });
  }
  return loading;
}

export async function submitScore({ name, difficulty, timeMs }) {
  const c = await getClient();
  if (!c) return { ok: false, offline: true };
  const clean = (String(name || "").trim().slice(0, 20)) || "Anonymous";
  const { error } = await c.from("scores").insert({
    name: clean, difficulty, time_ms: Math.round(timeMs),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, name: clean };
}

export async function topScores(difficulty, limit = 10) {
  const c = await getClient();
  if (!c) return { ok: false, offline: true, rows: [] };
  const { data, error } = await c
    .from("scores")
    .select("name, time_ms, created_at")
    .eq("difficulty", difficulty)
    .order("time_ms", { ascending: true })
    .limit(limit);
  if (error) return { ok: false, error: error.message, rows: [] };
  return { ok: true, rows: data || [] };
}

/** 1-based rank a given time would earn (number of strictly-faster scores + 1) */
export async function rankFor(difficulty, timeMs) {
  const c = await getClient();
  if (!c) return null;
  const { count, error } = await c
    .from("scores")
    .select("*", { count: "exact", head: true })
    .eq("difficulty", difficulty)
    .lt("time_ms", Math.round(timeMs));
  if (error) return null;
  return (count ?? 0) + 1;
}
