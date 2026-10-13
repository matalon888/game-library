/* The overlay: readouts, hotbar, the field notebook that carries the
   clues, and the season report. Same type and colours as the other
   two builds so it still reads as one record system. */
import { GLYPH } from "../src/data.js";
import { t } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const ROMAN = ["I", "II", "III", "IV", "V"];
const svgGlyph = (k, size, color) =>
  '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="' + color +
  '" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="' +
  (GLYPH[k] || GLYPH.weight) + '"/></svg>';

export class HUD {
  constructor() {
    this.e = {};
    ["cross", "prompt", "toasts", "ctxBlock", "ctxLayer", "ctxDepth", "hStam", "hStamBar",
     "hMerit", "hFinds", "hSurveys", "hotbar", "objText", "objNum", "objBar",
     "loadBar", "loadPct", "loading", "fps",
     "book", "bookQuestion", "bookClues", "bookCount",
     "findcard", "fcKicker", "fcName", "fcEra", "fcNote",
     "spoilSlot", "spoilIcon", "spoilName", "spoilCount", "compass", "compassPip", "objIcon",
     "reportSecondary", "veil", "reportKicker", "reportTitle", "reportSite", "reportBody",
     "rFinds", "rMerit", "rGrade", "reportPrimary", "reportSecondary"]
      .forEach((id) => { this.e[id] = $(id); });
    this._cross = "";
    this._fcT = null;
  }

  loading(done, total) {
    const pct = Math.round((done / total) * 100);
    this.e.loadBar.style.width = pct + "%";
    this.e.loadPct.textContent = pct + "%";
  }
  loaded() { this.e.loading.hidden = true; }



  /* what the crosshair is on */
  setContext(blockName, layer, depth) {
    if (!blockName) { this.e.ctxBlock.textContent = ""; this.e.ctxLayer.textContent = ""; this.e.ctxDepth.textContent = ""; return; }
    this.e.ctxBlock.textContent = blockName;
    this.e.ctxLayer.textContent = layer >= 0 ? t("ui.layer", { n: layer + 1 }) : t("ui.above_ground");
    this.e.ctxDepth.textContent = depth > 0 ? t("ui.m_down", { n: depth }) : t("ui.surface");
  }
  /* A strip of ticks that scrolls with where you are facing, plus a gold
     pip for the open clue. Sixty degrees either side of centre. */
  compass(yaw, bearing) {
    const SPAN = 60, w = this.e.compass.clientWidth || 400;
    const facing = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    const place = (deg) => {
      let d = ((deg - facing + 540) % 360) - 180;
      if (Math.abs(d) > SPAN) return null;
      return w / 2 + (d / SPAN) * (w / 2);
    };
    this.e.compass.querySelectorAll(".tick").forEach((el) => {
      const p = place(+el.dataset.a);
      el.style.display = p === null ? "none" : "block";
      if (p !== null) el.style.left = p + "px";
    });
    const p = bearing === null || bearing === undefined ? null : place(bearing);
    this.e.compassPip.style.display = p === null ? "none" : "block";
    if (p !== null) this.e.compassPip.style.left = p + "px";
  }

  landmarkIcon(type) {
    this.e.objIcon.className = "lmicon" + (type ? " lm-" + type : "");
  }

  cross(state) {
    if (state === this._cross) return;
    this._cross = state;
    this.e.cross.className = "crosshair" + (state ? " " + state : "");
  }
  prompt(html) {
    if (!html) { this.e.prompt.hidden = true; return; }
    this.e.prompt.innerHTML = html; this.e.prompt.hidden = false;
  }

  gauges(g) {
    this.e.hStam.textContent = Math.max(0, g.stamina);
    const pct = Math.max(0, g.stamina) / g.staminaMax;
    this.e.hStamBar.style.width = pct * 100 + "%";
    this.e.hStamBar.parentElement.classList.toggle("low", pct < 0.25);
    this.e.hMerit.textContent = g.totalMerit + g.merit;
    this.e.hFinds.textContent = g.found.length + " / " + g.total;
    this.e.hSurveys.textContent = g.surveys;
    this.e.hotbar.querySelector('[data-tool="survey"]').classList.toggle("spent", g.surveys <= 0);
  }
  /* what you are holding to put back, and how much of it */
  spoil(name, count, color, total) {
    this.e.spoilName.textContent = count ? name : t("ui.spoil");
    this.e.spoilCount.textContent = count || 0;
    this.e.spoilIcon.style.background = color || "transparent";
    this.e.spoilSlot.classList.toggle("empty", !count);
    this.e.spoilSlot.title = total ? t("ui.spoil") + ": " + total : t("ui.nothing_dug");
  }

