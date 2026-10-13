// Sanitize LLM-generated SVG line art and morph a player drawing into it.
// Security: the model's SVG is untrusted markup — we never inject it raw.
// We parse it and rebuild a fresh <svg> keeping ONLY <path d="..."> geometry.

const VIEWBOX_RE = /^[\d\s.+-]+$/;
const PATH_D_RE = /^[MmLlHhVvCcSsQqTtAaZz\d\s,.eE+-]+$/;

// some models return a JSON structure instead of markup — convert it first
function jsonToMarkup(src) {
  try {
    const o = JSON.parse(src);
    const els = o.elements || o.paths || [];
    const paths = els
      .filter((e) => (e.tag === "path" || e.d) && e.d)
      .map((e) => `<path d="${String(e.d)}" stroke-width="${e["stroke-width"] || 3}"/>`)
      .join("");
    if (!paths) return null;
    return `<svg viewBox="${o.viewBox || "0 0 200 120"}">${paths}</svg>`;
  } catch {
    return null;
  }
}

export function sanitizeSvg(src, {
  className = "morph-dst",
  maxPaths = 26,
  defaultViewBox = "0 0 200 120",
} = {}) {
  if (!src || typeof src !== "string") return null;
  src = src.trim();
  if (src.startsWith("{")) {
    src = jsonToMarkup(src);
    if (!src) return null;
  }
  let doc;
  try {
    doc = new DOMParser().parseFromString(src, "image/svg+xml");
  } catch {
    return null;
  }
  const srcSvg = doc.querySelector("svg");
  if (!srcSvg || doc.querySelector("parsererror")) return null;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const vb = srcSvg.getAttribute("viewBox");
  svg.setAttribute("viewBox", vb && VIEWBOX_RE.test(vb) ? vb : defaultViewBox);
  svg.setAttribute("class", className);

  const SAFE_STROKES = new Set(["#1c1a17", "#c73e3a"]);
  let kept = 0;
  for (const p of srcSvg.querySelectorAll("path")) {
    const d = p.getAttribute("d");
    if (!d || !PATH_D_RE.test(d) || d.length > 4000) continue;
    const np = document.createElementNS("http://www.w3.org/2000/svg", "path");
    np.setAttribute("d", d);
    const sw = parseFloat(p.getAttribute("stroke-width"));
    const width = Number.isFinite(sw) ? Math.min(Math.max(sw, 1.5), 7) : 3.5;
    np.setAttribute("stroke-width", width);
    const stroke = (p.getAttribute("stroke") || "").toLowerCase().trim();
    if (SAFE_STROKES.has(stroke)) np.setAttribute("stroke", stroke);
    // ink dilution: pale washes and half-tones survive sanitizing
    const so = parseFloat(p.getAttribute("stroke-opacity"));
    if (Number.isFinite(so) && so < 1) {
      np.setAttribute("stroke-opacity", Math.min(Math.max(so, 0.15), 1));
    }
    // brushstroke order: paths sharing a group paint together
    const grp = parseInt(p.getAttribute("data-group"), 10);
    if (Number.isFinite(grp) && grp >= 0 && grp <= 60) np.dataset.group = grp;
    // bold strokes get a soft bleed halo underneath — a loaded brush
    if (width >= 3.5) {
      const halo = np.cloneNode();
      halo.setAttribute("class", "ink-halo");
      halo.setAttribute("stroke-width", Math.min(width * 1.9, 10));
      halo.setAttribute("stroke-opacity", "0.12");
      svg.appendChild(halo);
    }
    svg.appendChild(np);
    if (++kept >= maxPaths) break;
  }
  if (!kept) console.warn("inkmorph: model svg had no usable paths");
  return kept ? svg : null;
}

// Order paths into brushstroke groups: the model's data-group when present,
// otherwise consecutive pairs. A halo always paints with its stroke.
function strokeGroups(paths) {
  const groups = new Map();
  let fallback = 0;
  for (const p of paths) {
    let key = p.dataset.group;
    if (key === undefined) {
      if (p.classList.contains("ink-halo")) key = `f${Math.floor(fallback / 2)}`;
      else key = `f${Math.floor(fallback++ / 2)}`;
    } else {
      key = `g${key}`;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return [...groups.values()];
}

function prepareDash(paths) {
  paths.forEach((p) => {
    const len = p.getTotalLength ? p.getTotalLength() : 300;
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
  });
}

// Reveal brushstroke groups one gesture at a time; returns total duration.
function paintByGroups(paths, { lead = 300, draw = 950, gap = 480 } = {}) {
  const groups = strokeGroups(paths);
  groups.forEach((group, gi) => {
    group.forEach((p, i) => {
      const jitter = i * 70; // strokes of one gesture land a breath apart
      p.style.transition =
        `stroke-dashoffset ${draw}ms cubic-bezier(0.65,0,0.35,1) ${lead + gi * gap + jitter}ms`;
      p.style.strokeDashoffset = 0;
    });
  });
  return lead + groups.length * gap + draw;
}

// Animate a scene panorama: strokes paint themselves in layer order, then
// the painting stays subtly alive (vermillion breath, drifting air — css).
export function playScene(svg, { instant = false } = {}) {
  const paths = [...svg.querySelectorAll("path")];
  if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    svg.classList.add("scene-alive");
    return 0;
  }
  const opts = { lead: 300, draw: 1050, gap: 600 };
  const total = opts.lead + strokeGroups(paths).length * opts.gap + opts.draw;
  prepareDash(paths);
  requestAnimationFrame(() => {
    paintByGroups(paths, opts);
    setTimeout(() => svg.classList.add("scene-alive"), total);
  });
  return total;
}

// Animate: player drawing dissolves while the spirit's line art draws itself.
export function playMorph(wrap, { instant = false } = {}) {
  const img = wrap.querySelector(".morph-src");
  const svg = wrap.querySelector(".morph-dst");
  if (!svg) return 0;
  const paths = [...svg.querySelectorAll("path")];

  if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    wrap.classList.add("morphed");
    return 0;
  }

  const opts = { lead: 400, draw: 850, gap: 520 };
  const total = opts.lead + strokeGroups(paths).length * opts.gap + opts.draw;
  prepareDash(paths);
  requestAnimationFrame(() => {
    wrap.classList.add("morphing");           // img starts dissolving (css)
    paintByGroups(paths, opts);
    setTimeout(() => wrap.classList.add("morphed"), total);
    if (img) img.style.transitionDuration = `${Math.min(total, 2600)}ms`;
  });
  return total;
}
