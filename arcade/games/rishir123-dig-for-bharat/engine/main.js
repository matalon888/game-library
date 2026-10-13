/* ============================================================
   DIG FOR BHARAT — Minecraft-style excavation
   ============================================================ */
import * as THREE from "three";
import { SITES, EPILOGUE } from "../src/data.js";
import { World, Mesher, WX, WZ, WY, SEA, CHUNKS_X, CHUNKS_Z, STRATA_THICK } from "./world.js";
import { B, BLOCKS, nameOf, hardnessOf, buildCrackTexture } from "./blocks.js";
import { TERRAIN, QUESTS, bearingTo } from "./quests.js";
import { Player } from "./player.js";
import { HUD } from "./hud.js";
import { buildFind } from "../src3d/artifacts.js";
import { ViewModel } from "../src3d/viewmodel.js";
import { settings, onChange as onSetting, save as saveSettings } from "./settings.js";
import { Audio, SITE_RAGA } from "./audio.js";
import { Menu } from "./menu.js";
import { initI18n, setLanguage, t, LANGUAGES, onLanguageChange, applyStatic } from "./i18n.js";

const STAMINA_MAX = 170, SURVEYS = 4, REACH = 5.2;
const MERIT_KEY = 45, MERIT_FIND = 22, MERIT_DMG = 9;
/* dig is a speed multiplier, not a per-click power: break time is
   hardness * BREAK_BASE / dig, so holding the button takes a real
   and predictable amount of time per block. */
const BREAK_BASE = 0.55;
const TOOLS = {
  trowel: { cost: 1, dig: 1.0,  swing: 0.26 },
  shovel: { cost: 1, dig: 1.9,  swing: 0.30, maxHard: 2, yield: 2 },
  pick:   { cost: 2, dig: 3.2,  swing: 0.34, shatter: 0.30 },
  brush:  { cost: 0, dig: 0.35, swing: 0.30, lift: true },
  dental: { cost: 0, dig: 0.20, swing: 0.36, lift: true, care: 9 },
  survey: { cost: 12, dig: 0,   swing: 0.60 }
};
const ORDER = ["trowel", "shovel", "pick", "brush", "dental", "survey"];
const KEYS = { Digit1: "trowel", Digit2: "shovel", Digit3: "pick",
               Digit4: "brush", Digit5: "dental", Digit6: "survey" };

/* the stations that stand around the datum peg */
const STATIONS = [
  { kind: "sieve",   cost: 8,  dx: 5,  dz: 1 },
  { kind: "float",   cost: 12, dx: -5, dz: 1 },
  { kind: "bench",   cost: 0,  dx: 5,  dz: -4 },
  { kind: "station", cost: 0,  dx: -5, dz: -4 }
];
const SIEVE_MERIT = 3, FLOAT_MERIT = 6;

const audio = new Audio(settings);

/* Every player-facing word comes from lang/<code>.json. These three
   build the key from the site you are on, so the data files hold
   structure and the language files hold language. */
const S_ = (k, p) => t("site." + G.site.id + "." + k, p);
const F_ = (i, k) => t("find." + G.site.id + "." + (i + 1) + "." + k);
const Q_ = (k, p) => t("quest." + G.site.id + "." + k, p);
const dirOf = (b) => t(b.dirKey);
const SAVE_KEY = "dig-for-bharat/mc/v1";
const ROMAN = ["I", "II", "III", "IV", "V"];
const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

const G = {
  chapter: 0, site: null, quest: null, stamina: STAMINA_MAX, merit: 0, totalMerit: 0, completed: 0,
  found: [], solved: [], keystone: false, tool: "trowel", surveys: SURVEYS,
  seasonOver: false, staminaMax: STAMINA_MAX, total: 6,
  spoilSel: 0, sieved: 0, floated: 0
};

/* every block you take out goes somewhere — you can put it back */
const spoil = new Map();
const spoilAdd = (id) => spoil.set(id, (spoil.get(id) || 0) + 1);
const spoilTake = (id) => { const n = spoil.get(id) || 0; if (n <= 0) return false; spoil.set(id, n - 1); return true; };
const spoilTotal = () => { let n = 0; for (const v of spoil.values()) n += v; return n; };
function spoilKinds() { return [...spoil.entries()].filter(([, n]) => n > 0).map(([id]) => id); }
function selectedSpoil() {
  const k = spoilKinds();
  if (!k.length) return 0;
  return k[Math.min(G.spoilSel, k.length - 1)];
}

/* ---------------- renderer ---------------- */
const canvas = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.08, 400);
const hud = new HUD();
const viewmodel = new ViewModel();

/* sky dome; the only shader in the build, so it carries the two
   chunks a ShaderMaterial needs to land in the right colour space */
let skyMat;
function makeSky() {
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x4f88cc) }, bottom: { value: new THREE.Color(0xe8d3a8) },
                sun: { value: new THREE.Vector3(-0.5, 0.6, 0.62).normalize() } },
    vertexShader: "varying vec3 vD; void main(){ vD = normalize(position);" +
      " gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `
      uniform vec3 top; uniform vec3 bottom; uniform vec3 sun; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD);
        float h = clamp(d.y*1.25 + 0.04, 0.0, 1.0);
        vec3 c = mix(bottom, top, pow(h, 0.6));
        float s = max(dot(d, normalize(sun)), 0.0);
        c += vec3(1.0,0.88,0.66) * (pow(s, 8.0)*0.16 + pow(s, 300.0)*4.5);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 20), skyMat);
  sky.frustumCulled = false;
  return sky;
}
scene.add(makeSky());

/* lights matter only for the finds and the tool in hand — the
   terrain carries its own shading */
