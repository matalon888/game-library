/**
 * On-screen joystick + action buttons for touch devices.
 * Look: drag on the right half of the screen (outside buttons).
 * Hidden on title screens so it never steals the Play button.
 */
export class MobileControls {
  constructor(player, root) {
    this.player = player;
    this.root = root;
    this.active = false; // device wants mobile scheme
    this.gameplay = false; // only show sticks during a round
    this._lookId = null;
    this._lookLast = null;
    this._stickId = null;

    this.el = document.createElement('div');
    this.el.id = 'mobile-controls';
    this.el.setAttribute('aria-hidden', 'true');

    // Build without innerHTML assignment of handlers
    const stickZone = document.createElement('div');
    stickZone.id = 'stick-zone';
    const stickBase = document.createElement('div');
    stickBase.id = 'stick-base';
    const stickKnob = document.createElement('div');
    stickKnob.id = 'stick-knob';
    stickBase.appendChild(stickKnob);
    stickZone.appendChild(stickBase);

    const cluster = document.createElement('div');
    cluster.id = 'btn-cluster';

    const mkBtn = (id, label, hold, tap) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = id;
      b.className = tap ? 'mbtn action' : 'mbtn';
      b.textContent = label;
      if (hold) b.dataset.hold = hold;
      if (tap) b.dataset.tap = tap;
      return b;
    };

    cluster.appendChild(mkBtn('btn-sneak', 'SNEAK', 'sneak'));
    cluster.appendChild(mkBtn('btn-sprint', 'RUN', 'sprint'));
    cluster.appendChild(mkBtn('btn-crouch', 'CROUCH', 'crouch'));
    cluster.appendChild(mkBtn('btn-action', 'E', null, 'action'));

    const hint = document.createElement('div');
    hint.id = 'look-hint';
    hint.textContent = 'Drag right side to look';

    this.el.appendChild(stickZone);
    this.el.appendChild(cluster);
    this.el.appendChild(hint);
    root.appendChild(this.el);

    this.stickBase = stickBase;
    this.stickKnob = stickKnob;
    this.stickZone = stickZone;

    this._onStickStart = this._onStickStart.bind(this);
    this._onStickMove = this._onStickMove.bind(this);
    this._onStickEnd = this._onStickEnd.bind(this);
    this._onLookStart = this._onLookStart.bind(this);
    this._onLookMove = this._onLookMove.bind(this);
    this._onLookEnd = this._onLookEnd.bind(this);
    this._onBtnDown = this._onBtnDown.bind(this);
    this._onBtnUp = this._onBtnUp.bind(this);

    this.stickZone.addEventListener('pointerdown', this._onStickStart);
    window.addEventListener('pointermove', this._onStickMove);
    window.addEventListener('pointerup', this._onStickEnd);
    window.addEventListener('pointercancel', this._onStickEnd);

    // Look only while gameplay controls are shown
    this.el.addEventListener('pointerdown', this._onLookStart);
    window.addEventListener('pointermove', this._onLookMove);
    window.addEventListener('pointerup', this._onLookEnd);
    window.addEventListener('pointercancel', this._onLookEnd);

    this.el.querySelectorAll('.mbtn').forEach((btn) => {
      btn.addEventListener('pointerdown', this._onBtnDown);
      btn.addEventListener('pointerup', this._onBtnUp);
      btn.addEventListener('pointerleave', this._onBtnUp);
      btn.addEventListener('pointercancel', this._onBtnUp);
    });

    this._detect();
    window.addEventListener('resize', () => this._detect());
  }

  _detect() {
    const touch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.innerWidth <= 900;
    this.active = touch || narrow;
    this._syncVisible();
  }

  /** Call when a round starts/ends — keeps menu free of stick overlays */
  setGameplayActive(on) {
    this.gameplay = !!on;
    this._syncVisible();
    if (!on) {
      this._resetStick();
      this.player.setSprint(false);
      this.player.setCrouch(false);
      this.player.setSneak(false);
    }
  }

  _syncVisible() {
    const show = this.active && this.gameplay;
    this.el.classList.toggle('visible', show);
    this.el.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (!show) this._resetStick();
  }

  setVisible(on) {
    // Back-compat: treat as gameplay visibility only when device is mobile
    if (on) this.setGameplayActive(true);
    else this.setGameplayActive(false);
  }

  _resetStick() {
    this._stickId = null;
    this.player.setMoveAxis(0, 0);
    if (this.stickKnob) {
      this.stickKnob.style.transform = 'translate(-50%, -50%)';
    }
  }

  _onStickStart(e) {
    if (!this.active || !this.gameplay) return;
    e.preventDefault();
    e.stopPropagation();
    this._stickId = e.pointerId;
    this.stickZone.setPointerCapture?.(e.pointerId);
    this._updateStick(e);
  }

  _onStickMove(e) {
    if (this._stickId !== e.pointerId) return;
    e.preventDefault();
    this._updateStick(e);
  }

  _onStickEnd(e) {
    if (this._stickId !== e.pointerId) return;
    this._resetStick();
  }

  _updateStick(e) {
    const rect = this.stickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    if (len > maxR) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
    }
    this.stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.player.setMoveAxis(dx / maxR, -dy / maxR);
  }

  _isHudControl(t) {
    return (
      t &&
      (t.closest?.('#mobile-controls') ||
        t.closest?.('.overlay') ||
        t.closest?.('button') ||
        t.closest?.('a'))
    );
  }

  _onLookStart(e) {
    if (!this.active || !this.gameplay || !this.player.enabled) return;
    if (this._isHudControl(e.target)) return;
    // Right half for look
    if (e.clientX < window.innerWidth * 0.42) return;
    if (this._lookId != null) return;
    this._lookId = e.pointerId;
    this._lookLast = { x: e.clientX, y: e.clientY };
  }

  _onLookMove(e) {
    if (this._lookId !== e.pointerId || !this._lookLast) return;
    const dx = e.clientX - this._lookLast.x;
    const dy = e.clientY - this._lookLast.y;
    this._lookLast = { x: e.clientX, y: e.clientY };
    this.player.applyLookDelta(dx, dy);
  }

  _onLookEnd(e) {
    if (this._lookId !== e.pointerId) return;
    this._lookId = null;
    this._lookLast = null;
  }

  _onBtnDown(e) {
    if (!this.gameplay) return;
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget;
    btn.classList.add('active');
    const hold = btn.dataset.hold;
    const tap = btn.dataset.tap;
    if (hold === 'sneak') this.player.setSneak(true);
    if (hold === 'crouch') this.player.setCrouch(true);
    if (hold === 'sprint') this.player.setSprint(true);
    if (tap === 'action') this.player.tryInteract();
    btn.setPointerCapture?.(e.pointerId);
  }

  _onBtnUp(e) {
    const btn = e.currentTarget;
    btn.classList.remove('active');
    const hold = btn.dataset.hold;
    if (hold === 'sneak') this.player.setSneak(false);
    if (hold === 'crouch') this.player.setCrouch(false);
    if (hold === 'sprint') this.player.setSprint(false);
  }
}
