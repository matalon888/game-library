import { Brush } from "./brush.js";
import { saveScroll, listScrolls, deleteScroll } from "./archive.js";
import { scrollToPdf } from "./pdf.js";
import { sanitizeSvg, playMorph, playScene } from "./inkmorph.js";
import { audio } from "./audio.js";

const $ = (id) => document.getElementById(id);

// ── persistence mode ──
// With no database configured, every keep/browse control disappears;
// the PDF keepsake remains available either way.
fetch("/api/config")
  .then((r) => r.json())
  .then((c) => document.body.classList.toggle("no-persist", !c.persistence))
  .catch(() => document.body.classList.add("no-persist"));

// ── state ──
let ws = null;
let history = [];       // [{paragraphs, recognition?, kind?, drawing?, text?}]
let scrollTitle = null;
let ended = false;
let storyStarted = false;
let pendingReveal = null;   // {idx, proceed, timer} — narration held for the morph

// ── screens / ui helpers ──
function show(screenId) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(screenId).classList.add("active");
}

function toast(msg, ms = 3200) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), ms);
}

// segmented controls (lobby config + brush tools)
function segValue(seg) {
  return seg.querySelector("button.on")?.dataset.v;
}
document.querySelectorAll(".seg[data-config]").forEach((seg) => {
  seg.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    seg.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
    btn.classList.add("on");
  });
});

function lobbyConfig() {
  return {
    length: segValue(document.querySelector('.seg[data-config="length"]')) || "classic",
    tone: segValue(document.querySelector('.seg[data-config="tone"]')) || "random",
    voice: segValue(document.querySelector('.seg[data-config="voice"]')) || "prose",
    idea: $("seed-idea").value.trim(),
  };
}

// ── sound ──
const soundBtn = $("btn-sound");
function syncSoundBtn() {
  soundBtn.classList.toggle("muted", audio.muted);
  soundBtn.setAttribute("aria-pressed", String(!audio.muted));
}
soundBtn.onclick = () => {
  audio.ensure();
  audio.setMuted(!audio.muted);
  syncSoundBtn();
};
syncSoundBtn();
// warm up the audio context on the first gesture anywhere
document.addEventListener("pointerdown", () => audio.ensure(), { once: true });

// the scroll unfurls: animation + heavy-paper sound, once per new scroll
let unrolled = false;
function unrollScroll() {
  if (unrolled) return;
  unrolled = true;
  audio.unroll();
  const stage = document.querySelector(".scroll-stage");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  stage.classList.add("unrolling");
  stage.addEventListener("animationend", function done(e) {
    if (e.target.classList.contains("scroll-paper")) {
      stage.classList.remove("unrolling");
      stage.removeEventListener("animationend", done);
      scrollDown();
    }
  });
}

// ── brush ──
const brush = new Brush($("draw-canvas"), {
  onStroke: (stroke) => send({ type: "stroke", stroke }),
  onStrokeStart: () => audio.brushStart(),
  onStrokeEnd: () => audio.brushStop(),
});

$("ink-picker").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  brush.ink = btn.dataset.ink;
  $("ink-picker").querySelectorAll("button").forEach((b) => b.classList.remove("on"));
  btn.classList.add("on");
});
$("size-picker").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  brush.size = btn.dataset.size;
  $("size-picker").querySelectorAll("button").forEach((b) => b.classList.remove("on"));
  btn.classList.add("on");
});

// ── websocket ──
function connect(onOpen) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = onOpen;
  ws.onmessage = (e) => handle(JSON.parse(e.data));
  ws.onclose = () => toast("Connection lost — refresh to rejoin.");
}