const sun = new THREE.DirectionalLight(0xffe9c8, 2.2);
sun.position.set(-40, 60, 50);
scene.add(sun, new THREE.AmbientLight(0xbfd0e4, 1.1));

const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); envScene.add(makeSky());
const envMap = pmrem.fromScene(envScene, 0.02).texture;
pmrem.dispose();
scene.environment = envMap;
scene.environmentIntensity = 0.7;
viewmodel.setEnvironment(envMap);

/* The site is 128 m square. Beyond its rim this plane carries the
   ground on to the horizon, at exactly the height the rim was eased
   to, so the edge of the world is not a cliff. */
const farGround = new THREE.Mesh(
  new THREE.PlaneGeometry(1400, 1400),
  new THREE.MeshBasicMaterial({ color: 0x8e8a58, fog: true })
);
farGround.rotation.x = -Math.PI / 2;
scene.add(farGround);

/* selection outline + break damage */
const sel = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005)),
  new THREE.LineBasicMaterial({ color: 0x0d0a07, transparent: true, opacity: 0.55 })
);
sel.visible = false; scene.add(sel);
/* the destroy-stage overlay: a hair-larger cube wearing the crack
   strip, with the frame chosen by texture offset */
const crackTex = buildCrackTexture();
const crackMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1.006, 1.006, 1.006),
  new THREE.MeshBasicMaterial({
    map: crackTex.texture, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3
  })
);
crackMesh.visible = false; scene.add(crackMesh);
function showCrack(x, y, z, progress) {
  const f = Math.min(crackTex.frames - 1, Math.floor(progress * crackTex.frames));
  crackTex.texture.offset.x = f / crackTex.frames;
  crackMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  crackMesh.visible = true;
}

/* debris */
const DEB = 320;
const debGeo = new THREE.BufferGeometry();
debGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(DEB * 3), 3));
debGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(DEB * 3), 3));
for (let i = 0; i < DEB; i++) debGeo.attributes.position.array[i * 3 + 1] = -999;
const debris = new THREE.Points(debGeo, new THREE.PointsMaterial({
  size: 0.14, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false
}));
debris.frustumCulled = false; scene.add(debris);
const debVel = new Float32Array(DEB * 3), debLife = new Float32Array(DEB);
let debHead = 0;
const SOIL_TINT = { };
function blockTint(id) {
  if (!SOIL_TINT[id]) {
    const t = { 1: 0x8a8f52, 2: 0x866a4a, 3: 0x928a76, 4: 0x9e7656, 5: 0x847a6c, 6: 0xceb88a,
                7: 0x7c766c, 12: 0xa2543a, 13: 0x544e4a, 15: 0xb08e64, 16: 0x2c2826,
                17: 0xa44a2c, 18: 0xbab0a0, 19: 0x464242, 21: 0x9e5434, 23: 0x9e8e82,
                25: 0x624e3a, 27: 0xa06c52 }[id] || 0x8a7050;
    SOIL_TINT[id] = new THREE.Color(t);
  }
  return SOIL_TINT[id];
}
function spew(x, y, z, id, n) {
  const c = blockTint(id);
  for (let i = 0; i < n; i++) {
    const k = debHead = (debHead + 1) % DEB;
    const p = debGeo.attributes.position.array, col = debGeo.attributes.color.array;
    p[k * 3] = x + 0.5 + (Math.random() - 0.5) * 0.9;
    p[k * 3 + 1] = y + 0.5 + (Math.random() - 0.5) * 0.9;
    p[k * 3 + 2] = z + 0.5 + (Math.random() - 0.5) * 0.9;
    debVel[k * 3] = (Math.random() - 0.5) * 4;
    debVel[k * 3 + 1] = 2 + Math.random() * 4.5;
    debVel[k * 3 + 2] = (Math.random() - 0.5) * 4;
    debLife[k] = 0.6 + Math.random() * 0.6;
    const j = 0.8 + Math.random() * 0.45;
    col[k * 3] = c.r * j; col[k * 3 + 1] = c.g * j; col[k * 3 + 2] = c.b * j;
  }
  debGeo.attributes.color.needsUpdate = true;
}
function stepDebris(dt) {
  const p = debGeo.attributes.position.array;
  for (let i = 0; i < DEB; i++) {
    if (debLife[i] <= 0) continue;
    debLife[i] -= dt;
    debVel[i * 3 + 1] -= 20 * dt;
    p[i * 3] += debVel[i * 3] * dt;
    p[i * 3 + 1] += debVel[i * 3 + 1] * dt;
    p[i * 3 + 2] += debVel[i * 3 + 2] * dt;
    if (debLife[i] <= 0) p[i * 3 + 1] = -999;
  }
  debGeo.attributes.position.needsUpdate = true;
}

/* ---------------- state ---------------- */
let world, mesher, player;
const findObjs = new Map();               // find index -> { group, light, lifted }
const flying = [];
let digging = false, target = null;
let mining = null;                        // the block currently under the tool

function key(x, y, z) { return x + "," + y + "," + z; }
/* what a block sounds like under a tool */
const matOf = (id) => (BLOCKS[id] && BLOCKS[id].mat) || "soil";

