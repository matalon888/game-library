// Wires lobby UI -> networking -> render loop.
(function () {
  const canvas = document.getElementById('gameCanvas');
  const menu = document.getElementById('menu');
  const instructions = document.getElementById('instructions');
  const gameOver = document.getElementById('gameOver');

  const nameInput = document.getElementById('playerName');
  const joinCode = document.getElementById('joinCode');
  const lobbyMsg = document.getElementById('lobbyMsg');
  const lobbyBanner = document.getElementById('lobbyBanner');
  const modeChoice = document.getElementById('modeChoice');
  const mpPanel = document.getElementById('mpPanel');
  const roomCodeHud = document.getElementById('roomCodeHud');

  let selectedControl = 'mouse';
  let selectedColor = '#00ff88';
  let pendingMode = 'solo'; // 'solo' | 'mp' — how the next created game was started

  // Menu visuals: ambient background + a live preview of the player's snake.
  const bgFX = new BackgroundFX(document.getElementById('bgCanvas'));
  const preview = new SnakePreview(document.getElementById('previewCanvas'));
  bgFX.start();
  preview.start();

  // Control + color pickers (reuse existing buttons if present)
  document.querySelectorAll('.color-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach((o) => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedColor = opt.getAttribute('data-color');
      preview.setColor(selectedColor); // reflect the choice in the live preview
    });
  });
  const ctrlMap = { mouseBtn: 'mouse', arrowsBtn: 'arrows', joystickBtn: 'joystick' };
  Object.keys(ctrlMap).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => {
      selectedControl = ctrlMap[id];
      document.querySelectorAll('.control-btn').forEach((b) => b.classList.remove('active'));
      el.classList.add('active');
    });
  });

  const net = new NetClient();
  const sfx = new SoundFX();
  let lastMass = 0;
  let prevBoost = false;
  let lastEatSound = 0;
  // Renderer and InputController are created only once to avoid stacking event listeners.
  // InputController binds listeners to document/canvas in its constructor with no cleanup,
  // so re-constructing on every respawn would leak listeners. We guard with null-checks here
  // and call renderer.setFollowId() each time startGame() is invoked instead.
  let renderer = null;
  let input = null;
  let running = false;
  let lastSnapAt = 0;

  function playerName() { return (nameInput && nameInput.value.trim()) || 'Player'; }

  function showRoomCode(code) {
    if (!roomCodeHud) return;
    roomCodeHud.innerHTML = 'LOBBY';
    const el = document.createElement('span');
    el.className = 'code';
    el.textContent = code;
    roomCodeHud.appendChild(el);
    roomCodeHud.classList.remove('hidden');
  }
  function hideRoomCode() { if (roomCodeHud) roomCodeHud.classList.add('hidden'); }

  net.onError = (m) => { lobbyMsg.textContent = m.message || 'Error'; };
  net.onCreated = (m) => {
    // Multiplayer host: keep the code visible in-game so they can share it.
    if (pendingMode === 'mp') showRoomCode(m.code); else hideRoomCode();
    startGame(m.playerId);
  };
  net.onJoined = (m) => { showRoomCode(m.code); startGame(m.playerId); };
  net.onState = () => { lastSnapAt = performance.now(); updateHUD(); };
  net.onDead = (m) => { sfx.death(); showGameOver(m.by); };

  async function ensureConnected() {
    if (net.ws && net.ws.readyState === WebSocket.OPEN) return;
    try { await net.connect(); }
    catch { lobbyMsg.textContent = 'Could not reach server'; throw new Error('no-conn'); }
  }

  // Single Player: create a private game (bots fill it) and drop straight in.
  document.getElementById('singlePlayerBtn').addEventListener('click', async () => {
    lobbyMsg.textContent = '';
    pendingMode = 'solo';
    sfx.resume();
    try { await ensureConnected(); net.create(playerName(), selectedColor); } catch {}
  });

  // Multiplayer: reveal the create/join panel.
  document.getElementById('multiplayerBtn').addEventListener('click', () => {
    lobbyMsg.textContent = '';
    modeChoice.classList.add('hidden');
    mpPanel.classList.remove('hidden');
  });
  document.getElementById('mpBackBtn').addEventListener('click', () => {
    lobbyMsg.textContent = '';
    mpPanel.classList.add('hidden');
    modeChoice.classList.remove('hidden');
  });

  document.getElementById('createLobbyBtn').addEventListener('click', async () => {
    lobbyMsg.textContent = '';
    pendingMode = 'mp';
    sfx.resume();
    try { await ensureConnected(); net.create(playerName(), selectedColor); } catch {}
  });
  document.getElementById('joinLobbyBtn').addEventListener('click', async () => {
    lobbyMsg.textContent = '';
    pendingMode = 'mp';
    sfx.resume();
    const code = joinCode.value.trim().toUpperCase();
    if (code.length !== 5) { lobbyMsg.textContent = 'Enter a 5-letter code'; return; }
    try { await ensureConnected(); net.join(code, playerName(), selectedColor); } catch {}
  });

  function startGame(playerId) {
    menu.classList.add('hidden');
    if (instructions) instructions.classList.add('hidden');
    if (gameOver) gameOver.style.display = 'none';
    canvas.classList.add('playing');
    // Pause the menu visuals while playing to free the CPU.
    bgFX.stop(); preview.stop();
    lastMass = 0; prevBoost = false;

    // Guard: create Renderer and InputController only once to prevent listener leaks.
    if (!renderer) renderer = new Renderer(canvas);
    if (!input) input = new InputController(canvas, selectedControl);
    // Always update the follow target for the current session/respawn.
    renderer.setFollowId(playerId);

    running = true;
    requestAnimationFrame(loop);
  }

  function loop() {
    if (!running) return;
    const [prev, last] = net.latestTwo();
    if (last) {
      // 1-snapshot interpolation delay based on ~tick interval.
      const dtMs = 1000 / 30;
      const alpha = Math.min(1, (performance.now() - lastSnapAt) / dtMs);
      const me = last.snakes.find((s) => s.id === net.playerId);
      renderer.followHead = me ? me.segments[0] : renderer.followHead;
      renderer.render(prev, last, alpha);

      if (input) {
        const aim = input.getAim(renderer);
        net.sendInput(aim.x, aim.y, input.boost);
        if (input.boost && !prevBoost) sfx.boost();
        prevBoost = input.boost;
      }
    }
    requestAnimationFrame(loop);
  }

  function updateHUD() {
    const [, last] = net.latestTwo();
    if (!last) return;
    const me = last.snakes.find((s) => s.id === net.playerId);
    if (me) {
      if (lastMass && me.mass > lastMass + 0.5) {
        const now = performance.now();
        if (now - lastEatSound > 120) { sfx.eat(); lastEatSound = now; }
      }
      lastMass = me.mass;
    }
    const score = document.getElementById('score');
    if (score && me) score.textContent = `Mass: ${Math.floor(me.mass)} | Length: ${me.segments.length}`;

    const list = document.getElementById('leaderboardList');
    if (list) {
      list.innerHTML = '';
      last.leaderboard.forEach((row, i) => {
        const el = document.createElement('div');
        el.className = 'leaderboard-entry' + (me && row.name === me.name ? ' player' : '');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${i + 1}. ${row.name}`;
        const massSpan = document.createElement('span');
        massSpan.textContent = String(row.mass);
        el.appendChild(nameSpan);
        el.appendChild(massSpan);
        list.appendChild(el);
      });
    }
    if (last.events && last.events.length) {
      const feed = document.getElementById('killFeed');
      if (feed) {
        for (const ev of last.events) {
          if (ev.type !== 'kill') continue;
          const line = document.createElement('div');
          line.className = 'kill-line';
          line.textContent = ev.by === 'wall' ? `${ev.name} hit the wall` : `${ev.name} was eaten by ${ev.by}`;
          feed.appendChild(line);
        }
        while (feed.children.length > 5) feed.removeChild(feed.firstChild);
      }
    }
  }

  function showGameOver(by) {
    running = false;
    canvas.classList.remove('playing');
    const fs = document.getElementById('finalScore');
    if (fs) fs.textContent = by === 'wall' ? 'You hit the wall!' : `You were eaten by ${by}!`;
    if (gameOver) gameOver.style.display = 'block';
  }

  // Respawn / back to menu from the existing game-over buttons.
  const restart = document.getElementById('restartBtn');
  if (restart) restart.addEventListener('click', () => {
    if (gameOver) gameOver.style.display = 'none';
    net.join(net.code, playerName(), selectedColor);
  });

  // Pause overlay. NOTE: this is multiplayer — the server keeps simulating while
  // the overlay is open, so your snake keeps moving. This is just a menu escape hatch.
  const pauseMenu = document.getElementById('pauseMenu');
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && running && pauseMenu) {
      pauseMenu.style.display = (pauseMenu.style.display === 'block') ? 'none' : 'block';
    }
  });
  const resumeBtn = document.getElementById('resumeBtn');
  if (resumeBtn) resumeBtn.addEventListener('click', () => {
    if (pauseMenu) pauseMenu.style.display = 'none';
  });

  const toMenu = document.getElementById('mainMenuBtn');
  if (toMenu) toMenu.addEventListener('click', () => {
    running = false; net.leave();
    if (gameOver) gameOver.style.display = 'none';
    if (pauseMenu) pauseMenu.style.display = 'none';
    canvas.classList.remove('playing');
    hideRoomCode();
    // Reset the home screen to its default state and resume the visuals.
    mpPanel.classList.add('hidden');
    modeChoice.classList.remove('hidden');
    if (lobbyBanner) lobbyBanner.classList.add('hidden');
    lobbyMsg.textContent = '';
    menu.classList.remove('hidden');
    bgFX.start(); preview.start();
  });
})();
