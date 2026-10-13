/* ============================================================
   Screens: title, settings, field manual, credits, pause.
   One at a time, built from the same tokens as the HUD.
   ============================================================ */
import { settings, set, reset, RANGES, DEFAULTS } from "./settings.js";
import { t, LANGUAGES, currentLang, setLanguage, langInfo } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const ROMAN = ["I", "II", "III", "IV", "V"];

export class Menu {
  constructor(opts) {
    this.o = opts;                       // { onStart, onContinue, onResume, onAbandon, audio, sites }
    this.screen = null;
    this.root = $("menu");
    this.panels = {
      title: $("scrTitle"), settings: $("scrSettings"),
      manual: $("scrManual"), credits: $("scrCredits"), pause: $("scrPause")
    };
    this._wire();
  }

  get open() { return this.screen !== null; }

  show(name, ctx) {
    this.screen = name;
    this.root.hidden = false;
    for (const k in this.panels) this.panels[k].hidden = k !== name;
    /* built on open, so the rows always speak the current language */
    if (name === "settings") this._buildSettings();
    if (name === "title") this._refreshTitle();
    if (name === "pause" && ctx) this._refreshPause(ctx);
    if (name === "settings") this._syncSettings();
    this.root.classList.remove("in");
    void this.root.offsetWidth;
    this.root.classList.add("in");
  }
  hide() { this.screen = null; this.root.hidden = true; }

