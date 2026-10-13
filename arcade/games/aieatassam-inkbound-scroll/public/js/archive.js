// Finished-scroll archive, backed by the server's Postgres API.
// Only used when the server reports persistence: true (see /api/config);
// in no-database mode the UI that calls these functions is hidden.

async function req(url, options) {
  const r = await fetch(url, options);
  if (!r.ok) throw new Error(`archive request failed: ${r.status}`);
  return r.json();
}

export function saveScroll({ title, history }) {
  return req("/api/scrolls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title || "Untitled Scroll", history }),
  });
}

export function listScrolls() {
  return req("/api/scrolls");
}

export function deleteScroll(id) {
  return req(`/api/scrolls/${id}`, { method: "DELETE" });
}
