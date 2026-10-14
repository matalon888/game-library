import { UI } from "./ui.js";
import { Net, makeQR, inviteLink } from "./net.js";
import { Game, makeRenderer, randomPalette } from "./game.js";

const ui = new UI();
const canvas = document.getElementById("game");

let renderer, game, net;

async function boot() {
  renderer = await makeRenderer(canvas);
  ui.hideBoot();
  ui.setNet(renderer.backendLabel === "webgpu" ? "WebGPU" : "WebGL");
  wireMenu();

  // Auto-fill join code from invite link (?join=CODE)
  const params = new URLSearchParams(location.search);
  const joinCode = params.get("join");
  if (joinCode) {
    document.getElementById("join-code").value = joinCode;
    ui.log("Invite detected — press Join Run");
  }
}

function newGame(withNet) {
  net = withNet ? new Net() : null;
  game = new Game(canvas, renderer, net, ui);
  return game;
}

async function startSolo() {
  ui.hideMenu();
  ui.startHUD();
  newGame(false);
  game.setupLocalPlayer(randomPalette());
  game.start();
  ui.setNet("Solo · " + (renderer.backendLabel === "webgpu" ? "WebGPU" : "WebGL"));
}

async function startHost() {
  const hostInfo = document.getElementById("host-info");
  hostInfo.classList.remove("hidden");
  document.getElementById("btn-host").disabled = true;
  net = new Net();
  let code;
  try {
    code = await net.host();
  } catch (e) {
    ui.log("Could not reach matchmaking broker.");
    document.getElementById("btn-host").disabled = false;
    return;
  }
  const link = inviteLink(code);
  document.getElementById("invite-code").value = code;
  document.getElementById("invite-link").value = link;
  makeQR(document.getElementById("invite-qr"), link);

  net.onPeerChange = () => {
    const n = net.peerCount();
    document.getElementById("peer-list").textContent =
      n === 0 ? "Waiting for players…" : `${n} player(s) joined ✔`;
  };

  // Build the game now so host receives joins into a live world
  game = new Game(canvas, renderer, net, ui);
  game.setupLocalPlayer(randomPalette());

  document.getElementById("btn-start").onclick = () => {
    ui.hideMenu();
    ui.startHUD();
    game.start();
    ui.setNet(`Host · ${net.peerCount() + 1}p`);
  };
}

async function startJoin() {
  const code = document.getElementById("join-code").value.trim();
  if (!code) { ui.log("Enter a room code"); return; }
  const status = document.getElementById("join-status");
  status.textContent = "Connecting…";
  net = new Net();
  game = new Game(canvas, renderer, net, ui);
  game.setupLocalPlayer(randomPalette());
  try {
    await net.join(code);
    status.textContent = "Connected! Starting…";
    setTimeout(() => {
      ui.hideMenu();
      ui.startHUD();
      game.start();
      ui.setNet("Client");
    }, 600);
  } catch (e) {
    status.textContent = "Failed: " + (e.message || "could not connect");
  }
}

function wireMenu() {
  document.getElementById("btn-solo").onclick = startSolo;
  document.getElementById("btn-host").onclick = startHost;
  document.getElementById("btn-join").onclick = startJoin;
  document.getElementById("btn-restart").onclick = () => location.reload();

  document.querySelectorAll(".copy").forEach((btn) => {
    btn.onclick = () => {
      const input = document.getElementById(btn.dataset.copy);
      input.select();
      navigator.clipboard?.writeText(input.value).then(
        () => { btn.textContent = "Copied!"; setTimeout(() => (btn.textContent = "Copy"), 1200); },
        () => ui.log("Copy failed — select manually")
      );
    };
  });
}

boot();
