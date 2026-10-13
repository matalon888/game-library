#!/usr/bin/env node
/* Checks the language files against English:
   - every key present
   - no leftover English in a translated file
   - nothing so long it will burst a button
   - reading level of the English itself                       */
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "lang");
const LANGS = ["en", "hi", "bn", "te", "mr", "ta"];
const LONG = { "ui.": 42, "tool.": 22, "station.": 26, "set.": 34, "report.": 34, "grade.": 18 };

const en = JSON.parse(fs.readFileSync(path.join(DIR, "en.json"), "utf8"));
const enKeys = Object.keys(en).filter((k) => !k.startsWith("_"));
let bad = 0;

/* reading level of the source language */
const sents = [];
for (const k of enKeys)
  for (const s of String(en[k]).replace(/[!?]/g, ".").split("."))
    if (s.trim().split(/\s+/).length > 2) sents.push(s.trim().split(/\s+/).length);
const mean = sents.reduce((a, b) => a + b, 0) / sents.length;
const max = Math.max(...sents);
console.log("english".padEnd(9) + enKeys.length + " keys, " + sents.length +
            " sentences, mean " + mean.toFixed(1) + " words, longest " + max);
if (mean > 14) { console.log("  FAIL mean sentence over 14 words"); bad++; }
if (max > 20) { console.log("  FAIL a sentence runs to %d words", max); bad++; }

/* Button overflow. Only labels that actually sit in a control are
   budgeted — help text, notes and report bodies are meant to be long. */
const isLabel = (k) => !/\.help$|_note$|^report\.fail|^station\.use|tagline|confirm_|loading_note|_hint$/.test(k);
for (const k of enKeys) {
  if (!isLabel(k)) continue;
  const cap = Object.entries(LONG).find(([p]) => k.startsWith(p));
  if (cap && String(en[k]).length > cap[1]) {
    console.log("  long  " + k + " (" + String(en[k]).length + " chars, budget " + cap[1] + ")");
    bad++;
  }
}

/* the other languages */
for (const code of LANGS.slice(1)) {
  const file = path.join(DIR, code + ".json");
  if (!fs.existsSync(file)) { console.log(code.padEnd(9) + "not written yet"); continue; }
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const missing = enKeys.filter((k) => d[k] === undefined);
  const same = enKeys.filter((k) => d[k] !== undefined && d[k] === en[k] && String(en[k]).length > 12);
  console.log(code.padEnd(9) + Object.keys(d).length + " keys, " + missing.length +
              " missing, " + same.length + " still in English, status " + d["_meta.status"]);
  if (missing.length) { console.log("   e.g. missing: " + missing.slice(0, 3).join(", ")); bad++; }
}

/* slots must survive translation */
for (const code of LANGS) {
  const file = path.join(DIR, code + ".json");
  if (!fs.existsSync(file)) continue;
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const k of enKeys) {
    if (d[k] === undefined) continue;
    const a = (String(en[k]).match(/\{\w+\}/g) || []).sort().join(",");
    const b = (String(d[k]).match(/\{\w+\}/g) || []).sort().join(",");
    if (a !== b) {
      console.log("  SLOT  " + code + "/" + k + " expected " + (a || "none") + " got " + (b || "none"));
      bad++;
    }
  }
}
console.log(bad ? "\n" + bad + " problem(s)" : "\nall good");
process.exit(bad ? 1 : 0);
