const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const { LobbyManager } = require('./server/LobbyManager.js');
const { CONSTANTS } = require('./src/shared/constants.js');

function cleanName(n) {
  return String(n == null ? 'Player' : n).replace(/[<>]/g, '').trim().slice(0, 16) || 'Player';
}

function createServer(port = process.env.PORT || 3000) {
  const app = express();
  app.use(express.static(__dirname));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const lobbies = new LobbyManager();

  // client metadata: ws -> { roomCode, playerId }
  const meta = new WeakMap();
  let playerSeq = 0;

  function send(ws, obj) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  }

  wss.on('connection', (ws) => {
    meta.set(ws, { roomCode: null, playerId: null });

    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf.toString()); } catch { return; }
      const m = meta.get(ws);

      if (msg.type === 'create') {
        // Respawn-cleanup: remove from any previous room first.
        if (m.roomCode && m.playerId) {
          const oldRoom = lobbies.getRoom(m.roomCode);
          if (oldRoom) oldRoom.removePlayer(m.playerId);
        }
        const { code, room } = lobbies.createRoom({ numBots: 6 });
        const id = `p${playerSeq++}`;
        room.addPlayer(id, cleanName(msg.name), msg.color);
        meta.set(ws, { roomCode: code, playerId: id });
        send(ws, { type: 'created', code, playerId: id });
        return;
      }

      if (msg.type === 'join') {
        const room = lobbies.getRoom(msg.code);
        if (!room) { send(ws, { type: 'error', message: 'Lobby not found' }); return; }
        // Respawn-cleanup: remove from any previous room first.
        if (m.roomCode && m.playerId) {
          const oldRoom = lobbies.getRoom(m.roomCode);
          if (oldRoom) oldRoom.removePlayer(m.playerId);
        }
        const id = `p${playerSeq++}`;
        room.addPlayer(id, cleanName(msg.name), msg.color);
        meta.set(ws, { roomCode: room.code, playerId: id });
        send(ws, { type: 'joined', code: room.code, playerId: id });
        return;
      }

      if (msg.type === 'input' && m.roomCode) {
        const room = lobbies.getRoom(m.roomCode);
        if (room && Number.isFinite(msg.aimX) && Number.isFinite(msg.aimY)) {
          room.setInput(m.playerId, msg.aimX, msg.aimY, msg.boost);
        }
        return;
      }

      if (msg.type === 'leave' && m.roomCode) {
        const room = lobbies.getRoom(m.roomCode);
        if (room) room.removePlayer(m.playerId);
        meta.set(ws, { roomCode: null, playerId: null });
        return;
      }
    });

    ws.on('close', () => {
      const m = meta.get(ws);
      if (m && m.roomCode) {
        const room = lobbies.getRoom(m.roomCode);
        if (room) room.removePlayer(m.playerId);
      }
    });
  });

  // Fixed-rate simulation + broadcast.
  const interval = setInterval(() => {
    for (const [code, room] of lobbies.rooms) {
      const { kills } = room.step(CONSTANTS.DT);
      const snap = room.snapshot();
      const payload = JSON.stringify({ type: 'state', ...snap });
      for (const ws of wss.clients) {
        const m = meta.get(ws);
        if (!m || m.roomCode !== code || ws.readyState !== ws.OPEN) continue;
        ws.send(payload);
        const myKill = kills.find((k) => k.deadId === m.playerId);
        if (myKill) send(ws, { type: 'dead', by: myKill.byName });
      }
    }
    lobbies.gcEmptyRooms();
  }, 1000 / CONSTANTS.TICK_RATE);

  server.listen(port);

  function close() {
    clearInterval(interval);
    return new Promise((resolve) => { wss.close(() => server.close(resolve)); });
  }

  return { server, wss, lobbies, close };
}

if (require.main === module) {
  const { server } = createServer();
  server.on('listening', () => {
    const addr = server.address();
    console.log(`🎮 Snakes IO multiplayer server on http://localhost:${addr.port}`);
    console.log('Share your LAN IP with players on the same WiFi.');
  });
}

module.exports = { createServer };
