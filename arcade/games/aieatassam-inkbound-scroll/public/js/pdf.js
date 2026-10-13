// Emakimono-style PDF keepsake via jsPDF (UMD global).
// The PDF is drawn as the scroll itself: weathered wall, parchment column,
// walnut rods with finials, brocade bands, the story's own fonts and inks.

import { sanitizeSvg } from "./inkmorph.js";

const SUMI = [28, 26, 23];
const VERMILLION = [199, 62, 58];
const WALL = [228, 225, 216];
const PAPER_VEIL = [248, 240, 220];

// page geometry (mm)
const PAGE_W = 210, PAGE_H = 297;
const COL_X = 25, COL_W = 160;           // parchment column
const TEXT_X = COL_X + 12, TEXT_W = COL_W - 24;
const ROD_W = 190, ROD_H = 19;           // rod art is 900x90
const BROCADE_H = 6;

// ── asset helpers (all rasterized in the browser, cached per session) ──
const cache = {};

async function fetchDataUrl(url) {
  const blob = await (await fetch(url)).blob();
  return new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.readAsDataURL(blob);
  });
}

async function fetchFontB64(url) {
  const dataUrl = await fetchDataUrl(url);
  return dataUrl.split(",")[1];
}

async function registerFonts(doc) {
  if (!cache.caveat) cache.caveat = await fetchFontB64("fonts/Caveat-Medium.ttf");
  if (!cache.yomogi) cache.yomogi = await fetchFontB64("fonts/Yomogi-Regular.ttf");
  doc.addFileToVFS("Caveat-Medium.ttf", cache.caveat);
  doc.addFont("Caveat-Medium.ttf", "Caveat", "normal");
  doc.addFileToVFS("Yomogi-Regular.ttf", cache.yomogi);
  doc.addFont("Yomogi-Regular.ttf", "Yomogi", "normal");
}

function svgToPng(svgMarkup, pxW, pxH) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = pxW; c.height = pxH;
      c.getContext("2d").drawImage(img, 0, 0, pxW, pxH);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svgMarkup)));
  });
}

// The rod SVG references external wood JPGs; an <img>-loaded SVG may not
// fetch external resources, so rebuild the defs with data-URI images.
async function rodPng() {
  if (cache.rod) return cache.rod;
  const [rodTex, knobTex] = await Promise.all([
    fetchDataUrl("img/wood-rod.jpg"),
    fetchDataUrl("img/wood-knob.jpg"),
  ]);
  const defs = document.querySelector("svg defs");
  let markup = defs.innerHTML
    .replaceAll('href="img/wood-rod.jpg"', `href="${rodTex}"`)
    .replaceAll('href="img/wood-knob.jpg"', `href="${knobTex}"`);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 90">` +
    `<defs>${markup}</defs><use href="#scroll-rod-art"/></svg>`;
  cache.rod = await svgToPng(svg, 1800, 180);
  return cache.rod;
}

// brocade mounting silk strip (same diamond pattern as the CSS band)
async function brocadePng() {
  if (cache.brocade) return cache.brocade;
  const diamond =
    `<g fill="none" stroke="#b08d3e" stroke-width="1">` +
    `<path d="M14 2 L26 13 L14 24 L2 13 Z" opacity="0.55"/>` +
    `<path d="M14 7 L21 13 L14 19 L7 13 Z" opacity="0.4"/>` +
    `<circle cx="14" cy="13" r="1.6" fill="#b08d3e" stroke="none" opacity="0.6"/></g>`;
  let cells = "";
  for (let i = 0; i < 30; i++) cells += `<g transform="translate(${i * 28},0)">${diamond}</g>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 26">` +
    `<rect width="840" height="26" fill="#2b3a55"/>${cells}` +
    `<rect y="0" width="840" height="2" fill="#b08d3e" opacity="0.55"/>` +
    `<rect y="24" width="840" height="2" fill="#b08d3e" opacity="0.55"/></svg>`;
  cache.brocade = await svgToPng(svg, 1680, 52);
  return cache.brocade;
}

