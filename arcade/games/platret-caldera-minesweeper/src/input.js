/* ============================================================
   input.js — one delegated pointer + keyboard layer on the board.
     left-click / tap      → reveal      (flag, if flag-mode on)
     right-click           → flag
     long-press (touch)    → flag
     double-click / tap    → chord
     middle-click          → chord
     arrows/WASD + Space/F/C/R → keyboard play
   ============================================================ */

import { isRevealed } from "./board.js";

const LONG_PRESS_MS = 380;
const MOVE_CANCEL_PX = 12;

export class Input {
  constructor(boardEl, renderer, handlers, settings) {
    this.board = boardEl;
    this.renderer = renderer;
    this.h = handlers;          // { reveal, flag, chord, restart }
    this.settings = settings;   // live settings object

    this._suppressClick = false;
    this._lpTimer = 0;
    this._lpRaf = 0;
    this._startX = 0;
    this._startY = 0;
    this._pressedCell = null;
    this._hoverIndex = -1; // cell currently under the mouse (for hover key actions)

    this._bind();
  }

  _idxFrom(e) {
    const el = e.target.closest && e.target.closest(".cell");
    if (!el || !this.board.contains(el)) return -1;
    return Number(el.dataset.index);
  }

  _bind() {
    const b = this.board;
    b.addEventListener("contextmenu", (e) => {
      const i = this._idxFrom(e);
      if (i < 0) return;
      e.preventDefault();
      this.h.flag(i);
    });

    b.addEventListener("click", (e) => {
      const i = this._idxFrom(e);
      if (i < 0) return;
      if (this._suppressClick) { this._suppressClick = false; return; }
      if (this.settings.flagMode) this.h.flag(i);
      else this.h.reveal(i);
      this.renderer.setCursor(i, false, false); // track position, no outline for mouse
    });

    b.addEventListener("dblclick", (e) => {
      const i = this._idxFrom(e);
      if (i < 0) return;
      e.preventDefault();
      this.h.chord(i);
    });

    b.addEventListener("auxclick", (e) => {
      if (e.button !== 1) return; // middle
      const i = this._idxFrom(e);
      if (i < 0) return;
      e.preventDefault();
      this.h.chord(i);
    });

    b.addEventListener("pointerdown", (e) => this._onDown(e));
    b.addEventListener("pointermove", (e) => this._onMove(e));
    b.addEventListener("pointerup", (e) => this._onUp(e));
    b.addEventListener("pointercancel", () => { this._cancelPress(); this._clearPeek(); });
    b.addEventListener("pointerleave", () => { this._clearPeek(); this._hoverIndex = -1; });

    // track the hovered cell so keyboard actions (F/C/Space) target it
    b.addEventListener("pointerover", (e) => {
      const i = this._idxFrom(e);
      if (i >= 0) this._hoverIndex = i;
    });

    // keys are handled on window so they work during mouse play (the board
    // isn't focused after a click). Guarded against dialogs / form fields.
    window.addEventListener("keydown", (e) => this._onKey(e));
  }

  _onDown(e) {
    const i = this._idxFrom(e);
    if (i < 0) return;
    const cell = this.renderer.cells[i];

    // chord-peek when pressing a revealed number
    if (isRevealed(this.renderer.engine.state, i) && this.renderer.engine.adjacency[i] > 0) {
      this._showPeek(i);
    }

    if (e.pointerType === "touch" || e.pointerType === "pen") {
      this._startX = e.clientX; this._startY = e.clientY;
      this._pressedCell = cell;
      const start = nowMs();
      cell.classList.add("pressing");
      const tick = () => {
        const p = Math.min(1, (nowMs() - start) / LONG_PRESS_MS);
        cell.style.setProperty("--press", p.toFixed(3));
        if (p < 1 && this._pressedCell === cell) this._lpRaf = requestAnimationFrame(tick);
      };
      this._lpRaf = requestAnimationFrame(tick);
      this._lpTimer = setTimeout(() => {
        this._cancelPressVisual();
        this.h.flag(i);
        this._suppressClick = true; // swallow the trailing tap
        haptic(this.settings);
      }, LONG_PRESS_MS);
    }
  }