/* ---------------- season setup ---------------- */
async function openSite(i) {
  G.chapter = i; G.site = SITES[i]; G.quest = QUESTS[G.site.id];
  G.stamina = STAMINA_MAX; G.merit = 0; G.found = []; G.solved = [];
  G.keystone = false; G.surveys = SURVEYS; G.seasonOver = false; G.tool = "trowel";
  G.total = G.site.finds.length;
  spoil.clear(); G.spoilSel = 0; G.sieved = 0; G.floated = 0;

  for (const [, o] of findObjs) { scene.remove(o.group); if (o.light) scene.remove(o.light); }
  findObjs.clear(); flying.length = 0;

  hud.e.loading.hidden = false;
  hud.loading(0, 1);
  await frameBreak();

  if (mesher) { scene.remove(mesher.group); }
  const cfg = TERRAIN[G.site.id];
  world = new World(G.site, cfg, i * 131 + 7);
  world.generate();

  /* a datum peg at the centre of the mound — somewhere to walk back to —
     with the scrub cleared around it so you do not spawn inside a bush */
  const cx = WX / 2, cz = WZ / 2, ch = world.heightAt(cx, cz);
  for (let dz = -4; dz <= 4; dz++)
    for (let dx = -4; dx <= 4; dx++) {
      const h2 = world.heightAt(cx + dx, cz + dz);
      for (let dy = 1; dy <= 6; dy++) {
        const b = world.get(cx + dx, h2 + dy, cz + dz);
        if (b === B.SCRUB || b === B.LEAVES || b === B.LOG) world.set(cx + dx, h2 + dy, cz + dz, B.AIR);
      }
    }
  for (let dy = 1; dy <= 3; dy++) world.set(cx, ch + dy, cz, B.MUDBRICK);
  world.set(cx, ch + 4, cz, B.BRICK);

  /* the stations. Spoil is not waste, it is the stuff you trowelled past,
     and each of these is a different way of asking it a question. */
  world.stations = [];
  for (const spec of STATIONS) {
    const bx = cx + spec.dx, bz = cz + spec.dz, by = world.heightAt(bx, bz);
    buildStation(spec.kind, bx, by, bz);
    world.stations.push({ ...spec, x: bx + 0.5, y: by + 1, z: bz + 0.5 });
  }
  world._recomputeHeights();

  mesher = new Mesher(world);
  scene.add(mesher.group);
  const total = CHUNKS_X * CHUNKS_Z;
  for (let c = 0; c < total; c++) {
    mesher.buildChunk(c);
    if (c % 6 === 0) { hud.loading(c, total); await frameBreak(); }
  }
  hud.loading(total, total);

  skyMat.uniforms.top.value.setHex(cfg.sky.top);
  skyMat.uniforms.bottom.value.setHex(cfg.sky.bottom);
  scene.fog = new THREE.Fog(cfg.sky.fog, 24, 82);
  farGround.material.color.setHex(cfg.far);
  farGround.position.set(WX / 2, cfg.base + 1, WZ / 2);

  if (!player) {
    player = new Player(camera, canvas, world);
    player.onFootstep = (id) => audio.step(matOf(id));
    player.onLockChange = (locked) => {
      if (locked) {
        hud.toggleBook(false);
        if (menu.open) menu.hide();
        audio.init();
        applySettings();
        if (settings.music_on && !audio.music.on && G.site) audio.startMusic(SITE_RAGA[G.site.id]);
      } else if (!hud.reportOpen && !hud.bookOpen && G.site && !menu.open) {
        menu.show("pause", pauseContext());
      }
    };
  } else player.world = world;
  player.spawnOn(cx + 2, cz + 2);
  player.yaw = Math.PI * 0.25; player.pitch = -0.12;
  player.flying = false;

  world.setView("now");
  showCityLabels(false);
  document.body.classList.remove("thenview");
  viewmodel.setTool("trowel");
  hud.tool("trowel");
  hud.gauges(G);
  refreshSpoil();
  refreshObjective();
  renderNotebook();
  applySettings();
  if (audio.ready && settings.music_on) audio.startMusic(SITE_RAGA[G.site.id]);
  hud.loaded();
  hud.toast(t("toast.season_open", { name: S_("name") }), true);
}
/* yield between chunks so the progress bar paints. A macrotask rather
   than an animation frame, because a frame callback is not guaranteed
   to fire in every context this has to load in. */
function buildStation(kind, x, y, z) {
  const set = (dx, dy, dz, id) => world.set(x + dx, y + dy, z + dz, id);
  if (kind === "sieve") {
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      set(dx, 1, dz, B.LOG); set(dx, 2, dz, B.GRAVEL);
    }
  } else if (kind === "float") {                     /* a brick tank of water */
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        set(dx, 1, dz, (Math.abs(dx) === 1 || Math.abs(dz) === 1) ? B.BRICK : B.WATER);
        if (Math.abs(dx) === 1 || Math.abs(dz) === 1) set(dx, 2, dz, B.BRICK);
      }
    set(0, 2, 0, B.WATER);
  } else if (kind === "bench") {                     /* a plastered work top */
    for (let dx = -1; dx <= 1; dx++) {
      set(dx, 1, 0, B.LOG);
      set(dx, 2, 0, B.PLASTER);
      set(dx, 2, 1, B.PLASTER);
    }
    set(-1, 1, 1, B.LOG); set(1, 1, 1, B.LOG);
  } else if (kind === "station") {                   /* an instrument on a tripod */
    set(0, 1, 0, B.LOG); set(0, 2, 0, B.LOG); set(0, 3, 0, B.LOG);
    set(0, 4, 0, B.PLASTER);
    set(1, 1, 0, B.LOG); set(-1, 1, 0, B.LOG); set(0, 1, 1, B.LOG);
  }
}

const frameBreak = () => new Promise((r) => setTimeout(r, 0));

function activeClue() {
  for (let i = 0; i < G.total; i++) if (G.solved.indexOf(i) < 0) return i;
  return -1;
}
function renderNotebook() {
  const items = G.site.finds.map((f, i) => ({
    text: Q_("clue." + (i + 1) + ".text"),
    why: Q_("clue." + (i + 1) + ".why"),
    nm: F_(i, "nm"), er: F_(i, "er"), no: F_(i, "no"),
    g: f.g, damaged: f.damaged,
    depth: f.dig ? f.dig.depth : 0, layer: f.dig ? f.dig.layer + 1 : 1
  }));
  hud.notebook(Q_("question"), items, G.solved, activeClue());
}