// square seal with a kanji, drawn with the page's own fonts via canvas
function sealPng(char, px = 220) {
  const c = document.createElement("canvas");
  c.width = px; c.height = px;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#c73e3a";
  ctx.beginPath();
  ctx.roundRect(6, 6, px - 12, px - 12, px * 0.09);
  ctx.fill();
  ctx.fillStyle = "#f5f0e6";
  ctx.font = `600 ${px * 0.55}px "Noto Serif JP", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, px / 2, px / 2 + px * 0.03);
  return c.toDataURL("image/png");
}

// player sketch: white paper becomes transparency so ink sits on parchment
function inkExtract(drawingDataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        const lum = (p[i] + p[i + 1] + p[i + 2]) / 3;
        p[i + 3] = Math.min(p[i + 3], 255 - lum);
      }
      ctx.putImageData(d, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => resolve(drawingDataUrl);
    img.src = drawingDataUrl;
  });
}

// model art (morph or scene): sanitize, make standalone, rasterize
async function artPng(svgSource, viewBox, pxW, pxH) {
  const svg = sanitizeSvg(svgSource, { defaultViewBox: viewBox, maxPaths: 26 });
  if (!svg) return null;
  for (const p of svg.querySelectorAll("path")) {
    p.setAttribute("fill", "none");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    if (!p.getAttribute("stroke")) p.setAttribute("stroke", "#1c1a17");
  }
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return svgToPng(new XMLSerializer().serializeToString(svg), pxW, pxH);
}

// ── the renderer ──
export async function scrollToPdf(scroll) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerFonts(doc);

  if (!cache.wall) cache.wall = await fetchDataUrl("img/texture-wall.jpg");
  if (!cache.paper) cache.paper = await fetchDataUrl("img/texture-paper.jpg");
  const rod = await rodPng();
  const brocade = await brocadePng();

  const veil = (rgb, alpha, x, y, w, h) => {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: alpha }));
    doc.setFillColor(...rgb);
    doc.rect(x, y, w, h, "F");
    doc.restoreGraphicsState();
  };

  const paintWall = () => {
    doc.addImage(cache.wall, "JPEG", 0, 0, PAGE_W, PAGE_H);
    veil(WALL, 0.87, 0, 0, PAGE_W, PAGE_H);
  };

  const paintParchment = () => {
    // two stacked tiles keep the grain scale believable on A4
    doc.addImage(cache.paper, "JPEG", COL_X, 0, COL_W, PAGE_H / 2);
    doc.addImage(cache.paper, "JPEG", COL_X, PAGE_H / 2, COL_W, PAGE_H / 2);
    veil(PAPER_VEIL, 0.5, COL_X, 0, COL_W, PAGE_H);
  };

  const paintPage = () => { paintWall(); paintParchment(); };

  let y = 0;
  const newPage = () => { doc.addPage(); paintPage(); y = 16; };
  const ensureRoom = (needed) => { if (y + needed > PAGE_H - 26) newPage(); };

  // ── title page: the closed scroll ──
  paintWall();
  doc.addImage(cache.paper, "JPEG", COL_X, 105, COL_W, 88);
  veil(PAPER_VEIL, 0.5, COL_X, 105, COL_W, 88);
  doc.addImage(brocade, "PNG", COL_X, 105, COL_W, BROCADE_H);
  doc.addImage(brocade, "PNG", COL_X, 193 - BROCADE_H, COL_W, BROCADE_H);
  doc.addImage(rod, "PNG", (PAGE_W - ROD_W) / 2, 96, ROD_W, ROD_H);
  doc.addImage(rod, "PNG", (PAGE_W - ROD_W) / 2, 185, ROD_W, ROD_H);
  doc.addImage(sealPng("墨"), "PNG", PAGE_W / 2 - 9, 116, 18, 18);
  doc.setTextColor(...SUMI);
  doc.setFont("Caveat", "normal");
  doc.setFontSize(32);
  doc.text(scroll.title || "An Inkbound Scroll", PAGE_W / 2, 152, { align: "center" });
  doc.setFont("Yomogi", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90, 84, 76);
  doc.text(new Date(scroll.savedAt || Date.now()).toLocaleDateString(),
    PAGE_W / 2, 165, { align: "center" });

  // ── the unrolled scroll ──
  doc.addPage();
  paintPage();
  doc.addImage(rod, "PNG", (PAGE_W - ROD_W) / 2, 4, ROD_W, ROD_H);
  doc.addImage(brocade, "PNG", COL_X, 20, COL_W, BROCADE_H);
  y = 34;

  for (const entry of scroll.history) {
    if (entry.kind === "write" && entry.text) {
      ensureRoom(16);
      doc.setFont("Caveat", "normal");
      doc.setFontSize(17);
      doc.setTextColor(...VERMILLION);
      doc.text(`“ ${entry.text} ”`, PAGE_W / 2, y + 4, { align: "center" });
      y += 14;
    }

    if (entry.drawing) {
      const imgW = 84, imgH = imgW * 0.5;
      ensureRoom(imgH + (entry.recognition ? 20 : 10));
      if (entry.recognition) {
        doc.setFont("Yomogi", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...VERMILLION);
        doc.text(`~ the ink spirit sees: ${entry.recognition} ~`,
          PAGE_W / 2, y + 2, { align: "center" });
        y += 8;
      }
      const faded = await inkExtract(entry.drawing);
      if (entry.svg) {
        // the sketch stays as a faint memory beneath the spirit's line art
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.18 }));
        doc.addImage(faded, "PNG", (PAGE_W - imgW) / 2, y, imgW, imgH);
        doc.restoreGraphicsState();
        const art = await artPng(entry.svg, "0 0 200 120", 800, 480);
        if (art) doc.addImage(art, "PNG", (PAGE_W - imgW) / 2, y, imgW, imgH);
      } else {
        doc.addImage(faded, "PNG", (PAGE_W - imgW) / 2, y, imgW, imgH);
      }
      y += imgH + 6;
    }

    if (entry.scene_svg) {
      const scW = 120, scH = scW * (150 / 320);
      ensureRoom(scH + 8);
      const art = await artPng(entry.scene_svg, "0 0 320 150", 1280, 600);
      if (art) {
        doc.addImage(art, "PNG", (PAGE_W - scW) / 2, y, scW, scH);
        y += scH + 6;
      }
    }

    doc.setFont("Caveat", "normal");
    doc.setFontSize(15);
    doc.setTextColor(...SUMI);
    for (const p of entry.paragraphs || []) {
      const lines = doc.splitTextToSize(p, TEXT_W);
      ensureRoom(lines.length * 7.4 + 5);
      doc.text(lines, TEXT_X, y);
      y += lines.length * 7.4 + 5;
    }
    y += 2;
  }

  // ── closing: hanko, brocade, bottom rod ──
  ensureRoom(52);
  doc.addImage(sealPng("終"), "PNG", PAGE_W / 2 - 10, y + 2, 20, 20);
  y += 30;
  doc.addImage(brocade, "PNG", COL_X, PAGE_H - 24, COL_W, BROCADE_H);
  doc.addImage(rod, "PNG", (PAGE_W - ROD_W) / 2, PAGE_H - 19, ROD_W, ROD_H);

  const safe = (scroll.title || "scroll").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`inkbound-${safe}.pdf`);
}
