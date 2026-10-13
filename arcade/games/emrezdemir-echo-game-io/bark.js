// Bark: small thought-bubble lines emitted by the player character.
// Triggered probabilistically by movement, recording, death, or long idle.
// Bilingual via I18n. Rendered as a rounded bubble above the character.

const Bark = (() => {
  const PHRASES = {
    tr: {
      general: [
        "Hmm...", "Sanki?", "Bilmem.", "Acaba?", "Yine mi?",
        "Eyvah", "Olmadı.", "Niye?", "Belki...", "Düşün.",
        "Yine ben.", "Burada mıydım?", "Döngü mü?", "Zaman akıyor.",
        "Pişmanım", "Devam.", "Hadi.", "Olmaz.",
      ],
      record: [
        "Tamam.", "Bu kadar.", "Şimdi sen.", "Hatırla.",
        "Bir yankı.", "Burayı tut.",
      ],
      death: [
        "Hayır!", "Yardım!", "Aman!", "Eyvah!",
        "Yine başa.", "Olmaz!",
      ],
      idle: [
        "Bekliyorum.", "Düşünüyorum.", "Ya bu?",
        "Ya da?", "Bir saniye.",
      ],
    },
    en: {
      general: [
        "Hmm...", "Maybe?", "I don't know.", "What if?", "Again?",
        "Oops.", "Not again.", "Why?", "Perhaps...", "Think.",
        "Me again.", "Was I here?", "A loop?", "Time flows.",
        "Regret.", "Go on.", "Come on.", "No way.",
      ],
      record: [
        "Done.", "Right there.", "Now you.", "Remember.",
        "An echo.", "Hold this spot.",
      ],
      death: [
        "No!", "Help!", "Watch out!", "Damn!",
        "Back to start.", "Not like this!",
      ],
      idle: [
        "Waiting.", "Thinking.", "Or this?",
        "Or...?", "Just a moment.",
      ],
    },
  };

  let active = null;        // { text, until, fadeStart }
  let lastBarkAt = 0;
  const COOLDOWN_MS = 2500;
  const SHOW_MS = 2200;
  const FADE_MS = 400;

  function lang() {
    return (typeof I18n !== "undefined" && I18n.get) ? I18n.get() : "tr";
  }

  function pickFrom(category) {
    const dict = PHRASES[lang()] || PHRASES.tr;
    const arr = dict[category] || dict.general;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function say(text, opts) {
    opts = opts || {};
    const now = performance.now();
    active = {
      text,
      until: now + (opts.duration || SHOW_MS),
      fadeStart: now + (opts.duration || SHOW_MS) - FADE_MS,
    };
    lastBarkAt = now;
  }

  // Probabilistic trigger. Respects cooldown.
  function maybe(category, chance) {
    chance = chance != null ? chance : 0.12;
    if (performance.now() - lastBarkAt < COOLDOWN_MS) return;
    if (Math.random() > chance) return;
    say(pickFrom(category || "general"));
  }

  // Forced trigger (e.g., death). Bypasses cooldown.
  function force(category) {
    say(pickFrom(category || "general"));
  }

  function clear() {
    active = null;
  }

  function isActive() {
    if (!active) return false;
    if (performance.now() >= active.until) { active = null; return false; }
    return true;
  }

  // Draw above the character at screen position (cx, cy).
  function draw(ctx, cx, cy) {
    if (!isActive()) return;
    const now = performance.now();
    const fade = now > active.fadeStart
      ? Math.max(0, (active.until - now) / FADE_MS)
      : 1;

    ctx.save();
    ctx.font = "bold 13px ui-monospace, Menlo, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(active.text);
    const padX = 9;
    const padY = 5;
    const w = Math.ceil(metrics.width) + padX * 2;
    const h = 22;
    const bx = Math.round(cx - w / 2);
    const by = Math.round(cy - h);

    ctx.globalAlpha = fade;

    // Bubble
    roundRectPath(ctx, bx, by, w, h, 6);
    ctx.fillStyle = "rgba(18,16,36,0.94)";
    ctx.fill();
    ctx.strokeStyle = "rgba(138,125,255,0.85)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(cx - 5, by + h);
    ctx.lineTo(cx + 5, by + h);
    ctx.lineTo(cx, by + h + 5);
    ctx.closePath();
    ctx.fillStyle = "rgba(18,16,36,0.94)";
    ctx.fill();
    ctx.strokeStyle = "rgba(138,125,255,0.85)";
    ctx.stroke();

    // Text
    ctx.fillStyle = "#cfd4f0";
    ctx.fillText(active.text, cx, by + h / 2 + 1);

    ctx.restore();
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return { say, maybe, force, clear, isActive, draw };
})();
