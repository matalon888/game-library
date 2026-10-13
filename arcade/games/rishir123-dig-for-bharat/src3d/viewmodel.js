/* ============================================================
   What you are holding. Rendered in a second pass with the depth
   buffer cleared, so a trowel never pokes through a trench wall.
   ============================================================ */
import * as THREE from "three";

const wood  = new THREE.MeshStandardMaterial({ color: 0x8a5f36, roughness: 0.78 });
const steel = new THREE.MeshStandardMaterial({ color: 0xd2d6dc, roughness: 0.38, metalness: 0.72 });
const iron  = new THREE.MeshStandardMaterial({ color: 0x4a4642, roughness: 0.55, metalness: 0.75 });
const brass = new THREE.MeshStandardMaterial({ color: 0xc59b4a, roughness: 0.34, metalness: 0.9 });
const bristle = new THREE.MeshStandardMaterial({ color: 0xd8c69a, roughness: 0.95 });
const casing = new THREE.MeshStandardMaterial({ color: 0x3f4a46, roughness: 0.6, metalness: 0.2 });

function trowel() {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.0001, 0.052, 0.20, 3), steel);
  blade.rotation.set(Math.PI / 2, 0, 0); blade.scale.set(1.25, 1, 0.30);
  blade.position.set(0, 0, -0.10);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.07, 8), steel);
  neck.rotation.x = 1.25; neck.position.set(0, 0.022, 0.02);
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, 0.085, 4, 10), wood);
  handle.rotation.x = 1.35; handle.position.set(0, 0.05, 0.10);
  g.add(blade, neck, handle);
  return g;
}
function pick() {
  const g = new THREE.Group();
  const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.021, 0.52, 10), wood);
  haft.rotation.set(1.15, 0, 0.12); haft.position.set(0.01, -0.04, 0.10);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, 0.30), iron);
  head.position.set(0, 0.20, -0.06); head.rotation.x = 0.16;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.13, 6), iron);
  tip.rotation.set(Math.PI / 2 + 0.16, 0, 0); tip.position.set(0, 0.208, -0.26);
  const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.06, 10), iron);
  eye.position.set(0, 0.20, -0.02);
  g.add(haft, head, tip, eye);
  return g;
}
function brush() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.17, 10), wood);
  handle.rotation.x = 1.35; handle.position.set(0, 0.02, 0.06);
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.016, 0.045, 10), brass);
  ferrule.rotation.x = 1.35; ferrule.position.set(0, -0.007, -0.05);
  const hairs = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.020, 0.075, 10), bristle);
  hairs.rotation.x = 1.35; hairs.position.set(0, -0.021, -0.115);
  g.add(handle, ferrule, hairs);
  return g;
}
function magnetometer() {
  const g = new THREE.Group();
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.46, 8), casing);
  staff.rotation.x = 1.30; staff.position.set(0, -0.01, 0.02);
  const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.13, 12), casing);
  sensor.rotation.x = 1.30; sensor.position.set(0, -0.09, -0.21);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.055, 0.028), casing);
  box.position.set(0, 0.075, 0.11); box.rotation.x = 0.30;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.032),
    new THREE.MeshBasicMaterial({ color: 0x5cc7a6 }));
  screen.position.set(0, 0.079, 0.126); screen.rotation.x = 0.30;
  g.add(staff, sensor, box, screen);
  return g;
}

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(46, 1, 0.01, 12);
    this.cam.position.set(0, 0, 0);

    const key = new THREE.DirectionalLight(0xfff0d8, 2.6); key.position.set(-0.6, 1, 0.8);
    const fill = new THREE.DirectionalLight(0x9fc0e0, 0.9); fill.position.set(0.9, -0.2, 0.4);
    const amb = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(key, fill, amb);

    this.anchor = new THREE.Group();
    this.anchor.position.set(0.255, -0.185, -0.56);
    this.anchor.rotation.set(0.46, -0.58, 0.14);
    this.anchor.scale.setScalar(0.88);
    this.scene.add(this.anchor);

    this.tools = { trowel: trowel(), pick: pick(), brush: brush(), survey: magnetometer() };
    for (const k in this.tools) { this.tools[k].visible = false; this.anchor.add(this.tools[k]); }

    this.current = "trowel";
    this.tools.trowel.visible = true;
    this.swingT = 1; this.swingPower = 1;
    this.sway = new THREE.Vector2();
    this.t = 0;
  }

  /* Metals are pure reflection — with nothing to reflect they render black,
     so the held tools need the same environment the world uses. */
  setEnvironment(tex) {
    this.scene.environment = tex;
    this.scene.environmentIntensity = 1.0;
  }

  setTool(name) {
    if (!this.tools[name] || name === this.current) return;
    this.tools[this.current].visible = false;
    this.current = name;
    this.tools[name].visible = true;
    this.swingT = 0.55; this.swingPower = 0.45;      // a small raise on swap
  }
  swing(power = 1) { this.swingT = 0; this.swingPower = power; }

  update(dt, opts = {}) {
    this.t += dt;
    if (this.swingT < 1) this.swingT = Math.min(1, this.swingT + dt / (this.swingPower > 0.8 ? 0.30 : 0.22));

    const s = this.swingT < 1 ? Math.sin(Math.PI * this.swingT) : 0;
    const idle = Math.sin(this.t * 1.6) * 0.006, idle2 = Math.cos(this.t * 1.1) * 0.005;
    const bob = (opts.bob || 0) * 0.9;

    /* the tool lags behind the mouse a little */
    const look = opts.look || { x: 0, y: 0 };
    this.sway.x += (look.x * 0.035 - this.sway.x) * Math.min(1, dt * 9);
    this.sway.y += (look.y * 0.035 - this.sway.y) * Math.min(1, dt * 9);

    const a = this.anchor;
    a.position.set(0.255 + this.sway.x + idle2, -0.185 + bob + idle - s * 0.10 * this.swingPower,
                   -0.56 + s * 0.17 * this.swingPower);
    a.rotation.set(0.46 - s * 1.15 * this.swingPower + this.sway.y,
                   -0.58 + this.sway.x * 1.5, 0.14 + s * 0.18 * this.swingPower);
  }

  render(renderer) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.cam);
    renderer.autoClear = true;
  }
  resize(aspect) { this.cam.aspect = aspect; this.cam.updateProjectionMatrix(); }
}