function send(msg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function handle(msg) {
  switch (msg.type) {
    case "room_joined":
      $("room-code").textContent = msg.code;
      $("player-count").textContent = msg.players;
      show("game");
      unrollScroll();
      if (!storyStarted && msg.players === 1) send({ type: "start_story" });
      break;

    case "players":
      $("player-count").textContent = msg.count;
      break;

    case "sync":
      if (msg.title) {
        storyStarted = true;
        scrollTitle = msg.title;
        $("scroll-title").textContent = msg.title;
        history = msg.history || [];
        renderHistory();
        ended = msg.ended;
        if (ended) showEnding();
        else if (msg.request) showRequest(msg.request);
      } else {
        send({ type: "start_story" });
      }
      break;

    case "thinking":
      $("thinking").classList.remove("hidden");
      lockPanels();
      break;

    case "story_started":
      storyStarted = true;
      scrollTitle = msg.title;
      $("scroll-title").textContent = msg.title;
      $("thinking").classList.add("hidden");
      history.push({ paragraphs: msg.paragraphs, scene: msg.scene || undefined });
      if (msg.scene) appendScene(history[history.length - 1], history.length - 1);
      revealParagraphs(msg.paragraphs, () => showRequest(msg.request));
      break;

    case "turn_result": {
      $("thinking").classList.add("hidden");
      // retire the old request panel while the narration unfolds
      $("brush-panel").classList.add("hidden");
      $("write-panel").classList.add("hidden");
      history.push(msg.entry);
      appendContribution(msg.entry);
      brush.clear();
      if (msg.entry.scene) appendScene(msg.entry, history.length - 1);
      const proceed = () => revealParagraphs(msg.paragraphs, () => {
        if (msg.is_ending) {
          ended = true;
          showEnding();
        } else {
          showRequest(msg.request);
        }
      });
      if (msg.entry.kind === "draw" && !msg.entry.svg) {
        // hold the narration until the spirit's art arrives and the morph plays
        flow.querySelector(`.morph-wrap[data-idx="${history.length - 1}"]`)
          ?.classList.add("awaiting");
        holdReveal(history.length - 1, proceed);
      } else {
        proceed();
      }
      break;
    }

    case "morph_svg": {
      if (history[msg.index]) history[msg.index].svg = msg.svg;
      if (msg.index !== history.length - 1) break;
      const wrap = flow.querySelector(`.morph-wrap[data-idx="${msg.index}"]`);
      wrap?.classList.remove("awaiting");
      let morphed = false;
      if (msg.svg && wrap && !wrap.querySelector("svg.morph-dst")) {
        const svg = sanitizeSvg(msg.svg);
        if (svg) {
          wrap.appendChild(svg);
          audio.scenePaint(playMorph(wrap)); // the spirit's brush is audible
          morphed = true;
        }
      }
      // release held narration: after the morph has had a moment to bloom,
      // or immediately if there is no art to show
      if (pendingReveal && pendingReveal.idx === msg.index) {
        releaseReveal(morphed ? 1600 : 0);
      }
      break;
    }

    case "scene_svg": {
      if (history[msg.index]) history[msg.index].scene_svg = msg.svg;
      if (msg.index !== history.length - 1) break;
      const fig = flow.querySelector(`.scene-figure[data-idx="${msg.index}"]`);
      if (!fig) break;
      fig.classList.remove("awaiting-scene");
      if (!msg.svg) {
        fig.remove(); // the painter's brush failed — leave no empty frame
        break;
      }
      if (!fig.querySelector("svg.scene-art")) {
        const svg = sanitizeSvg(msg.svg, {
          className: "scene-art",
          maxPaths: 24,
          defaultViewBox: "0 0 320 150",
        });
        if (svg) {
          fig.appendChild(svg);
          audio.scenePaint(playScene(svg));
        } else {
          fig.remove();
        }
      }
      break;
    }

    case "stroke":
      brush.drawStroke(msg.stroke);
      // a friend's brush whispers too
      audio.brushStart();
      clearTimeout(handle._remoteBrushT);
      handle._remoteBrushT = setTimeout(() => audio.brushStop(), 450);
      break;

    case "clear_canvas":
      brush.clear();
      break;

    case "error":
      $("thinking").classList.add("hidden");
      releaseReveal(0);
      unlockPanels();
      toast(msg.message);
      break;
  }
}

function holdReveal(idx, proceed) {
  cancelReveal();
  pendingReveal = {
    idx,
    proceed,
    timer: setTimeout(() => releaseReveal(0), 12000), // failsafe: never stall the story
  };
}

function cancelReveal() {
  if (!pendingReveal) return;
  clearTimeout(pendingReveal.timer);
  pendingReveal = null;
}

function releaseReveal(delay) {
  if (!pendingReveal) return;
  const { proceed, timer } = pendingReveal;
  clearTimeout(timer);
  pendingReveal = null;
  if (delay) setTimeout(proceed, delay);
  else proceed();
}

// ── rendering ──
const flow = $("story-flow");

function renderHistory() {
  flow.innerHTML = "";
  for (const [i, entry] of history.entries()) {
    if (entry.kind) appendContribution(entry, true);
    if (entry.scene) appendScene(entry, i, true);
    for (const p of entry.paragraphs) appendParagraph(p, true);
  }
  scrollDown(true);
}

// a wide sumi-e panorama the spirit paints for key story moments
function appendScene(entry, idx, instant = false) {
  const fig = document.createElement("figure");
  fig.className = "scene-figure";
  fig.dataset.idx = idx;
  if (entry.scene_svg) {
    const svg = sanitizeSvg(entry.scene_svg, {
      className: "scene-art",
      maxPaths: 24,
      defaultViewBox: "0 0 320 150",
    });
    if (!svg) return;
    fig.appendChild(svg);
    flow.appendChild(fig);
    const dur = playScene(svg, { instant });
    if (dur) audio.scenePaint(dur);
  } else if (!instant) {
    fig.classList.add("awaiting-scene"); // painting arrives async
    flow.appendChild(fig);
  } else {
    return; // old scene that never got painted — show nothing
  }
  scrollDown();
}

function appendParagraph(text, instant = false) {
  const p = document.createElement("p");
  p.className = "story-p";
  p.textContent = text;
  if (instant) {
    p.style.animation = "none";
    p.style.opacity = 1;
    p.style.transform = "none";
  }
  flow.appendChild(p);
  scrollDown();
}

function appendDivider() {
  const tpl = $("divider-template");
  flow.appendChild(tpl.content.cloneNode(true));
}

function appendContribution(entry, instant = false) {
  appendDivider();
  if (entry.kind === "write") {
    const div = document.createElement("div");
    div.className = "written-figure";
    div.textContent = entry.text;
    flow.appendChild(div);
  } else if (entry.drawing) {
    const fig = document.createElement("figure");
    fig.className = "drawn-figure";
    if (entry.recognition) {
      const chip = document.createElement("span");
      chip.className = "recognition-chip";
      chip.textContent = `the ink spirit sees: ${entry.recognition}`;
      fig.appendChild(chip);
    }
    const wrap = document.createElement("div");
    wrap.className = "morph-wrap";
    wrap.dataset.idx = history.indexOf(entry);
    const img = document.createElement("img");
    img.className = "morph-src";
    img.src = entry.drawing;
    img.alt = entry.recognition || "player drawing";
    wrap.appendChild(img);
    const svg = sanitizeSvg(entry.svg);
    if (svg) wrap.appendChild(svg);
    fig.appendChild(wrap);
    flow.appendChild(fig);
    const dur = playMorph(wrap, { instant });
    if (dur) audio.scenePaint(dur);
  }
  scrollDown();
}

function revealParagraphs(paragraphs, done) {
  let i = 0;
  if (paragraphs.length) audio.penStart();
  const next = () => {
    if (i >= paragraphs.length) {
      audio.penStop();
      return done?.();
    }
    appendParagraph(paragraphs[i++]);
    setTimeout(next, 1800);
  };
  next();
}

// show the right contribution panel for the current request
function showRequest(request) {
  if (!request) return;
  if (request.kind === "write") {
    $("brush-panel").classList.add("hidden");
    $("write-panel").classList.remove("hidden");
    $("write-prompt").textContent = request.prompt;
    $("write-input").value = "";
    $("btn-submit-write").disabled = false;
    $("write-input").focus();
  } else {
    $("write-panel").classList.add("hidden");
    $("brush-panel").classList.remove("hidden");
    $("drawing-prompt").textContent = request.prompt;
    $("btn-submit").disabled = false;
  }
  scrollDown();
}

function lockPanels() {
  $("btn-submit").disabled = true;
  $("btn-submit-write").disabled = true;
}
function unlockPanels() {
  $("btn-submit").disabled = false;
  $("btn-submit-write").disabled = false;
}

function scrollDown(force = false) {
  const area = $("scroll-area");
  // follow the story only while the reader is already at the unrolling edge;
  // if they scrolled up to read, never yank them back down
  const nearBottom =
    area.scrollHeight - area.scrollTop - area.clientHeight < 160;
  if (!force && !nearBottom) return;
  requestAnimationFrame(() => (area.scrollTop = area.scrollHeight));
}

function showEnding() {
  $("brush-panel").classList.add("hidden");
  $("write-panel").classList.add("hidden");
  $("ending-panel").classList.remove("hidden");
  $("btn-save-scroll").disabled = false;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function resetGame() {
  cancelReveal();
  history = [];
  scrollTitle = null;
  ended = false;
  storyStarted = false;
  flow.innerHTML = "";
  brush.clear();
  $("ending-panel").classList.add("hidden");
  $("brush-panel").classList.add("hidden");
  $("write-panel").classList.add("hidden");
  $("scroll-title").textContent = "A new scroll unrolls…";
  $("drawing-prompt").textContent = "";
  ws?.close();
  ws = null;
  unrolled = false;
  audio.penStop();
  audio.brushStop();
  audio.paintStop();
}

// ── lobby actions ──
$("btn-new-scroll").onclick = () => {
  resetGame();
  connect(() => send({ type: "create_room", config: lobbyConfig() }));
};

$("btn-join").onclick = () => {
  const code = $("join-code").value.trim().toUpperCase();
  if (code.length !== 4) return toast("Room codes are 4 letters.");
  resetGame();
  connect(() => send({ type: "join_room", code }));
};

// ── game actions ──
$("btn-clear").onclick = () => {
  brush.clear();
  send({ type: "clear_canvas" });
};

$("btn-undo").onclick = () => {
  brush.undo();
  send({ type: "clear_canvas" });
  for (const s of brush.strokes) send({ type: "stroke", stroke: s });
};

$("btn-submit").onclick = () => {
  if (brush.isEmpty()) return toast("The scroll awaits your brush…");
  lockPanels();
  send({
    type: "submit_contribution",
    contribution: { kind: "draw", image: brush.toDataURL() },
  });
};

$("btn-submit-write").onclick = submitWrite;
$("write-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitWrite();
});

function submitWrite() {
  const text = $("write-input").value.trim();
  if (!text) return toast("Write a few words first…");
  lockPanels();
  send({
    type: "submit_contribution",
    contribution: { kind: "write", text },
  });
}

// ── ending actions ──
$("btn-save-scroll").onclick = async () => {
  try {
    await saveScroll({ title: scrollTitle, history });
    toast("Scroll kept. Find it under Finished Scrolls.");
    $("btn-save-scroll").disabled = true;
  } catch {
    toast("The archive is unreachable — the scroll was not kept.");
  }
};

$("btn-download-pdf").onclick = () =>
  scrollToPdf({ title: scrollTitle, history, savedAt: Date.now() });

$("btn-back-lobby").onclick = () => {
  resetGame();
  show("lobby");
};

// ── archive ──
$("btn-archive").onclick = async () => {
  show("archive");
  await renderArchive();
};
$("btn-archive-back").onclick = () => show("lobby");

async function renderArchive() {
  const list = $("archive-list");
  let scrolls = [];
  try {
    scrolls = await listScrolls();
  } catch {
    list.innerHTML = `<p class="archive-empty">The archive is unreachable.</p>`;
    return;
  }
  if (!scrolls.length) {
    list.innerHTML = `<p class="archive-empty">No finished scrolls yet. Go make a story.</p>`;
    return;
  }
  list.innerHTML = "";
  for (const s of scrolls) {
    const firstDrawing = s.history.find((h) => h.drawing)?.drawing;
    const card = document.createElement("div");
    card.className = "archive-card";
    card.innerHTML = `
      <h3>${escapeHtml(s.title || "Untitled Scroll")}</h3>
      <span class="meta">${new Date(s.savedAt).toLocaleString()} · ${s.history.length} chapters</span>
      ${firstDrawing ? `<img src="${firstDrawing}" alt="first drawing">` : ""}
      <div class="row">
        <button class="btn" data-act="pdf">PDF</button>
        <button class="btn btn-ghost" data-act="del">Burn</button>
      </div>`;
    card.querySelector('[data-act="pdf"]').onclick = () => scrollToPdf(s);
    card.querySelector('[data-act="del"]').onclick = async () => {
      await deleteScroll(s.id);
      renderArchive();
    };
    list.appendChild(card);
  }
}
