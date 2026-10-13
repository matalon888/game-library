/* ============================================================
   NEON RUNNER — LAN HOST SERVER
   Run this on ONE machine on your office wifi/LAN. Everyone else
   connects to that machine's IP in their browser.

   Usage:
     node server.js
     (needs Node.js installed — nodejs.org)

   Then on the host machine, find its LAN IP:
     Windows:  ipconfig        -> look for "IPv4 Address"
     Mac/Linux: ifconfig | grep inet   (or `ip addr`)
   It'll look like 192.168.1.42 or 10.0.0.15

   Everyone on the same wifi opens:
     http://<that-ip>:8080

   This server does two jobs:
     1. Serves index.html (and its css/js/) as static files (so clients
        don't need their own copy).
     2. Runs a WebSocket relay so clients can find each other and
        exchange state. It is currently a RELAY, not yet authoritative —
        see the NOTE at the bottom for what's left before this is real
        co-op netcode.
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT) || 8080;   // PORT=8081 node server.js to run a second host
const ROOT = __dirname;
const HTML_FILE = 'index.html'; // must sit next to this file

/* ---------------- static file server ---------------- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.wav': 'audio/wav', '.flac': 'audio/flac', '.opus': 'audio/opus', '.webm': 'audio/webm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };

/* Every non-internal IPv4 address on this machine, so a client sitting on
   localhost (i.e. the host's own browser) can be shown the address everyone
   else on the wifi should actually use. */
function lanIPs() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const name in nets) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

/* ---------------- profile sync (host machine only) ----------------
   Progress lives in localStorage, which is scoped per ORIGIN. `http://localhost:8080`
   and `http://192.168.0.74:8080` are different origins, so opening the game the "other"
   way on the host's own machine showed a brand new profile with no credits or unlocks.

   The server keeps one profile.json and serves it ONLY to the machine it is running on,
   so the host's progression follows them whichever address they use. A genuine remote
   player is refused and keeps their own browser-local save — otherwise everyone who
   joined would inherit (and overwrite) the host's account.

   Same-machine test: the request's source address is loopback, or one of this machine's
   own addresses. A remote client on the LAN always presents a different source IP. */
function sameMachine(req) {
  let ip = (req.socket && req.socket.remoteAddress) || '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);          // IPv4-mapped IPv6
  if (ip === '127.0.0.1' || ip === '::1' || ip === '') return true;
  return lanIPs().indexOf(ip) >= 0;
}

const PROFILE_FILE = path.join(ROOT, 'profile.json');