  _onMove(e) {
    if (!this._lpTimer) return;
    if (Math.abs(e.clientX - this._startX) > MOVE_CANCEL_PX ||
        Math.abs(e.clientY - this._startY) > MOVE_CANCEL_PX) {
      this._cancelPress();
    }
  }

  _onUp() {
    this._cancelPress();
    this._clearPeek();
  }

  _cancelPress() {
    if (this._lpTimer) { clearTimeout(this._lpTimer); this._lpTimer = 0; }
    this._cancelPressVisual();
  }

  _cancelPressVisual() {
    if (this._lpRaf) { cancelAnimationFrame(this._lpRaf); this._lpRaf = 0; }
    if (this._pressedCell) {
      this._pressedCell.classList.remove("pressing");
      this._pressedCell.style.removeProperty("--press");
      this._pressedCell = null;
    }
  }

  _showPeek(i) {
    this._clearPeek();
    const eng = this.renderer.engine;
    this._peek = [];
    for (const n of eng.neighbors(i)) {
      const c = this.renderer.cells[n];
      if (c && c.dataset.state === "hidden") { c.classList.add("chord-peek"); this._peek.push(c); }
    }
  }

  _clearPeek() {
    if (this._peek) { this._peek.forEach((c) => c.classList.remove("chord-peek")); this._peek = null; }
  }

  _onKey(e) {
    // never hijack typing in form fields or while a dialog is open
    const ae = document.activeElement;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "SELECT" || ae.tagName === "TEXTAREA")) return;
    if (document.querySelector("dialog[open]")) return;
    const eng = this.renderer.engine;
    if (!eng) return;
    const k = e.key.toLowerCase();

    if (k === "r") { e.preventDefault(); this.h.restart(); return; }
    if (k === "u") { e.preventDefault(); this.h.undo && this.h.undo(); return; }
    if (k === "+" || k === "=") { e.preventDefault(); this.h.zoomIn && this.h.zoomIn(); return; }
    if (k === "-" || k === "_") { e.preventDefault(); this.h.zoomOut && this.h.zoomOut(); return; }

    // don't steal Space/Enter from a focused control that isn't a cell
    const onCell = !!(ae && ae.classList && ae.classList.contains("cell"));
    if ((k === " " || k === "enter") && ae && ae !== document.body && !onCell &&
        (ae.tagName === "BUTTON" || ae.tagName === "A")) return;

    const w = eng.width, h = eng.height;
    // keyboard cursor wins while a cell is focused; otherwise act on the
    // hovered cell (mouse play), falling back to the last cursor position.
    let target = onCell ? this.renderer.cursor
      : (this._hoverIndex >= 0 ? this._hoverIndex : this.renderer.cursor);
    if (target < 0) target = 0;
    let x = target % w, y = (target / w) | 0;

    switch (k) {
      case "arrowleft": case "a": x = Math.max(0, x - 1); break;
      case "arrowright": case "d": x = Math.min(w - 1, x + 1); break;
      case "arrowup": case "w": y = Math.max(0, y - 1); break;
      case "arrowdown": case "s": y = Math.min(h - 1, y + 1); break;
      case "enter": case " ": e.preventDefault(); this.h.reveal(target); return;
      case "f": e.preventDefault(); this.h.flag(target); return;
      case "c": e.preventDefault(); this.h.chord(target); return;
      case "1": case "2": case "3": case "4":
      case "5": case "6": case "7": case "8":
        e.preventDefault(); this.h.note && this.h.note(target, Number(k)); return;
      default: return;
    }
    e.preventDefault();
    this.renderer.setCursor(y * w + x, true, true);
  }
}

function nowMs() { return (performance && performance.now) ? performance.now() : Date.now(); }
function haptic(settings) {
  if (settings.haptics && navigator.vibrate) { try { navigator.vibrate(18); } catch {} }
}