function refreshObjective() {
  const a = activeClue();
  if (a < 0) { hud.objectiveDone(G.total); hud.landmarkIcon(null); markBeacon(null); return; }
  hud.objective(a + 1, G.total, Q_("clue." + (a + 1) + ".text"));
  hud.landmarkIcon(world && world.landmarks[a] ? world.landmarks[a].type : null);
  markBeacon(G.site.finds[a]);
}

/* A soft column of light over the open clue, seen through the ground.
   It fades out as you get close, so it points you at the place without
   telling you where in it to dig. */
function markBeacon(f) {
  if (!f || !f.dig) { beacon.visible = false; return; }
  beacon.position.set(f.dig.x + 0.5, f.dig.y + 20, f.dig.z + 0.5);
  beacon.visible = true;
  beaconUntil = 0;                      // 0 means permanent
}

/* ---------------- digging ---------------- */
const fwd = new THREE.Vector3();
function updateTarget() {
  camera.getWorldDirection(fwd);
  target = world.raycast(camera.position, fwd, REACH);

  const lift = nearestLiftable();
  if (lift !== null) {
    hud.cross("find");
    hud.prompt('<kbd>E</kbd> Lift it — or click with the brush');
    sel.visible = false; crackMesh.visible = false;
    return;
  }
  if (target) {
    const layer = world.layerAt(target.x, target.y, target.z);
    hud.setContext(nameOf(target.id), layer, world.depthAt(target.x, target.y, target.z));
    hud.cross(BLOCKS[target.id].unbreakable ? "far" : "reach");
    hud.prompt(null);
    sel.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
    sel.visible = !G.seasonOver;
  } else {
    hud.setContext(null); hud.cross(""); hud.prompt(null);
    sel.visible = false;
  }
  /* deep, on the floor, and the walls are above your head */
  if (player && player.grounded && !G.seasonOver) {
    const drop = world.surfaceAt(Math.floor(player.pos.x), Math.floor(player.pos.z)) + 1 - player.pos.y;
    if (drop > 2.4) {
      if (!G._deepHint || performance.now() - G._deepHint > 20000) {
        G._deepHint = performance.now();
        hud.toast(t("toast.deep"));
      }
    }
  }

  const st = nearestStation();
  if (st && !G.seasonOver) {
    const sname = t("station." + st.kind);
    hud.prompt(st.cost ? t("station.use_cost", { name: sname, cost: st.cost, have: spoilTotal() })
                       : t("station.use", { name: sname }));
  }
}

function nearestLiftable() {
  let best = null, bestD = 3.6;
  for (const [i, o] of findObjs) {
    if (o.lifted) continue;
    const d = camera.position.distanceTo(o.group.position);
    if (d > bestD) continue;
    /* standing on top of it in a cramped shaft counts as looking at it */
    if (d > 1.9) {
      const to = o.group.position.clone().sub(camera.position).normalize();
      if (to.dot(fwd) < 0.88) continue;
    }
    best = i; bestD = d;
  }
  return best;
}

/* Click actions: the brush lifts, the magnetometer sweeps. Neither
   is a mining action, so both stay one-shot. */
function clickUse() {
  if (G.seasonOver || hud.bookOpen || hud.reportOpen) return;
  if (TOOLS[G.tool].lift) {
    const l = nearestLiftable();
    audio.dig("soil", G.tool); viewmodel.swing(0.5);
    if (l !== null) liftFind(l, false);
    return;
  }
  if (G.tool === "survey") runSurvey();
}

const breakTime = (id, tool) => (hardnessOf(id) * BREAK_BASE) / TOOLS[tool].dig;

function cancelMining() {
  mining = null;
  crackMesh.visible = false;
}

/* Hold the button and the block breaks over a real span of time,
   showing how far along it is. Letting go, or looking away, starts
   the next block from scratch — the same rule the original uses. */
function updateMining(dt) {
  if (!digging || G.seasonOver || hud.bookOpen || hud.reportOpen) return cancelMining();
  const tool = G.tool, T = TOOLS[tool];
  if (world.view === "then") {
    if (!G._thenWarn || performance.now() - G._thenWarn > 4000) {
      G._thenWarn = performance.now();
      hud.toast(t("toast.no_dig_then"));
    }
    return cancelMining();
  }
  if (T.lift || tool === "survey") return cancelMining();
  if (!target || BLOCKS[target.id].unbreakable) return cancelMining();
  /* the shovel moves loose material and nothing else */
  if (T.maxHard && hardnessOf(target.id) > T.maxHard) {
    if (!G._warn || performance.now() - G._warn > 3500) {
      G._warn = performance.now();
      hud.toast(t("toast.wrong_tool", { name: nameOf(target.id) }));
    }
    return cancelMining();
  }

  const k = key(target.x, target.y, target.z);
  if (!mining || mining.key !== k) {
    mining = { key: k, x: target.x, y: target.y, z: target.z, id: target.id,
               progress: 0, total: breakTime(target.id, tool), swing: 0 };
  }
  if (G.stamina < TOOLS[tool].cost) { cancelMining(); endSeason(G.keystone); return; }

  mining.progress += dt / mining.total;
  mining.swing -= dt;
  if (mining.swing <= 0) {
    mining.swing = TOOLS[tool].swing;
    viewmodel.swing(tool === "pick" ? 0.95 : 0.75);
    tool === "pick" ? audio.dig(matOf(mining ? mining.id : 0), "pick") : audio.dig(matOf(mining ? mining.id : 0), G.tool);
    spew(mining.x, mining.y, mining.z, mining.id, 4);
  }

  if (mining.progress >= 1) {
    G.stamina -= TOOLS[tool].cost;
    const id = world.breakBlock(mining.x, mining.y, mining.z);
    if (id !== null) {
      for (let n = 0; n < (TOOLS[tool].yield || 1); n++) spoilAdd(id);
      audio.breakBlock(matOf(id));
      spew(mining.x, mining.y, mining.z, id, tool === "pick" ? 20 : 12);
      checkFinds(mining.x, mining.y, mining.z);
    }
    mesher.flushDirty();
    cancelMining();
    hud.gauges(G);
    refreshSpoil();
    if (G.stamina < TOOLS.trowel.cost) endSeason(G.keystone);
  } else showCrack(mining.x, mining.y, mining.z, mining.progress);
}