function handleProfile(req, res) {
  if (!sameMachine(req)) {
    // Not an error the player should see — remote clients simply use their own save.
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'profile sync is host-machine only' }));
    return true;
  }
  if (req.method === 'GET') {
    fs.readFile(PROFILE_FILE, 'utf8', (err, data) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(err ? 'null' : data);
    });
    return true;
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    let body = '';
    req.on('data', c => {
      body += c;
      if (body.length > 512000) { req.destroy(); }        // profiles are a few KB; cap the write
    });
    req.on('end', () => {
      try {
        JSON.parse(body);                                  // never persist malformed JSON
        fs.writeFile(PROFILE_FILE, body, () => {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"bad json"}');
      }
    });
    return true;
  }
  res.writeHead(405); res.end('method not allowed');
  return true;
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/profile') { if (handleProfile(req, res)) return; }
  if (reqPath === '/net-info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ips: lanIPs(), port: PORT }));
    return;
  }
  if (reqPath === '/') reqPath = '/' + HTML_FILE;
  const filePath = path.join(ROOT, reqPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found: ' + reqPath); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

/* ---------------- minimal WebSocket implementation ----------------
   No dependencies on purpose — this is meant to run with a bare `node
   server.js` on an office machine that may not have npm access. It's
   ~100 lines of RFC 6455 framing, which is all a LAN relay needs. */
function wsAccept(key) {
  return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}
function wsFrame(payloadBuf, opcode) {
  const len = payloadBuf.length;
  let header;
  if (len < 126) header = Buffer.from([0x80 | (opcode || 1), len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | (opcode || 1); header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | (opcode || 1); header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payloadBuf]);
}
function wsSend(socket, obj) {
  try { socket.write(wsFrame(Buffer.from(JSON.stringify(obj)), 1)); } catch (e) {}
}
function wsPing(socket) { try { socket.write(wsFrame(Buffer.alloc(0), 9)); } catch (e) {} }
function wsPong(socket, payload) { try { socket.write(wsFrame(payload || Buffer.alloc(0), 10)); } catch (e) {} }
function wsClose(socket) {
  try { socket.write(wsFrame(Buffer.alloc(0), 8)); socket.end(); } catch (e) { try { socket.destroy(); } catch (e2) {} }
  // If the peer never answers the close handshake, stop waiting on it.
  setTimeout(() => { try { socket.destroy(); } catch (e) {} }, 2000);
}
function wsParseFrames(buf, onMessage, onControl) {
  let offset = 0;
  while (offset + 2 <= buf.length) {
    const b0 = buf[offset], b1 = buf[offset + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f, hLen = 2;
    if (len === 126) { if (offset + 4 > buf.length) break; len = buf.readUInt16BE(offset + 2); hLen = 4; }
    else if (len === 127) { if (offset + 10 > buf.length) break; len = Number(buf.readBigUInt64BE(offset + 2)); hLen = 10; }
    const maskLen = masked ? 4 : 0;
    if (offset + hLen + maskLen + len > buf.length) break;         // incomplete frame, wait for more data
    let payload = buf.slice(offset + hLen + maskLen, offset + hLen + maskLen + len);
    if (masked) {
      const mask = buf.slice(offset + hLen, offset + hLen + 4);
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    }
    if (opcode === 8) return -1;              // close frame
    if (opcode === 1) onMessage(payload.toString('utf8'));
    // 9 = ping, 10 = pong. Browsers answer our pings automatically; answering
    // theirs (and counting either as liveness) is what keeps an idle client in
    // the lobby from looking dead to the reaper below.
    else if (opcode === 9 || opcode === 10) { if (onControl) onControl(opcode, payload); }
    offset += hLen + maskLen + len;
  }
  return offset;
}

/* ---------------- room state ---------------- */
const clients = new Map();    // socket -> { id, name, char, lastSeen }
const room = { match: null };   // last announced match, replayed to late joiners
let nextId = 1;

/* Sticky identity across a reconnect.
   Player ids key the scoreboard (match.scores[id]) and decide TDM teams (id % 2),
   so handing a reconnecting player a fresh id silently wiped their score and could
   flip them onto the other team mid-match. The client sends a token it keeps for
   the life of the tab; the same token gets the same id back, provided nobody else
   is currently holding it. Tokens are forgotten once they go unused for a while. */
const idByToken = new Map();  // token -> { id, name, char, freedAt }
const TOKEN_TTL = 120000;

function idInUse(id) {
  for (const c of clients.values()) if (c.id === id) return true;
  return false;
}

/* A token identifies one browser tab, so a fresh connection bearing a token that some
   socket still holds means that socket is a corpse we have not buried yet — the common
   case, since a dropped wifi link or a slept laptop sends no FIN and the client retries
   in ~2s while the server would not notice for up to 30s. Evict the stale holder and
   hand the id over, rather than minting a new one and losing the player's score. */
function evictHolder(token) {
  for (const [sock, c] of clients) {
    if (c.token && c.token === token) { clients.delete(sock); wsClose(sock); return true; }
  }
  return false;
}
function claimIdentity(token) {
  if (token) {
    const prev = idByToken.get(token);
    if (prev) { evictHolder(token); prev.freedAt = 0; return prev; }
  }
  const rec = { id: nextId++, name: null, char: null, freedAt: 0 };
  if (token) idByToken.set(token, rec);
  return rec;
}
setInterval(() => {
  const now = Date.now();
  for (const [tok, rec] of idByToken) {
    if (rec.freedAt && now - rec.freedAt > TOKEN_TTL) idByToken.delete(tok);
  }
}, 30000);

function broadcast(obj, exceptSocket) {
  const raw = JSON.stringify(obj);
  for (const [sock] of clients) {
    if (sock === exceptSocket) continue;
    try { sock.write(wsFrame(Buffer.from(raw), 1)); } catch (e) {}
  }
}
function rosterList() {
  return [...clients.values()].map(c => ({ id: c.id, name: c.name, char: c.char }));
}

server.on('upgrade', (req, socket, head) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  socket.setNoDelay(true);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + wsAccept(key) + '\r\n\r\n'
  );

  /* The token rides in the WebSocket URL's query string because the id has to be
     settled before `welcome` goes out — waiting for the client's `hello` would be
     too late. */
  let token = null;
  try { token = new URL(req.url, 'http://x').searchParams.get('tok'); } catch (e) {}
  if (token) token = String(token).slice(0, 64);

  const ident = claimIdentity(token);
  const id = ident.id;
  const reclaimed = ident.name !== null;
  const me = { id: id, name: ident.name || ('Player ' + id), char: ident.char || 'vanguard',
               lastSeen: Date.now(), ident: ident, token: token };
  clients.set(socket, me);
  console.log('[connect] #' + id + (reclaimed ? ' (rejoined)' : '') + ' from ' + req.socket.remoteAddress);

  wsSend(socket, { t: 'welcome', id: id, roster: rosterList() });
  if (room.match && room.match.active) wsSend(socket, { t: 'match', id: 0, m: room.match });
  broadcast({ t: 'join', id: id, name: me.name }, socket);

  /* A client can pack its first frame into the same TCP segment as the upgrade
     request; that data arrives in `head`, not via a 'data' event. Dropping it
     silently ate the opening 'hello' on fast local connections. */
  let buf = (head && head.length) ? Buffer.from(head) : Buffer.alloc(0);

  /* Every teardown path funnels through here, so the roster loses this player
     exactly once. Previously 'error' (which is how a hard tab close usually
     surfaces) deleted the client without telling anyone, stranding a permanent
     ghost in every other player's world. */
  let dropped = false;
  function drop(why) {
    if (dropped) return;
    dropped = true;
    clients.delete(socket);
    // If this id already belongs to a newer socket (we were evicted as a stale holder),
    // stay quiet: announcing 'leave' would kick the player who just rejoined.
    if (idInUse(id)) { console.log('[disconnect] #' + id + ' (superseded)'); return; }
    ident.freedAt = Date.now();       // id is reclaimable by this token until TOKEN_TTL
    console.log('[disconnect] #' + id + (why ? ' (' + why + ')' : ''));
    broadcast({ t: 'leave', id: id });
    /* Drop the room's match when it can no longer be finished, so the next person to
       connect is not replayed into a dead round. That is either when everyone has gone,
       or when the player who STARTED the match leaves — the remaining clients end it on
       their side, but only the server can stop it being handed to future arrivals. */
    if (clients.size === 0) room.match = null;
    else if (room.match && room.match.active && room.match.startedBy === id) room.match = null;
  }

  const onData = chunk => {
    buf = Buffer.concat([buf, chunk]);
    const consumed = wsParseFrames(buf, msg => {
      let data;
      try { data = JSON.parse(msg); } catch (e) { return; }
      me.lastSeen = Date.now();
      if (data.t === 'hello') {
        me.name = String(data.name || me.name).slice(0, 18); me.char = data.char || me.char;
        ident.name = me.name; ident.char = me.char;   // survives a reconnect on the same token
        broadcast({ t: 'join', id: id, name: me.name }, socket);
      }
      // state/input relay — every other client gets this player's latest snapshot.
      // This is a RELAY, not a simulation: see the NOTE below for what turns this
      // into real authoritative netcode.
      else if (data.t === 'state') broadcast({ t: 'state', id: id, s: data.s }, socket);
      else if (data.t === 'event') broadcast({ t: 'event', id: id, e: data.e }, socket);
      // match start/stop must reach everyone, otherwise only the starter enters the match
      else if (data.t === 'match') { room.match = data.m; broadcast({ t: 'match', id: id, m: data.m }, socket); }
      // 'ping' is an app-level keepalive; the lastSeen touch above is the whole point.
    }, (opcode, payload) => {
      me.lastSeen = Date.now();
      if (opcode === 9) wsPong(socket, payload);
    });
    if (consumed === -1) { drop('closed'); wsClose(socket); return; }
    buf = buf.slice(consumed);
  };
  socket.on('data', onData);
  if (buf.length) onData(Buffer.alloc(0));   // drain anything that rode in on `head`
  socket.on('close', () => drop());
  socket.on('error', () => { drop('error'); try { socket.destroy(); } catch (e) {} });
});