  _click(el, fn, sound = "click") {
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.o.audio) { this.o.audio.init(); this.o.audio.ui(sound); }
      fn(e);
    });
  }

  _wire() {
    this._click($("btnContinue"), () => this.o.onContinue(), "confirm");
    this._click($("btnNew"), () => {
      const has = this.o.hasSave();
      if (!has || confirm(t("ui.confirm_new"))) this.o.onStart();
    }, "confirm");
    this._click($("btnSettings"), () => this.show("settings"));
    this._click($("btnManual"), () => this.show("manual"));
    this._click($("btnCredits"), () => this.show("credits"));
    this._click($("btnQuit"), () => window.close(), "back");

    for (const id of ["btnSettingsBack", "btnManualBack", "btnCreditsBack"])
      this._click($(id), () => this.show(this.returnTo || "title"), "back");
    this._click($("btnResetSettings"), () => { reset(); this._syncSettings(); this.o.onSettings("*"); }, "back");

    this._click($("btnResume"), () => this.o.onResume(), "confirm");
    this._click($("btnPauseSettings"), () => { this.returnTo = "pause"; this.show("settings"); });
    this._click($("btnPauseManual"), () => { this.returnTo = "pause"; this.show("manual"); });
    this._click($("btnAbandon"), () => {
      if (confirm(t("ui.confirm_leave"))) this.o.onAbandon();
    }, "back");

    if (!(window.digDesktop && window.digDesktop.isDesktop)) $("btnQuit").hidden = true;
  }

  /* ---------------- settings ---------------- */
  _buildSettings() {
    const box = $("settingsBody");
    const rows = [
      { g: t("ui.language"), lang: true },
      { g: t("set.sound") },
      { k: "master", label: t("set.master"), pct: true },
      { k: "music", label: t("set.music"), pct: true },
      { k: "sfx", label: t("set.sfx"), pct: true },
      { k: "music_on", label: t("set.music_on"), toggle: true, note: t("set.music_note") },
      { g: t("set.controls") },
      { k: "sensitivity", label: t("set.sensitivity"), fix: 1 },
      { k: "invertY", label: t("set.invertY"), toggle: true },
      { g: t("set.display") },
      { k: "fov", label: t("set.fov"), suffix: "°" },
      { k: "renderDistance", label: t("set.renderDistance"), suffix: " m" },
      { k: "headBob", label: t("set.headBob"), toggle: true },
      { k: "crackOverlay", label: t("set.crackOverlay"), toggle: true },
      { k: "showFps", label: t("set.showFps"), toggle: true }
    ];
    box.innerHTML = "";
    this.controls = {};
    for (const r of rows) {
      if (r.g) {
        const h = document.createElement("div");
        h.className = "setgroup"; h.textContent = r.g;
        box.appendChild(h);
        if (r.lang) box.appendChild(this._languageRow());
        continue;
      }
      const row = document.createElement("div");
      row.className = "setrow";
      const lab = document.createElement("label");
      lab.innerHTML = r.label + (r.note ? '<i>' + r.note + "</i>" : "");
      row.appendChild(lab);

      if (r.toggle) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "toggle";
        b.addEventListener("click", () => {
          set(r.k, !settings[r.k]);
          this._syncSettings();
          if (this.o.audio) { this.o.audio.init(); this.o.audio.ui("click"); }
          this.o.onSettings(r.k);
        });
        row.appendChild(b);
        this.controls[r.k] = { el: b, kind: "toggle" };
      } else {
        const [min, max, step] = RANGES[r.k];
        const wrap = document.createElement("div");
        wrap.className = "slider";
        const s = document.createElement("input");
        s.type = "range"; s.min = min; s.max = max; s.step = step;
        const out = document.createElement("span");
        s.addEventListener("input", () => {
          set(r.k, parseFloat(s.value));
          out.textContent = this._fmt(r, settings[r.k]);
          this.o.onSettings(r.k);
        });
        wrap.appendChild(s); wrap.appendChild(out);
        row.appendChild(wrap);
        this.controls[r.k] = { el: s, out, kind: "range", meta: r };
      }
      box.appendChild(row);
    }
  }
  /* One button per language, showing its own name in its own script. */
  _languageRow() {
    const row = document.createElement("div");
    row.className = "setrow langrow";
    const wrap = document.createElement("div");
    wrap.className = "langgrid";
    for (const L of LANGUAGES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "langbtn" + (L.code === currentLang() ? " on" : "");
      b.innerHTML = '<b>' + L.native + "</b>" +
        (L.status === "draft" ? '<i>' + t("ui.draft") + "</i>" : "");
      b.addEventListener("click", async () => {
        await setLanguage(L.code);
        set("lang", L.code);
        if (this.o.audio) { this.o.audio.init(); this.o.audio.ui("confirm"); }
        this.show("settings");
        this.o.onSettings("lang");
      });
      wrap.appendChild(b);
    }
    row.appendChild(wrap);
    return row;
  }

  _fmt(r, v) {
    if (r.pct) return Math.round(v * 100) + "%";
    if (r.fix !== undefined) return v.toFixed(r.fix);
    return Math.round(v) + (r.suffix || "");
  }
  _syncSettings() {
    for (const k in this.controls) {
      const c = this.controls[k];
      if (c.kind === "toggle") {
        c.el.setAttribute("aria-pressed", String(!!settings[k]));
        c.el.textContent = t(settings[k] ? "set.on" : "set.off");
      } else {
        c.el.value = settings[k];
        c.out.textContent = this._fmt(c.meta, settings[k]);
      }
    }
  }

  /* ---------------- title & pause ---------------- */
  _refreshTitle() {
    const save = this.o.readSave();
    const cont = $("btnContinue");
    if (save && save.chapter >= 0) {
      const s = this.o.sites[save.chapter];
      cont.hidden = false;
      $("continueLine").textContent = t("ui.season", { n: save.chapter + 1 }) + " — " +
        t("site." + s.id + ".name");
      $("btnNew").textContent = t("ui.new");
      $("btnNew").classList.remove("primary");
    } else {
      cont.hidden = true;
      $("btnNew").textContent = t("ui.newfirst");
      $("btnNew").classList.add("primary");
    }
    const r = this.o.audio && this.o.audio.ragaLabel && this.o.audio.ragaLabel();
    $("titleRaga").textContent = r || "";
  }
  _refreshPause(ctx) {
    $("pauseSite").textContent = t("ui.season", { n: ctx.chapter + 1 }) + " · " +
      t("site." + ctx.site.id + ".name");
    $("pauseClue").textContent = ctx.clue || t("ui.all_done");
    $("pauseStats").innerHTML =
      "<div><b>" + ctx.found + " / " + ctx.total + "</b><span>" + t("ui.found") + "</span></div>" +
      "<div><b>" + ctx.merit + "</b><span>" + t("ui.points") + "</span></div>" +
      "<div><b>" + ctx.stamina + "</b><span>" + t("ui.energy") + "</span></div>" +
      "<div><b>" + ctx.spoil + "</b><span>" + t("ui.spoil") + "</span></div>";
  }
}