/* Backfilling. A trench gets filled in at the end of a season; this
   is also how you build a step out of a hole you cut too deep. */
function placeBlock() {
  if (G.seasonOver || hud.bookOpen || hud.reportOpen) return "busy";
  if (world.view === "then") return "city";
  if (!target) return "nothing in reach";
  const id = selectedSpoil();
  if (!id) { hud.toast(t("toast.no_spoil")); return "no spoil"; }
  const px = target.x + target.n[0], py = target.y + target.n[1], pz = target.z + target.n[2];
  if (world.get(px, py, pz) !== B.AIR) return "occupied";
  if (playerIn(px, py, pz)) return "you are standing there";
  if (!spoilTake(id)) return "no spoil";
  world.set(px, py, pz, id);
  world.height[pz * WX + px] = Math.max(world.height[pz * WX + px], py);
  world._touch(px, pz);
  mesher.flushDirty();
  viewmodel.swing(0.5); audio.dig(matOf(mining ? mining.id : 0), G.tool);
  refreshSpoil();
  return "placed";
}
/* Refuse to place a block inside the player — except directly under
   their feet while they are off the ground. That is how you build a
   step out of a shaft you cut too deep, and it is the one move that
   stops a nine-metre sondage being a trap. */
function playerIn(bx, by, bz) {
  const p = player.pos, hw = 0.31;
  const overlapsXZ = bx + 1 > p.x - hw && bx < p.x + hw && bz + 1 > p.z - hw && bz < p.z + hw;
  if (!overlapsXZ) return false;
  if (p.y >= by + 0.98) return false;                 // airborne above it: pillar up
  return by + 1 > p.y && by < p.y + 1.8;
}
function refreshSpoil() {
  const kinds = spoilKinds();
  if (G.spoilSel >= kinds.length) G.spoilSel = 0;
  const id = selectedSpoil();
  hud.spoil(id ? nameOf(id) : "Spoil", id ? (spoil.get(id) || 0) : 0,
            id ? "#" + blockTint(id).getHexString() : null, spoilTotal());
}


/* a sight line the total station leaves over the open clue */
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(0.35, 0.35, 40, 10, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x5cc7a6, transparent: true, opacity: 0.22,
                                depthWrite: false, side: THREE.DoubleSide })
);
beacon.visible = false; scene.add(beacon);
let beaconUntil = 0;

function nearestStation() {
  if (!world || !world.stations || !player) return null;
  let best = null, bd = 3.6;
  for (const st of world.stations) {
    const d = Math.hypot(player.pos.x - st.x, player.pos.z - st.z);
    if (d < bd && Math.abs(player.pos.y - st.y) < 4) { best = st; bd = d; }
  }
  return best;
}

function takeSpoil(n) {
  let left = n;
  for (const id of spoilKinds()) {
    while (left > 0 && spoilTake(id)) left--;
    if (!left) break;
  }
  return left === 0;
}

