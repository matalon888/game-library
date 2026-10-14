/**
 * Child-safety bootstrap — runs before game modules.
 *
 * Goals:
 * - No outbound network from page scripts (no chat, no tracking, no recon beacons)
 * - No persistent personal storage
 * - No camera / mic / geo / WebRTC surfaces
 * - Block being framed by other sites (clickjacking / overlay traps)
 *
 * Note: CSP + host headers do the heavy lifting; this is defense-in-depth
 * against injected or compromised script that tries to phone home.
 */
(function () {
  'use strict';

  var SAFETY = {
    version: 1,
    networkBlocked: true,
    storageBlocked: true,
    mediaBlocked: true,
  };

  function blocked(api) {
    return function () {
      console.warn('[safety] Blocked ' + api + ' — this game does not allow network or tracking.');
      return Promise.reject(new Error('Blocked for child safety: ' + api));
    };
  }

  function blockedSync(api) {
    return function () {
      console.warn('[safety] Blocked ' + api);
      throw new Error('Blocked for child safety: ' + api);
    };
  }

  // —— Network: no way for page JS to talk to the outside world ——
  try {
    if (typeof window.fetch === 'function') {
      window.fetch = blocked('fetch');
    }
  } catch (_) {}

  try {
    if (window.XMLHttpRequest) {
      window.XMLHttpRequest = function () {
        throw new Error('Blocked for child safety: XMLHttpRequest');
      };
    }
  } catch (_) {}

  try {
    if (window.WebSocket) {
      window.WebSocket = function () {
        throw new Error('Blocked for child safety: WebSocket');
      };
    }
  } catch (_) {}

  try {
    if (window.EventSource) {
      window.EventSource = function () {
        throw new Error('Blocked for child safety: EventSource');
      };
    }
  } catch (_) {}

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon = function () {
        console.warn('[safety] Blocked sendBeacon');
        return false;
      };
    }
  } catch (_) {}

  // WebRTC — prevents peer recon / camera+mic abuse
  try {
    var rtcNames = [
      'RTCPeerConnection',
      'webkitRTCPeerConnection',
      'mozRTCPeerConnection',
      'RTCDataChannel',
    ];
    for (var i = 0; i < rtcNames.length; i++) {
      if (window[rtcNames[i]]) {
        window[rtcNames[i]] = function () {
          throw new Error('Blocked for child safety: WebRTC');
        };
      }
    }
  } catch (_) {}

  // —— Storage: no durable data about the player ——
  function lockStorage(storage, name) {
    if (!storage) return;
    try {
      storage.setItem = function () {
        console.warn('[safety] Blocked ' + name + '.setItem');
      };
      storage.removeItem = function () {};
      storage.clear = function () {};
      storage.getItem = function () {
        return null;
      };
    } catch (_) {}
  }
  try {
    lockStorage(window.localStorage, 'localStorage');
    lockStorage(window.sessionStorage, 'sessionStorage');
  } catch (_) {}

  try {
    Object.defineProperty(document, 'cookie', {
      get: function () {
        return '';
      },
      set: function () {
        console.warn('[safety] Blocked document.cookie');
      },
      configurable: false,
    });
  } catch (_) {}

  try {
    if (window.indexedDB) {
      window.indexedDB.open = blockedSync('indexedDB.open');
    }
  } catch (_) {}

  // —— Sensors / capture devices ——
  try {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition = function (ok, err) {
        if (err) err({ code: 1, message: 'Blocked for child safety' });
      };
      navigator.geolocation.watchPosition = function () {
        return -1;
      };
    }
  } catch (_) {}

  try {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = blocked('getUserMedia');
      navigator.mediaDevices.getDisplayMedia = blocked('getDisplayMedia');
      navigator.mediaDevices.enumerateDevices = function () {
        return Promise.resolve([]);
      };
    }
  } catch (_) {}

  // —— Service workers only (could cache + phone home). Leave Worker alone
  // so the graphics engine never breaks on systems that probe for it. ——
  try {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.register = blocked('serviceWorker.register');
    }
  } catch (_) {}

  // —— Clickjacking: refuse to run inside a foreign iframe ——
  try {
    if (window.top !== window.self) {
      // Allow same-origin embeds only; break out of cross-origin frames
      try {
        if (window.top.location.origin !== window.location.origin) {
          window.top.location = window.location.href;
        }
      } catch (e) {
        // Cross-origin frame: blank ourselves rather than run for a stranger's page
        document.documentElement.innerHTML =
          '<body style="font-family:system-ui;background:#111;color:#ddd;padding:2rem;text-align:center">' +
          '<h1>Blocked</h1><p>This game cannot run inside another website.</p>' +
          '<p><a href="' +
          String(window.location.href).replace(/"/g, '') +
          '" target="_blank" rel="noopener" style="color:#8fd48a">Open the real game</a></p></body>';
        return;
      }
    }
  } catch (_) {}

  // Expose a read-only flag for the game UI (no secrets)
  try {
    Object.defineProperty(window, '__HIDE_SAFETY__', {
      value: Object.freeze(SAFETY),
      writable: false,
      configurable: false,
    });
  } catch (_) {
    window.__HIDE_SAFETY__ = SAFETY;
  }
})();