  tool(name) {
    this.e.hotbar.querySelectorAll(".slot").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.tool === name)));
  }

  /* the live objective, always on screen */
  objective(n, total, text) {
    this.e.objNum.textContent = t("ui.clue_of", { n, total });
    this.e.objText.textContent = text;
    this.e.objBar.style.width = ((n - 1) / total) * 100 + "%";
  }
  objectiveDone(total) {
    this.e.objNum.textContent = t("ui.answered", { n: total, total });
    this.e.objText.textContent = t("ui.all_done");
    this.e.objBar.style.width = "100%";
  }

  toast(html, big) {
    const t = document.createElement("div");
    t.className = "toast" + (big ? " big" : "");
    t.innerHTML = html;
    this.e.toasts.appendChild(t);
    while (this.e.toasts.children.length > 4) this.e.toasts.removeChild(this.e.toasts.firstChild);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 600); }, big ? 10000 : 6000);
  }

  showFind(f, damaged) {
    this.e.fcKicker.textContent = t(damaged ? "ui.broken" : "ui.lifted");
    this.e.fcKicker.className = "fc-k" + (damaged ? " dmg" : "");
    this.e.fcName.textContent = f.nm;
    this.e.fcEra.textContent = f.er;
    this.e.fcNote.textContent = f.no;
    this.e.findcard.hidden = false;
    clearTimeout(this._fcT);
    this._fcT = setTimeout(() => { this.e.findcard.hidden = true; }, 15000);
  }

  /* The notebook. Takes text already resolved for the current language —
     the HUD never builds a sentence itself. */
  notebook(question, items, solved, activeIdx) {
    this.e.bookQuestion.textContent = question;
    const box = this.e.bookClues;
    box.innerHTML = "";
    items.forEach((it, i) => {
      const done = solved.indexOf(i) >= 0;
      const active = !done && i === activeIdx;
      const row = document.createElement("div");
      row.className = "clue" + (done ? " done" : active ? " active" : " sealed");
      let body;
      if (done) {
        body = '<div class="ctext">' + it.text + "</div>" +
          '<div class="evidence">' + svgGlyph(it.g, 18, it.damaged ? "#A24A2A" : "#E8A93C") +
          "<div><b>" + it.nm + "</b><i>" + it.er + "</i><span>" + it.no + "</span></div></div>";
      } else if (active) {
        body = '<div class="ctext">' + it.text + "</div>" +
          '<div class="why">' + it.why + "</div>" +
          '<div class="depth">' + t("ui.expect_depth", { n: it.depth, layer: it.layer }) + "</div>";
      } else {
        body = '<div class="ctext sealedtext">' + t("ui.clue_locked_note") + "</div>";
      }
      row.innerHTML = '<div class="chead"><span class="cn">' + (i + 1) + "</span>" +
        '<span class="cs">' + t(done ? "ui.clue_answered" : active ? "ui.clue_open" : "ui.clue_locked") +
        "</span></div>" + body;
      box.appendChild(row);
    });
    this.e.bookCount.textContent = solved.length + " / " + items.length;
  }

  toggleBook(force) {
    const p = this.e.book;
    const show = force !== undefined ? force : p.hidden;
    p.hidden = !show;
    return show;
  }
  get bookOpen() { return !this.e.book.hidden; }

  report(cfg) {
    const e = this.e;
    e.reportKicker.textContent = cfg.kicker;
    e.reportTitle.textContent = cfg.title;
    e.reportSite.textContent = cfg.site;
    e.reportBody.innerHTML = cfg.body.map((p) => "<p>" + p + "</p>").join("");
    if (cfg.labels) {
      const L = this.e.veil.querySelectorAll(".scores .k");
      if (L[0]) L[0].textContent = cfg.labels.finds;
      if (L[1]) L[1].textContent = cfg.labels.points;
      if (L[2]) L[2].textContent = cfg.labels.grade;
    }
    e.rFinds.textContent = cfg.finds;
    e.rMerit.textContent = cfg.merit;
    e.rGrade.textContent = cfg.grade;
    e.reportPrimary.textContent = cfg.primary;
    e.reportSecondary.hidden = !cfg.secondary;
    e.veil.hidden = false;
  }
  hideReport() { this.e.veil.hidden = true; }
  get reportOpen() { return !this.e.veil.hidden; }
}