function useStation() {
  if (G.seasonOver) return;
  const st = nearestStation();
  if (!st) { hud.toast(t("toast.station_far")); return; }
  if (st.cost && spoilTotal() < st.cost) {
    hud.toast(t("toast.station_need", { name: t("station." + st.kind), cost: st.cost, have: spoilTotal() }));
    return;
  }

  if (st.kind === "sieve") {
    takeSpoil(st.cost); G.sieved++; G.merit += SIEVE_MERIT;
    audio.machine("sieve");
    hud.toast(t("toast.sieve", { thing: t("sieve." + (1 + Math.floor(Math.random() * 8))) }), true);
    hintFromProcessing(0.30);
  } else if (st.kind === "float") {
    takeSpoil(st.cost); G.floated++; G.merit += FLOAT_MERIT;
    audio.machine("float");
    hud.toast(t("toast.float", { thing: t("float." + (1 + Math.floor(Math.random() * 6))) }), true);
    hintFromProcessing(0.45);
  } else if (st.kind === "bench") {
    const idx = G.found.find((i) => G.site.finds[i].damaged);
    if (idx === undefined) { hud.toast(t("toast.bench_none")); return; }
    const f = G.site.finds[idx];
    f.damaged = false;
    G.merit += (f.key ? MERIT_KEY : MERIT_FIND) - MERIT_DMG;
    audio.machine("bench");
    hud.toast(t("toast.bench", { name: F_(idx, "nm") }), true);
    renderNotebook();
  } else if (st.kind === "station") {
    const a = activeClue();
    if (a < 0) { hud.toast(t("toast.nothing_left")); return; }
    const f = G.site.finds[a];
    markBeacon(f);
    beacon.material.opacity = 0.4;
    audio.machine("station");
    const b = bearingTo(player.pos.x, player.pos.z, f.dig.x + 0.5, f.dig.z + 0.5);
    hud.toast(t("toast.station", { dir: dirOf(b), dist: Math.round(b.dist), depth: f.dig.depth }), true);
  }
  hud.gauges(G);
  refreshSpoil();
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function hintFromProcessing(chance) {
  const a = activeClue();
  if (a < 0 || Math.random() > chance) return;
  const f = G.site.finds[a];
  const b = bearingTo(player.pos.x, player.pos.z, f.dig.x + 0.5, f.dig.z + 0.5);
  hud.toast(t("toast.hint", { dir: dirOf(b), dist: Math.round(b.dist), depth: f.dig.depth }), true);
}

/* A find comes up if you break anything close to where it lies — two
   blocks either side, one spit above or below. The right place AND the
   right depth, but not to the centimetre. */
function checkFinds(x, y, z) {
  G.site.finds.forEach((f, i) => {
    if (!f.dig || findObjs.has(i) || G.found.indexOf(i) >= 0) return;
    const d = f.dig;
    /* Three blocks either side horizontally, one spit above or below.
       Loose on where, strict on how deep — the depth is the lesson. */
    if (Math.abs(d.x - x) <= 3 && Math.abs(d.z - z) <= 3 && Math.abs(d.y - y) <= 1) {
      exposeFind(i, x, y, z);
      const sh = TOOLS[G.tool] && TOOLS[G.tool].shatter;
      if (f.fragile && sh && Math.random() < sh) liftFind(i, true);
    } else if (Math.abs(d.x - x) <= 5 && Math.abs(d.z - z) <= 5 && Math.abs(d.y - y) <= 2) {
      if (!f.warned) {
        f.warned = true;
        hud.toast(t("toast.close"));
      }
    }
  });
}

function exposeFind(i, x, y, z) {
  const f = G.site.finds[i];
  const g = buildFind(f.g);
  g.scale.setScalar(1.9);
  g.position.set(x + 0.5, y + 0.06, z + 0.5);
  g.rotation.y = Math.random() * 6.28;
  scene.add(g);
  const light = new THREE.PointLight(0xffcb78, 6, 6, 2);
  light.position.set(x + 0.5, y + 0.9, z + 0.5);
  scene.add(light);
  findObjs.set(i, { group: g, light, lifted: false, t: 0 });
  audio.ping();
  hud.toast(t("toast.something", { layer: f.dig.layer + 1 }), true);
}

function liftFind(i, damaged) {
  const o = findObjs.get(i);
  if (!o || o.lifted) return;
  const f = G.site.finds[i];
  o.lifted = true; f.damaged = damaged;
  G.found.push(i);
  if (G.solved.indexOf(i) < 0) G.solved.push(i);

  const care = (!damaged && TOOLS[G.tool] && TOOLS[G.tool].care) ? TOOLS[G.tool].care : 0;
  G.merit += damaged ? MERIT_DMG : (f.key ? MERIT_KEY : MERIT_FIND) + care;

  const nm = F_(i, "nm"), er = F_(i, "er");
  if (damaged) {
    audio.damage();
    hud.toast(t("toast.broke", { name: nm }), true);
  } else {
    audio.find(); audio.discovery();
    hud.toast(care ? t("toast.lifted_care", { name: nm, era: er, bonus: care })
                   : t("toast.lifted", { name: nm, era: er }), true);
  }
  if (f.key) {
    G.keystone = true;
    hud.toast(S_("keynote"), true);
    setTimeout(() => hud.toast(Q_("answer"), true), 1200);
  }
  flying.push({ o, t: 0, from: o.group.position.clone() });

  hud.showFind({ nm, er, no: F_(i, "no") }, damaged);
  G.solved.sort((a, b) => a - b);
  refreshObjective();
  renderNotebook();
  hud.gauges(G);
}

function runSurvey() {
  if (G.surveys <= 0 || G.stamina < TOOLS.survey.cost) {
    hud.toast(t("toast.finder_none"));
    return;
  }
  G.surveys--; G.stamina -= TOOLS.survey.cost;
  audio.ping(); viewmodel.swing(0.4);
  const a = activeClue();
  if (a < 0) { hud.toast(t("toast.nothing_left")); hud.gauges(G); return; }
  const f = G.site.finds[a];
  const b = bearingTo(player.pos.x, player.pos.z, f.dig.x + 0.5, f.dig.z + 0.5);
  const lm = world.landmarks[a];
  if (b.dist < 4)
    hud.toast(t("toast.finder_here", { depth: f.dig.depth }), true);
  else
    hud.toast(t("toast.finder", { dir: dirOf(b), dist: Math.round(b.dist), landmark: lm.label }), true);
  hud.gauges(G);
}

/* ---------------- then and now ----------------
   The same ground, twice: the city as it stood, and what is left of
   it under the soil. You dig up a drain, then flip and see the street
   it served. */
function toggleView() {
  if (!world || !world.thenBlocks || G.seasonOver) return;
  const to = world.view === "now" ? "then" : "now";
  world.setView(to);
  mesher.flushDirty();
  cancelMining();
  /* stand the player on whatever the new world has under them */
  const h = world.heightAt(Math.floor(player.pos.x), Math.floor(player.pos.z));
  if (player.pos.y < h + 1) { player.pos.y = h + 1.2; player.prev.copy(player.pos); player.vy = 0; }
  showCityLabels(to === "then");
  audio.machine("station");
  hud.toast(t(to === "then" ? "toast.then" : "toast.now"), true);
  document.body.classList.toggle("thenview", to === "then");
}

/* names floating over the buildings, only in the city */
const cityLabelGroup = new THREE.Group();
scene.add(cityLabelGroup);
function showCityLabels(on) {
  cityLabelGroup.clear();
  if (!on || !world.cityLabels) return;
  for (const L of world.cityLabels) {
    const cv = document.createElement("canvas");
    cv.width = 512; cv.height = 128;
    const c = cv.getContext("2d");
    c.fillStyle = "rgba(20,13,6,.82)"; c.fillRect(0, 0, 512, 128);
    c.strokeStyle = "#e8a93c"; c.lineWidth = 8; c.strokeRect(4, 4, 504, 120);
    c.fillStyle = "#f6e9cd";
    c.font = "700 58px 'Baloo 2', system-ui, sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(t(L.key), 256, 68);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.position.set(L.x + 0.5, L.y + 2.5, L.z + 0.5);
    sp.scale.set(9, 2.25, 1);
    sp.renderOrder = 998;
    cityLabelGroup.add(sp);
  }
}

/* ---------------- season flow ---------------- */
const grade = (m) => m >= 140 ? "grade.best" : m >= 112 ? "grade.good" : m >= 70 ? "grade.ok" : "grade.low";
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ chapter: G.chapter, totalMerit: G.totalMerit, completed: G.completed })); } catch (e) {}
}
let reportMode = "next";
function endSeason(success) {
  if (G.seasonOver) return;
  G.seasonOver = true;
  document.exitPointerLock();
  const st = G.site, last = G.chapter === SITES.length - 1;
  const nextIdx = Math.min(G.chapter + 1, SITES.length - 1);
  if (success) { G.totalMerit += G.merit; G.completed = Math.max(G.completed, G.chapter + 1); save(); }
  const nextName = t("site." + SITES[nextIdx].id + ".name");
  const cfg = { finds: G.found.length + " / " + st.finds.length, merit: G.merit,
                grade: success ? t(grade(G.merit)) : "—",
                secondary: success && G.stamina >= TOOLS.trowel.cost,
                labels: { finds: t("report.finds"), points: t("report.points"), grade: t("report.grade"),
                          keep: t("report.keep") } };
  if (success && last) {
    reportMode = "restart";
    Object.assign(cfg, { kicker: t("report.year_done"), title: t("ui.title"),
      site: "", body: [Q_("answer")], primary: t("report.again"), secondary: false });
  } else if (success) {
    reportMode = "next";
    Object.assign(cfg, { kicker: t("report.title"), title: S_("name"),
      site: S_("state"), body: [Q_("answer"), S_("close")],
      primary: t("report.next", { name: nextName }) });
  } else {
    reportMode = "retry";
    Object.assign(cfg, { kicker: t("report.suspended"), title: S_("name"), site: S_("state"),
      body: [t("report.fail1"), t("report.fail2")],
      primary: t("report.retry", { name: S_("name") }), secondary: false });
  }
  hud.report(cfg);
}

