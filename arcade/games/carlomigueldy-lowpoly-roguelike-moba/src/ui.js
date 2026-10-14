// Thin DOM controller: HUD, upgrade picker, logs, game over.
export class UI {
  constructor() {
    this.hud = document.getElementById("hud");
    this.menu = document.getElementById("menu");
    this.boot = document.getElementById("boot");
    this.upgrade = document.getElementById("upgrade");
    this.upgradeCards = document.getElementById("upgrade-cards");
    this.gameover = document.getElementById("gameover");
    this.logEl = document.getElementById("log");

    this.hp = document.getElementById("hpbar");
    this.hptext = document.getElementById("hptext");
    this.mana = document.getElementById("manabar");
    this.manatext = document.getElementById("manatext");
    this.xp = document.getElementById("xpbar");
    this.gold = document.getElementById("stat-gold");
    this.waveEl = document.getElementById("stat-wave");
    this.levelEl = document.getElementById("stat-level");
    this.netEl = document.getElementById("stat-net");
    this.abilityEls = {};
    document.querySelectorAll(".ability").forEach((el) => (this.abilityEls[el.dataset.key] = el));
  }

  hideBoot() { this.boot.classList.add("hidden"); }
  showMenu() { this.menu.classList.remove("hidden"); }
  hideMenu() { this.menu.classList.add("hidden"); }
  startHUD() { this.hud.classList.remove("hidden"); }
  setNet(label) { this.netEl.textContent = label; }

  log(msg) {
    const d = document.createElement("div");
    d.className = "logline";
    d.textContent = msg;
    this.logEl.appendChild(d);
    setTimeout(() => d.remove(), 4200);
  }

  updateHUD(p, wave, ABILITIES) {
    this.hp.style.transform = `scaleX(${Math.max(0, p.hp / p.maxHp)})`;
    this.hptext.textContent = `${Math.ceil(Math.max(0, p.hp))}/${p.maxHp}`;
    this.mana.style.transform = `scaleX(${Math.max(0, p.mana / p.maxMana)})`;
    this.manatext.textContent = `${Math.ceil(p.mana)}/${p.maxMana}`;
    this.xp.style.transform = `scaleX(${Math.max(0, p.xp / p.xpNeed)})`;
    this.gold.textContent = `Gold: ${p.gold}`;
    this.waveEl.textContent = `Wave: ${wave}`;
    this.levelEl.textContent = `Lv ${p.level}`;
    for (const k of ["Q", "W", "E", "R"]) {
      const el = this.abilityEls[k];
      const cd = p.cooldowns[k];
      const max = ABILITIES[k].cd * p.cdMul;
      const ratio = max > 0 ? cd / max : 0;
      el.querySelector(".cd").style.transform = `scaleY(${Math.max(0, ratio)})`;
      const ready = cd <= 0 && p.mana >= ABILITIES[k].mana;
      el.classList.toggle("ready", ready);
    }
  }

  showUpgrades(picks, onPick) {
    this.upgradeCards.innerHTML = "";
    this.upgrade.classList.remove("hidden");
    for (const u of picks) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="ico">${u.ico}</div><h4>${u.name}</h4><p>${u.desc}</p>`;
      card.onclick = () => { this.upgrade.classList.add("hidden"); onPick(u); };
      this.upgradeCards.appendChild(card);
    }
  }

  gameOver(wave, gold, level) {
    document.getElementById("gameover-sub").textContent =
      `Reached wave ${wave} · Level ${level} · ${gold} gold collected.`;
    this.gameover.classList.remove("hidden");
  }
}
