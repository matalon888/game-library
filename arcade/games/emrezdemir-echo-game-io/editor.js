// Basit grid editörü. URL hash üzerinden paylaşılabilir.
const Editor = (() => {
  const canvas = () => document.getElementById("editorCanvas");
  const widthInput = () => document.getElementById("edWidth");
  const heightInput = () => document.getElementById("edHeight");
  const movesInput = () => document.getElementById("edMoves");
  const nameInput = () => document.getElementById("edName");
  const introInput = () => document.getElementById("edIntro");
  const toolbar = () => document.getElementById("edToolbar");
  const shareBox = () => document.getElementById("edShareBox");

  const TOOLS = [
    { key: ".", labelKey: "tool.floor" },
    { key: "#", labelKey: "tool.wall" },
    { key: "P", labelKey: "tool.start" },
    { key: "G", labelKey: "tool.goal" },
    { key: "a", labelKey: "tool.plate", suffix: " a" },
    { key: "A", labelKey: "tool.door",  suffix: " A" },
    { key: "b", labelKey: "tool.plate", suffix: " b" },
    { key: "B", labelKey: "tool.door",  suffix: " B" },
    { key: "c", labelKey: "tool.plate", suffix: " c" },
    { key: "C", labelKey: "tool.door",  suffix: " C" },
    { key: "1", labelKey: "tool.portal", suffix: " 1" },
    { key: "2", labelKey: "tool.portal", suffix: " 2" },
    { key: ">", labelKey: "tool.laser",  suffix: " →" },
    { key: "<", labelKey: "tool.laser",  suffix: " ←" },
    { key: "^", labelKey: "tool.laser",  suffix: " ↑" },
    { key: "v", labelKey: "tool.laser",  suffix: " ↓" },
    { key: "Q", labelKey: "tool.quantum" },
    { key: "B", labelKey: "tool.box" },
  ];

  let state = {
    w: 10,
    h: 8,
    moves: 16,
    name: null,   // open() sırasında I18n'den çekilir
    intro: null,
    grid: null,        // h x w array of chars
    lasers: [],        // [{x,y,plate}]
    tool: "#",
    painting: false,
  };

  function emptyGrid(w, h) {
    const g = [];
    for (let y = 0; y < h; y++) {
      let row = "";
      for (let x = 0; x < w; x++) {
        if (y === 0 || y === h - 1 || x === 0 || x === w - 1) row += "#";
        else row += ".";
      }
      g.push(row.split(""));
    }
    return g;
  }

  function ensureGridDims() {
    if (!state.grid) state.grid = emptyGrid(state.w, state.h);
    while (state.grid.length < state.h) {
      const row = new Array(state.w).fill(".");
      row[0] = "#"; row[state.w - 1] = "#";
      state.grid.push(row);
    }
    while (state.grid.length > state.h) state.grid.pop();
    state.grid.forEach((row, y) => {
      while (row.length < state.w) row.push(y === 0 || y === state.h - 1 ? "#" : (row.length === state.w - 1 ? "#" : "."));
      while (row.length > state.w) row.pop();
    });
  }

  function setCell(x, y, v) {
    if (x < 0 || y < 0 || x >= state.w || y >= state.h) return;
    // Only one P and one G allowed
    if (v === "P" || v === "G") {
      for (let yy = 0; yy < state.h; yy++)
        for (let xx = 0; xx < state.w; xx++)
          if (state.grid[yy][xx] === v) state.grid[yy][xx] = ".";
    }
    state.grid[y][x] = v;
  }

  function buildToolbar() {
    const tb = toolbar();
    tb.innerHTML = "";
    TOOLS.forEach(t => {
      const btn = document.createElement("button");
      btn.className = "tool" + (state.tool === t.key ? " active" : "");
      btn.textContent = I18n.t(t.labelKey) + (t.suffix || "");
      btn.dataset.key = t.key;
      btn.onclick = () => {
        state.tool = t.key;
        Audio.click();
        buildToolbar();
      };
      tb.appendChild(btn);
    });
  }

  function render() {
    ensureGridDims();
    const c = canvas();
    const ctx = c.getContext("2d");
    const W = c.width;
    const H = c.height;
    const cell = Math.min(W / state.w, H / state.h);
    const ox = (W - cell * state.w) / 2;
    const oy = (H - cell * state.h) / 2;
    ctx.fillStyle = "#07080d";
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const c0 = state.grid[y][x];
        const cx = ox + x * cell;
        const cy = oy + y * cell;
        ctx.fillStyle = "#0d1020";
        ctx.fillRect(cx, cy, cell, cell);
        ctx.strokeStyle = "#1a1f3a";
        ctx.strokeRect(cx + 0.5, cy + 0.5, cell - 1, cell - 1);
        if (c0 === "#") {
          ctx.fillStyle = "#2a2f55";
          ctx.fillRect(cx, cy, cell, cell);
        } else if (c0 !== ".") {
          ctx.fillStyle = "#c9d6ff";
          ctx.font = `${Math.floor(cell * 0.6)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          let txt = c0;
          if (c0 === "P") { ctx.fillStyle = "#5ad7ff"; txt = "◆"; }
          else if (c0 === "G") { ctx.fillStyle = "#ffd97d"; txt = "✦"; }
          else if (c0 >= "a" && c0 <= "z") { ctx.fillStyle = "#8a7dff"; }
          else if (c0 >= "A" && c0 <= "Z") { ctx.fillStyle = "#c9b6ff"; }
          else if (c0 >= "1" && c0 <= "9") { ctx.fillStyle = "#7dffb6"; }
          else if (c0 === "Q") { ctx.fillStyle = "#7a5dff"; }
          else if (c0 === "B") { ctx.fillStyle = "#c9a85a"; txt = "☐"; }
          else if ("<>^v".includes(c0)) { ctx.fillStyle = "#ff7da8"; }
          ctx.fillText(txt, cx + cell / 2, cy + cell / 2 + 1);
        }
      }
    }
  }

  function cellAt(evt) {
    const c = canvas();
    const r = c.getBoundingClientRect();
    const cx = (evt.clientX - r.left) * (c.width / r.width);
    const cy = (evt.clientY - r.top) * (c.height / r.height);
    const cell = Math.min(c.width / state.w, c.height / state.h);
    const ox = (c.width - cell * state.w) / 2;
    const oy = (c.height - cell * state.h) / 2;
    const x = Math.floor((cx - ox) / cell);
    const y = Math.floor((cy - oy) / cell);
    return { x, y };
  }

  function bind() {
    const c = canvas();
    c.oncontextmenu = e => e.preventDefault();
    c.onmousedown = (e) => {
      const { x, y } = cellAt(e);
      const v = e.button === 2 ? "." : state.tool;
      setCell(x, y, v);
      state.painting = true;
      state._paintVal = v;
      Audio.click();
      render();
    };
    c.onmousemove = (e) => {
      if (!state.painting) return;
      const { x, y } = cellAt(e);
      setCell(x, y, state._paintVal);
      render();
    };
    window.addEventListener("mouseup", () => state.painting = false);

    widthInput().oninput = (e) => {
      state.w = clamp(parseInt(e.target.value) || 6, 4, 24);
      ensureGridDims(); render();
    };
    heightInput().oninput = (e) => {
      state.h = clamp(parseInt(e.target.value) || 6, 4, 18);
      ensureGridDims(); render();
    };
    movesInput().oninput = (e) => {
      state.moves = clamp(parseInt(e.target.value) || 10, 1, 99);
    };
    nameInput().oninput = (e) => state.name = (e.target.value || I18n.t("ed.customLabel")).slice(0, 32);
    introInput().oninput = (e) => state.intro = (e.target.value || "").slice(0, 200);

    document.getElementById("edClear").onclick = () => {
      state.grid = emptyGrid(state.w, state.h);
      Audio.click();
      render();
    };
    document.getElementById("edTest").onclick = () => {
      const lvl = exportLevel();
      Audio.click();
      Game.playCustom(lvl);
    };
    document.getElementById("edShare").onclick = () => {
      const code = encodeLevel(exportLevel());
      // Build the share URL from the current document URL so any sub-path
      // (e.g. /time-echo/) is preserved without depending on pathname tails.
      const base = (location.href.split("#")[0]).split("?")[0];
      const url = base + "#l=" + code;
      shareBox().value = url;
      shareBox().select();
      try { document.execCommand("copy"); } catch (e) {}
      Audio.record();
      flashStatus(I18n.t("ed.linkCopied"));
    };
    document.getElementById("edSave").onclick = () => saveToGallery();
    document.getElementById("edGalleryBtn").onclick = () => {
      Audio.click();
      showGallery();
    };
    document.getElementById("edBack").onclick = () => {
      Audio.click();
      Screens.show("title");
    };
  }

  function flashStatus(t) {
    const el = document.getElementById("edStatus");
    el.textContent = t;
    setTimeout(() => { el.textContent = ""; }, 2000);
  }

  // ---------- Kullanıcı seviye galerisi (localStorage) ----------
  const GAL_KEY = "timeEcho.gallery.v1";
  function galLoad() {
    try { return JSON.parse(localStorage.getItem(GAL_KEY)) || []; }
    catch (e) { return []; }
  }
  function galSave(list) {
    try { localStorage.setItem(GAL_KEY, JSON.stringify(list)); }
    catch (e) {}
  }
  function saveToGallery() {
    const lvl = exportLevel();
    const list = galLoad();
    list.push({ name: lvl.name, ts: Date.now(), data: encodeLevel(lvl) });
    galSave(list);
    Audio.record();
    flashStatus(I18n.t("ed.saved"));
  }
  function showGallery() {
    const list = galLoad();
    const wrap = document.getElementById("edGallery");
    wrap.innerHTML = "";
    if (list.length === 0) {
      wrap.textContent = I18n.t("ed.galEmpty");
      return;
    }
    list.forEach((entry, idx) => {
      const row = document.createElement("div");
      row.className = "gal-row";
      const label = document.createElement("span");
      label.className = "gal-name";
      label.textContent = entry.name || `#${idx + 1}`;
      const loadBtn = document.createElement("button");
      loadBtn.textContent = I18n.t("ed.galLoad");
      loadBtn.className = "back";
      loadBtn.onclick = () => {
        const lvl = decodeLevel(entry.data);
        if (!lvl) return;
        state.name = lvl.name || I18n.t("ed.defaultName");
        state.intro = lvl.intro || "";
        state.moves = lvl.moves || 16;
        state.grid = lvl.grid.map(r => r.split(""));
        state.w = state.grid[0].length;
        state.h = state.grid.length;
        state.lasers = lvl.lasers || [];
        widthInput().value = state.w;
        heightInput().value = state.h;
        movesInput().value = state.moves;
        nameInput().value = state.name;
        introInput().value = state.intro;
        Audio.click();
        render();
      };
      const delBtn = document.createElement("button");
      delBtn.textContent = I18n.t("ed.galDel");
      delBtn.className = "back";
      delBtn.style.borderColor = "var(--warn)";
      delBtn.style.color = "var(--warn)";
      delBtn.onclick = () => {
        list.splice(idx, 1);
        galSave(list);
        Audio.undo();
        flashStatus(I18n.t("ed.deleted"));
        showGallery();
      };
      row.appendChild(label);
      row.appendChild(loadBtn);
      row.appendChild(delBtn);
      wrap.appendChild(row);
    });
  }

  function exportLevel() {
    return {
      name: state.name,
      intro: state.intro,
      moves: state.moves,
      grid: state.grid.map(r => r.join("")),
      lasers: state.lasers,
      __custom: true,
    };
  }

  function encodeLevel(lvl) {
    const json = JSON.stringify({
      n: lvl.name, i: lvl.intro, m: lvl.moves, g: lvl.grid, l: lvl.lasers || [],
    });
    return btoa(unescape(encodeURIComponent(json))).replace(/=+$/, "");
  }

  function decodeLevel(code) {
    try {
      const padded = code + "=".repeat((4 - code.length % 4) % 4);
      const json = decodeURIComponent(escape(atob(padded)));
      const o = JSON.parse(json);
      return {
        name: o.n || I18n.t("ed.shared"),
        intro: o.i || "",
        moves: o.m || 16,
        grid: o.g,
        lasers: o.l || [],
        __custom: true,
      };
    } catch (e) {
      return null;
    }
  }

  function open() {
    if (!state.name)  state.name  = I18n.t("ed.defaultName");
    if (!state.intro) state.intro = I18n.t("ed.defaultIntro");
    state.grid = emptyGrid(state.w, state.h);
    widthInput().value = state.w;
    heightInput().value = state.h;
    movesInput().value = state.moves;
    nameInput().value = state.name;
    introInput().value = state.intro;
    shareBox().value = "";
    buildToolbar();
    bind();
    render();
  }

  // Dil değişince toolbar etiketlerini yenile
  document.addEventListener("i18n:changed", () => {
    if (document.getElementById("screenEditor").classList.contains("active")) buildToolbar();
  });

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  return { open, render, decodeLevel, encodeLevel };
})();