document.getElementById("reportPrimary").addEventListener("click", async () => {
  hud.hideReport();
  if (reportMode === "restart") { G.chapter = 0; G.totalMerit = 0; G.completed = 0; save(); await openSite(0); }
  else if (reportMode === "retry") await openSite(G.chapter);
  else await openSite(Math.min(G.chapter + 1, SITES.length - 1));
  canvas.requestPointerLock();
});
document.getElementById("reportSecondary").addEventListener("click", () => {
  hud.hideReport(); G.seasonOver = false; canvas.requestPointerLock();
});

/* ---------------- settings ---------------- */
function applySettings() {
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  if (scene.fog) {
    scene.fog.far = settings.renderDistance;
    scene.fog.near = settings.renderDistance * 0.29;
  }
  if (player) {
    player.sensitivity = settings.sensitivity / 1000;
    player.invertY = settings.invertY;
    player.bobEnabled = settings.headBob;
  }
  if (!settings.crackOverlay) crackMesh.visible = false;
  hud.e.fps.hidden = !settings.showFps;
  audio.applyVolumes();
  if (!settings.music_on) audio.stopMusic();
  else if (G.site && audio.ready && !audio.music.on) audio.startMusic(SITE_RAGA[G.site.id]);
}
onSetting(applySettings);

/* ---------------- input ---------------- */
function setTool(n) {
  if (!TOOLS[n] || G.seasonOver) return;
  if (n === "survey" && G.surveys <= 0) return;
  G.tool = n; viewmodel.setTool(n); hud.tool(n);
}
document.querySelectorAll(".slot").forEach((b) =>
  b.addEventListener("click", (e) => { e.stopPropagation(); setTool(b.dataset.tool); }));
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  if (!player || !player.locked) return;
  if (e.button === 0) { digging = true; clickUse(); }
  else if (e.button === 2) placeBlock();
});
window.addEventListener("mouseup", (e) => { if (e.button === 0) { digging = false; cancelMining(); } });
window.addEventListener("wheel", (e) => {
  if (!player || !player.locked) return;
  const i = ORDER.indexOf(G.tool);
  setTool(ORDER[(i + (e.deltaY > 0 ? 1 : ORDER.length - 1)) % ORDER.length]);
}, { passive: true });
window.addEventListener("keydown", (e) => {
  const k = e.code;
  if (KEYS[k]) setTool(KEYS[k]);
  else if (k === "KeyE") { const l = nearestLiftable(); if (l !== null) { liftFind(l, false); audio.dig("soil", G.tool); viewmodel.swing(0.5); } }
  else if (k === "KeyQ") {
    const kinds = spoilKinds();
    if (kinds.length) { G.spoilSel = (G.spoilSel + 1) % kinds.length; refreshSpoil(); }
  }
  else if (k === "KeyG") useStation();
  else if (k === "KeyT") toggleView();
  else if (k === "KeyF") {
    if (!player) return;
    const on = player.toggleFly();
    hud.toast(t(on ? "toast.fly_on" : "toast.fly_off"), false);
  }
  else if (k === "KeyR") { if (G.keystone && !G.seasonOver) endSeason(true); }
  else if (k === "KeyJ" || k === "Tab") {
    e.preventDefault();
    const open = hud.toggleBook();
    if (open) { hud.notebook(G.site, G.quest, G.solved, activeClue()); document.exitPointerLock(); }
    else canvas.requestPointerLock();
  }
});

