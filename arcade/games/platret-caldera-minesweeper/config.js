/* Runtime config. OVERWRITTEN at build time by scripts/build-config.mjs
   from the SUPABASE_URL / SUPABASE_ANON_KEY environment variables.

   The committed values below are empty on purpose: locally (or before the
   env vars are set on Vercel) the leaderboard runs in offline mode and the
   game still works fully. The Supabase anon key is a PUBLIC client key —
   safe to ship to the browser; access is constrained by Row-Level Security. */
window.__CALDERA_CONFIG__ = {
  supabaseUrl: "",
  supabaseAnonKey: "",
};