/* Liveness. The client only talks to this server while it is *in* a match — sitting
   on the lobby screen it has nothing to say. Reaping on app-message silence alone
   therefore hung up on every idle lobby client after 20s, and the client's own
   auto-retry reconnected 2s later: the connect/disconnect churn in the console.
   Protocol-level pings measure the connection instead of the gameplay. */
setInterval(() => {
  const now = Date.now();
  for (const [sock, c] of clients) {
    if (now - c.lastSeen > 30000) { wsClose(sock); continue; }   // 3+ missed pongs: really gone
    wsPing(sock);
  }
}, 8000);

server.listen(PORT, () => {
  const ips = lanIPs();
  console.log('Neon Runner LAN host listening on port ' + PORT);
  console.log('On this machine, open: http://localhost:' + PORT);
  if (ips.length) {
    console.log('Share this with others on the same wifi:');
    ips.forEach(ip => console.log('  http://' + ip + ':' + PORT));
  } else {
    console.log('Could not auto-detect a LAN IP. Find it with `ipconfig` (Windows) or `ifconfig`/`ip addr` (Mac/Linux),');
    console.log('then share http://<that-ip>:' + PORT);
  }
  console.log('(The game page itself also shows this on its Multiplayer screen.)');
});

/* ============================================================
   NOTE — what this server IS and IS NOT

   IS: a working LAN presence/relay server. It serves the game file,
   accepts connections, tracks who is connected, and relays whatever
   'state' or 'event' messages clients send each other. Client A's
   messages reach every other client with no server-side game logic.

   IS NOT YET: authoritative multiplayer. For actual shared co-op
   (same enemies, same loot, agreed-upon hits and deaths, one player's
   game not diverging from another's) the CLIENT needs three things
   that don't exist yet — tracked in ROADMAP.md Phase 6:

     1. Player state extracted from the singleton `P` object into a
        per-player structure, so the client can hold >1 player.
     2. The host's world simulation decoupled from its own camera/HUD,
        so it can run a tick for players who aren't "you".
     3. A fixed timestep, so all clients agree on how far forward
        one tick moves the world.

   Once those exist, this server becomes the authority: it runs the
   real simulation using the same buildMapWorld()/spawnEnemy()/etc.
   functions the client already has (Node can run that same game.js
   in a headless mode — no DOM/WebGL calls are in the simulation path
   itself, only in rendering), and clients become thin input-senders
   that render whatever snapshot the host broadcasts.
   ============================================================ */