/* ---------------- loop ---------------- */
let last = performance.now();
function step(dt) { stepLogic(dt); draw(); }

/* Logic only. A headless probe can run thousands of these in the time
   one rendered frame would take, which is the difference between a
   self-test that finishes and one that hangs. */
function stepLogic(dt) {
  if (!player || !world) return;
  player.update(dt);
  updateTarget();

  updateMining(dt);

  for (const [, o] of findObjs) {
    if (o.lifted || !o.light) continue;
    o.t += dt;
    o.light.intensity = 4.5 + Math.sin(o.t * 2.6) * 1.8;
    o.group.rotation.y += dt * 0.25;
    const gy = groundUnder(o.group.position.x, o.group.position.z, o.group.position.y);
    if (o.group.position.y > gy + 0.02) {
      o.vy = (o.vy || 0) - 18 * dt;
      o.group.position.y = Math.max(gy, o.group.position.y + o.vy * dt);
      if (o.group.position.y <= gy + 0.02) o.vy = 0;
      o.light.position.set(o.group.position.x, o.group.position.y + 0.8, o.group.position.z);
    }
  }
  for (let i = flying.length - 1; i >= 0; i--) {
    const f = flying[i];
    f.t = Math.min(1, f.t + dt / 0.85);
    const e = 1 - Math.pow(1 - f.t, 3);
    f.o.group.position.lerpVectors(f.from, camera.position, e);
    f.o.group.scale.setScalar(1.9 * (1 - 0.8 * e));
    if (f.o.light) f.o.light.intensity = 6 * (1 - f.t);
    if (f.t >= 1) {
      scene.remove(f.o.group); if (f.o.light) scene.remove(f.o.light);
      flying.splice(i, 1);
    }
  }

  if (beacon.visible && performance.now() > beaconUntil) beacon.visible = false;

  /* compass: where you face, and where the clue lies */
  {
    const a = activeClue();
    let bearing = null;
    if (a >= 0 && G.site.finds[a].dig) {
      const f = G.site.finds[a].dig;
      bearing = ((Math.atan2(f.x + 0.5 - player.pos.x, -(f.z + 0.5 - player.pos.z)) * 180 / Math.PI) % 360 + 360) % 360;
    }
    hud.compass(player.yaw, bearing);
  }

  stepDebris(dt);
  viewmodel.update(dt, { bob: player.bob, look: { x: 0, y: 0 } });
}

function draw() {
  renderer.render(scene, camera);
  viewmodel.render(renderer);
}
function groundUnder(x, z, fromY) {
  for (let y = Math.floor(fromY); y >= 0; y--)
    if (world.get(Math.floor(x), y, Math.floor(z)) !== B.AIR &&
        world.get(Math.floor(x), y, Math.floor(z)) !== B.WATER) return y + 1.02;
  return 1;
}
let fpsAccum = 0, fpsFrames = 0;
function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  step(dt);
  last = now;
  if (settings.showFps) {
    fpsAccum += dt; fpsFrames++;
    if (fpsAccum >= 0.5) {
      hud.e.fps.textContent = Math.round(fpsFrames / fpsAccum) + " fps";
      fpsAccum = 0; fpsFrames = 0;
    }
  }
  requestAnimationFrame(tick);
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  viewmodel.resize(w / h);
}
addEventListener("resize", resize);
resize();

/* ---------------- boot ---------------- */
function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.chapter === "number" && d.chapter >= 0 && d.chapter < SITES.length) return d;
  } catch (e) {}
  return null;
}
function pauseContext() {
  const a = activeClue();
  return {
    chapter: G.chapter, site: G.site,
    clue: a >= 0 ? Q_("clue." + (a + 1) + ".text") : null,
    found: G.found.length, total: G.total, merit: G.merit,
    stamina: Math.max(0, G.stamina), spoil: spoilTotal()
  };
}

const menu = new Menu({
  audio, sites: SITES,
  hasSave: () => !!readSave(),
  readSave,
  onSettings: applySettings,
  onContinue: async () => {
    audio.init();
    menu.hide();
    await openSite(G.chapter);
    canvas.requestPointerLock();
  },
  onStart: async () => {
    audio.init();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    G.chapter = 0; G.totalMerit = 0; G.completed = 0;
    menu.hide();
    await openSite(0);
    canvas.requestPointerLock();
  },
  onResume: () => { audio.init(); menu.hide(); canvas.requestPointerLock(); },
  onAbandon: () => { audio.stopMusic(); menu.show("title"); }
});

const saved = readSave();
if (saved) { G.chapter = saved.chapter; G.totalMerit = saved.totalMerit || 0; G.completed = saved.completed || 0; }

/* Language first: nothing can be drawn before the words exist. */
initI18n(settings.lang).then(() => {
  applyStatic();
  applySettings();
  menu.show("title");
  requestAnimationFrame(tick);
});

/* Redraw everything that holds text when the language changes. */
onLanguageChange(() => {
  applyStatic();
  if (G.site) {
    refreshObjective();
    renderNotebook();
    hud.tool(G.tool);
    refreshSpoil();
    hud.gauges(G);
  }
});

if (location.search.includes("probe")) {
  window.__dig = { G, step, stepLogic, draw, clickUse, updateMining, placeBlock, useStation, setTool, updateTarget, liftFind, exposeFind, runSurvey,
                   endSeason, scene, camera, renderer, hud,
                   world: () => world, mesher: () => mesher, player: () => player,
                   physicsSelfTest: () => player.selfTest(),
                   spoil, menu, audio, settings, findObjs, toggleView,
                   openSite, setDigging: (v) => { digging = v; } };
}
