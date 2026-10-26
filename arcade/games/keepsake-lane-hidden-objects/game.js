// Keepsake Lane: Hidden Objects — original hidden-object game in richly furnished 3D rooms of Nana Pearl's house.
// Turn and zoom each room, find the objects on the list (names or silhouettes), recover a family keepsake per scene.
// Furniture + findables: the AI 3D library (assets/, copied from assets/cozy/web). Nana: a Hero Lab character.
// Rooms, textures, light, UI, sound and code are original.
import { THREE, createUI, store, loop, buzz, confetti, burst, clamp, lerp } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { heroBar, selectedHero, loadHero, onHeroesChange } from './kit/heroes.js';
import * as RM from './room.js';
import * as SND from './sound.js';

const NAME = 'Keepsake Lane: Hidden Objects';
const Q = new URLSearchParams(location.search);
const S = store('keepsake');
const F = flow('keepsake-lane');
const BASE = new URL('./', import.meta.url).href;

// ---------------------------------------------------------------- data
// findables: id, list name, size (largest side in metres before the level scale)
const KINDS = [
  ['t01', 'Apple', 0.13], ['t02', 'Banana', 0.2], ['t03', 'Strawberry', 0.11], ['t04', 'Watermelon', 0.18], ['t06', 'Lemon', 0.12], ['t07', 'Avocado', 0.14], ['t08', 'Rubber Duck', 0.15],
  ['f01', 'Cappuccino', 0.15], ['f02', 'Croissant', 0.19], ['f03', 'Pancakes', 0.2], ['f04', 'Donut', 0.16], ['f05', 'Macarons', 0.15], ['f06', 'Chocolate Cake', 0.18], ['f07', 'Milkshake', 0.26],
  ['f08', 'Bubble Tea', 0.22], ['f09', 'Sandwich', 0.18], ['f15', 'Smoothie Jar', 0.19], ['f16', 'Waffle', 0.19], ['f17', 'Cinnamon Roll', 0.15],
  ['g01', 'Sprout', 0.15], ['g02', 'Seedling', 0.17], ['g03', 'Daisy Pot', 0.21], ['g04', 'Tulips', 0.26], ['g07', 'Tea Leaf', 0.14], ['g08', 'Tea Bag', 0.14], ['g09', 'Teacup', 0.17],
  ['g10', 'Teapot', 0.25], ['g11', 'Tea Stand', 0.32], ['g13', 'Cupcake', 0.14], ['g14', 'Cake Slice', 0.17], ['g15', 'Strawberry Cake', 0.25], ['g17', 'Garden Basket', 0.27],
  ['g18', 'Gold Chest', 0.21], ['m08', 'Disco Ball', 0.17], ['m09', 'Toy Rocket', 0.22], ['m10', 'Pinwheel', 0.24],
].map(([id, name, size]) => ({ id, name, size }));
const KIND = Object.fromEntries(KINDS.map(k => [k.id, k]));
const FURN = ['h01', 'h02', 'h03', 'h04', 'h05', 'h06', 'h07', 'h08', 'h09', 'h10', 'h11', 'h12', 'h13', 'h14', 'h15', 'h16', 'h17', 'h20', 'h21', 'h22', 'h23', 'h25', 'h26', 'h27', 'h34', 'h35'];

const W0 = 6, D0 = 5, H0 = 4.3, CEIL = 3.1;   // tall walls (picture rail at 3.1) so the phone view never shows a band above the room
const P2 = Math.PI / 2;
// room layouts. m: model (h = height | w = width | s = largest side), wall: snap against that wall; c: code-built decor
const ROOMS = [
  { key: 'parlour', name: 'The Front Parlour', W: W0, D: D0, H: H0, floor: { kind: 'wood', color: '#c98f55' },
    wall: { kind: 'damask', bg: '#d3e3c4', fg: '#aecb9b', ac: '#eab8a6' }, wain: '#f3ead8', trim: '#6e4426', curtain: '#e8a0a9',
    windows: [{ wall: 'back', at: 1.35, w: 1.2, h: 1.45, y: 0.95 }], sun: [0.18, -0.62, 0.76], nana: [1.95, 1.45, -0.7],
    items: [
      { c: 'console', x: 1.35, z: -2.27, w: 1.1, d: 0.36, h: 0.74, color: '#7a4b2c' }, { c: 'ottoman', x: -0.85, z: 1.25, r: 0.3, h: 0.4, color: '#c9667e' },
      { c: 'plant', x: 2.6, z: 2.05, h: 0.85, pot: '#e6b34a', seed: 4 }, { c: 'umbrella', x: -2.65, z: 2.1 }, { c: 'books', x: -0.55, z: -1.75, n: 5, seed: 11 },
      { c: 'stool', x: -2.55, z: 0.15, h: 0.46, color: '#8a5530' }, { c: 'hatbox', x: 2.2, z: -1.6, r: 0.17, h: 0.2, color: '#f2c46b' },
      { m: 'h09', x: -1.0, wall: 'back', h: 1.35 }, { m: 'h16', x: -1.0, y: 1.6, wall: 'back', h: 0.78, hang: true }, { m: 'h10', x: 0.25, wall: 'back', h: 2.05 },
      { m: 'h07', z: -0.95, wall: 'left', h: 2.15 }, { m: 'h05', x: -2.45, z: -2.0, h: 1.3 }, { m: 'h02', x: -1.75, z: 0.55, ry: 0.75, h: 1.05 },
      { m: 'h03', x: 0.25, z: 0.25, w: 0.95 }, { m: 'h01', z: -0.25, wall: 'right', w: 1.95 }, { m: 'h04', x: 2.55, z: -2.05, h: 1.75 },
      { c: 'table', x: -2.35, z: 1.45, r: 0.3, h: 0.62, color: '#8a5530', cloth: '#f4e1c8' }, { m: 'h15', x: -2.35, z: 1.45, y: 0.645, ry: 0.6, h: 0.55 },
      { c: 'rug', x: 0.3, z: 0.15, w: 3.1, d: 2.2, cols: ['#b8485a', '#f2d7a8', '#2f5f7a'], key: 'p' },
      { c: 'shelf', x: 2.9, y: 1.72, z: -0.25, ry: -P2, w: 1.4 }, { c: 'shelf', x: 2.4, y: 1.55, z: -2.38, ry: 0, w: 0.8 },
      { c: 'frame', x: -2.92, y: 1.85, z: 0.75, ry: P2, w: 0.6, h: 0.75, k: 2 }, { c: 'frame', x: 1.35, y: 2.75, z: -2.4, ry: 0, w: 0.5, h: 0.32, k: 3 },
      { c: 'sconce', x: -2.1, y: 1.9, z: -2.47, ry: 0 }, { c: 'basket', x: -0.15, z: -1.9 },
      { c: 'light', x: 2.55, y: 1.62, z: -2.05, color: '#ffcf8a', i: 3.2, d: 5 }, { c: 'light', x: -1.0, y: 0.45, z: -1.85, color: '#ff9a4a', i: 2.4, d: 3.5, flicker: true },
    ] },
  { key: 'tearoom', name: 'The Sunny Tea Room', W: W0, D: D0, H: H0, floor: { kind: 'tile', a: '#f4ead6', b: '#d6907a' },
    wall: { kind: 'stripe', bg: '#fbe9b7', fg: '#f6d98a', ac: '#e98fa0' }, wain: '#fdf7ea', trim: '#7d5232', curtain: '#9fd0c4',
    windows: [{ wall: 'back', at: 0, w: 1.3, h: 1.35, y: 0.95, arch: true }, { wall: 'right', at: -0.7, w: 1.0, h: 1.35, y: 0.95 }], sun: [-0.32, -0.6, 0.73], nana: [-1.9, 1.5, 0.7],
    items: [
      { c: 'cabinet', x: 1.45, z: -2.27, w: 0.9, h: 0.85, d: 0.42, color: '#d9efe6' }, { c: 'stool', x: -1.45, z: -0.7, h: 0.48, color: '#fffaf0' },
      { c: 'plant', x: -2.6, z: 0.65, h: 0.8, pot: '#6fa8c9', seed: 6 }, { c: 'hatbox', x: 2.55, z: 0.75, r: 0.18, h: 0.22, color: '#f6b7c3' }, { c: 'hatbox', x: 2.55, z: 0.75, y: 0.25, r: 0.14, h: 0.16, color: '#9fd0c4' },
      { c: 'console', x: 1.35, z: 1.95, w: 1.0, d: 0.38, h: 0.7, color: '#c98f55' }, { c: 'books', x: 1.0, z: -1.2, n: 4, seed: 5 },
      { m: 'h14', x: 0.1, z: 0.2, w: 2.0 }, { m: 'h12', x: -1.85, wall: 'back', h: 1.0 }, { m: 'h06', x: 2.45, z: -2.0, h: 1.65 },
      { m: 'h20', z: -0.7, wall: 'left', w: 1.5 }, { m: 'h17', x: 0.1, z: 0.2, hangTop: true, h: 0.8 }, { m: 'h16', x: 1.75, y: 1.45, wall: 'back', h: 0.7, hang: true },
      { m: 'h05', x: 2.5, z: 1.55, h: 1.15 }, { m: 'h04', x: -2.55, z: 1.95, h: 1.7 },
      { c: 'table', x: 1.75, z: -1.75, r: 0.3, h: 0.66, color: '#fffaf0', cloth: '#f6b7c3' }, { c: 'shelf', x: -1.85, y: 1.75, z: -2.38, ry: 0, w: 1.2 }, { c: 'shelf', x: 2.9, y: 1.55, z: 0.9, ry: -P2, w: 1.1 },
      { c: 'rug', x: 0.1, z: 0.2, w: 3.0, d: 2.4, cols: ['#3f7d74', '#f4e3c3', '#e2836f'], key: 't' }, { c: 'frame', x: -2.92, y: 2.15, z: -0.7, ry: P2, w: 0.7, h: 0.5, k: 1 },
      { c: 'basket', x: 1.0, z: -2.1 }, { c: 'light', x: 0.1, y: 2.1, z: 0.2, color: '#ffd9a0', i: 2.6, d: 5 },
    ] },
  { key: 'music', name: 'The Music Room', W: W0, D: D0, H: H0, floor: { kind: 'wood', color: '#a8714a', key: 'm' },
    wall: { kind: 'trellis', bg: '#cfe1f1', fg: '#9fbfdc', ac: '#f2c46b' }, wain: '#eef1f6', trim: '#5a3a24', curtain: '#f2c46b',
    windows: [{ wall: 'back', at: -1.45, w: 1.1, h: 1.5, y: 0.95 }, { wall: 'left', at: -0.6, w: 0.9, h: 1.3, y: 0.95, arch: true }], sun: [0.45, -0.6, 0.66], nana: [2.15, 1.6, -0.6],
    items: [
      { c: 'cabinet', x: 2.3, z: -2.27, w: 0.9, h: 0.9, d: 0.42, color: '#3f5f85', wood: '#5a3a24' }, { c: 'ottoman', x: -0.85, z: 1.4, r: 0.28, h: 0.38, color: '#f2c46b' },
      { c: 'stool', x: 0.75, z: -1.3, h: 0.46, color: '#3b2a20' }, { c: 'plant', x: -2.6, z: 1.95, h: 0.9, pot: '#e77c93', seed: 8 }, { c: 'umbrella', x: -1.2, z: -2.25 },
      { c: 'books', x: 1.15, z: 1.75, n: 5, seed: 9 }, { c: 'hatbox', x: 2.6, z: 0.15, r: 0.17, h: 0.2, color: '#c8504a' },
      { m: 'h20', x: 0.75, wall: 'back', w: 1.6 }, { m: 'h16', x: 0.75, y: 1.95, wall: 'back', h: 0.7, hang: true }, { m: 'h10', x: -0.45, wall: 'back', h: 2.0 },
      { m: 'h07', z: -1.05, wall: 'right', h: 2.15 }, { m: 'h02', x: 1.55, z: 0.75, ry: -0.7, h: 1.05 }, { m: 'h03', x: 0.1, z: 0.6, w: 0.9 },
      { m: 'h06', x: -2.45, z: 0.75, h: 1.6 }, { m: 'h21', x: -1.5, z: -1.85, ry: 0.25, w: 0.9 }, { m: 'h17', x: 0.2, z: -0.1, hangTop: true, h: 0.85 },
      { c: 'table', x: -2.35, z: -1.95, r: 0.28, h: 0.62, color: '#6d4127' }, { m: 'h15', x: -2.35, z: -1.95, y: 0.645, ry: 0.5, h: 0.55 },
      { c: 'rug', x: 0.3, z: 0.4, w: 3.0, d: 2.3, cols: ['#2c4f7c', '#f3d38d', '#c8504a'], key: 'm' }, { c: 'shelf', x: 2.9, y: 2.3, z: 0.75, ry: -P2, w: 1.0 },
      { c: 'shelf', x: -2.9, y: 1.7, z: 1.3, ry: P2, w: 1.0 }, { c: 'frame', x: 2.9, y: 1.7, z: 1.35, ry: -P2, w: 0.55, h: 0.7, k: 0 },
      { c: 'sconce', x: -1.9, y: 1.95, z: -2.47, ry: 0 }, { c: 'sconce', x: 2.1, y: 1.95, z: -2.47, ry: 0 },
      { c: 'light', x: 0.2, y: 2.15, z: -0.1, color: '#ffd9a0', i: 2.4, d: 5 },
    ] },
  { key: 'bedroom', name: "Nana's Bedroom", W: W0, D: D0, H: H0, floor: { kind: 'wood', color: '#d6a476', key: 'b' },
    wall: { kind: 'floral', bg: '#fbe1e4', fg: '#8fbf9a', ac: '#e77c93' }, wain: '#fff8f2', trim: '#7a4e2d', curtain: '#f7f0e6',
    windows: [{ wall: 'left', at: 0.25, w: 1.15, h: 1.4, y: 0.95 }], sun: [0.78, -0.58, 0.22], nana: [1.6, 1.6, -0.5],
    items: [
      { c: 'console', x: -2.78, z: -0.25, ry: P2, w: 1.0, d: 0.36, h: 0.7, color: '#fffaf0' }, { c: 'stool', x: 2.05, z: 0.55, h: 0.44, color: '#f2c4cf' },
      { c: 'hatbox', x: 2.1, z: -0.45, r: 0.18, h: 0.22, color: '#9fd0c4' }, { c: 'hatbox', x: 2.1, z: -0.45, y: 0.25, r: 0.14, h: 0.15, color: '#f6b7c3' },
      { c: 'plant', x: -2.6, z: 2.05, h: 0.8, pot: '#e6b34a', seed: 12 }, { c: 'ottoman', x: 0.75, z: 0.2, r: 0.26, h: 0.38, color: '#9fbfdc' }, { c: 'books', x: -1.6, z: -1.6, n: 4, seed: 2 },
      { m: 'h11', x: -0.35, wall: 'back', w: 1.95 }, { m: 'h12', z: -1.25, wall: 'right', h: 1.05 }, { m: 'h13', z: 0.55, wall: 'right', h: 1.35 },
      { m: 'h21', x: -0.35, z: -0.55, w: 0.85 }, { m: 'h04', x: -2.5, z: -2.05, h: 1.65 }, { m: 'h05', x: 2.55, z: -2.15, h: 1.1 },
      { c: 'table', x: -1.65, z: -2.1, r: 0.24, h: 0.58, color: '#fffaf0' }, { c: 'table', x: 1.0, z: -2.1, r: 0.24, h: 0.58, color: '#fffaf0' },
      { m: 'h08', x: -0.3, z: 0.6, w: 2.3 }, { m: 'h10', z: 1.55, wall: 'left', h: 1.9 }, { m: 'h16', z: -1.35, y: 1.55, wall: 'left', h: 0.62, hang: true },
      { c: 'shelf', x: 1.95, y: 1.75, z: -2.38, ry: 0, w: 1.0 }, { c: 'frame', x: 1.95, y: 2.35, z: -2.42, ry: 0, w: 0.55, h: 0.42, k: 3 },
      { c: 'basket', x: 0.8, z: 0.9 }, { c: 'light', x: -2.5, y: 1.55, z: -2.05, color: '#ffcf8a', i: 3.0, d: 5 },
    ] },
  { key: 'attic', name: 'The Dusty Attic', W: W0, D: D0, H: 4.1, floor: { kind: 'wood', color: '#9c6b44', key: 'a' },
    wall: { kind: 'planks', bg: '#c49364', fg: '#000', ac: '#000' }, wain: null, trim: '#5b3820', trimLight: '#d9b78c', curtain: '#c9b38a',
    windows: [{ wall: 'back', at: 0.1, w: 0.9, h: 0.75, y: 1.45, arch: true }], sun: [0.1, -0.55, 0.83], nana: [-2.05, 1.55, 0.7],
    items: [
      { c: 'crate', x: 0.65, z: -2.15, s: 0.55 }, { c: 'crate', x: 0.62, z: -2.15, y: 0.44, s: 0.42, ry: 0.4, color: '#c9a070' }, { c: 'crate', x: -2.45, z: 1.0, s: 0.55, ry: 0.3 },
      { c: 'hatbox', x: 2.55, z: 0.95, r: 0.18, h: 0.22, color: '#f2c46b' }, { c: 'umbrella', x: -0.9, z: 2.05 }, { c: 'stool', x: 1.2, z: -0.2, h: 0.46 },
      { c: 'books', x: -1.0, z: -1.2, n: 6, seed: 4 }, { c: 'books', x: 2.0, z: -1.95, n: 3, seed: 8 }, { c: 'plant', x: -2.55, z: -0.95, h: 0.7, pot: '#9c6b44', seed: 2 },
      { m: 'h21', x: -1.55, z: -1.85, ry: 0.2, w: 1.05 }, { m: 'h12', z: 0.15, wall: 'left', h: 1.0 }, { m: 'h07', z: -1.25, wall: 'right', h: 2.0 },
      { m: 'h13', x: 1.75, wall: 'back', h: 1.3 }, { m: 'h10', z: -1.45, wall: 'left', h: 1.85 }, { m: 'h02', x: 1.45, z: 0.65, ry: -0.85, h: 1.0 },
      { c: 'table', x: -0.3, z: 0.75, r: 0.32, h: 0.6, color: '#7a4b2c' }, { m: 'h15', x: -0.3, z: 0.75, y: 0.625, ry: -0.4, h: 0.5 },
      { m: 'h03', x: 0.35, z: -0.85, w: 0.85 }, { m: 'h06', x: 2.5, z: 1.6, h: 1.4 }, { m: 'h04', x: -0.5, z: -2.15, h: 1.6 },
      { c: 'rug', x: 0.2, z: 0.1, w: 2.6, d: 2.0, cols: ['#7d3b3b', '#e8c98a', '#2b4a5c'], key: 'a' }, { c: 'shelf', x: 2.9, y: 1.55, z: 0.7, ry: -P2, w: 1.0 },
      { c: 'shelf', x: -1.55, y: 1.6, z: -2.38, ry: 0, w: 1.1 }, { c: 'frame', x: 2.9, y: 2.05, z: 0.7, ry: -P2, w: 0.5, h: 0.38, k: 1 },
      { c: 'light', x: -0.5, y: 1.45, z: -2.1, color: '#ffc77a', i: 2.4, d: 4.5 },
    ] },
  { key: 'garden', name: 'The Garden Terrace', W: W0, D: D0, H: H0, outdoor: true, floor: { kind: 'stone' }, trim: '#8c7a62',
    sun: [0.35, -0.75, 0.56], nana: [-2.1, 1.65, 0.6],
    items: [
      { c: 'stool', x: -0.85, z: -0.2, h: 0.45, color: '#f7f3ea' }, { c: 'stool', x: -1.85, z: -0.05, h: 0.45, color: '#f7f3ea' }, { c: 'plant', x: -0.2, z: 1.85, h: 0.75, pot: '#d9774b', seed: 14 },
      { c: 'plant', x: 2.55, z: 1.9, h: 0.9, pot: '#6fa8c9', seed: 15 }, { c: 'crate', x: 0.6, z: 1.95, s: 0.45 }, { c: 'hatbox', x: 0.6, z: 1.95, y: 0.36, r: 0.15, h: 0.18, color: '#f6b7c3' },
      { m: 'h23', x: 0.2, z: -0.95, w: 1.45 }, { m: 'h22', x: -1.7, z: -1.95, w: 1.5 }, { m: 'h25', x: 1.85, z: -1.75, w: 1.6 },
      { m: 'h26', x: -2.5, z: -2.15, h: 1.15 }, { m: 'h27', x: 2.55, z: 0.45, h: 0.95 }, { m: 'h26', x: -2.55, z: 0.75, h: 0.9, ry: 1.3 },
      { m: 'h34', x: -1.1, z: 0.65, h: 0.9 }, { m: 'h35', x: 1.5, z: 1.15, ry: -0.9, s: 1.15 }, { m: 'h05', x: 0.95, z: -2.2, h: 1.0 },
      { m: 'h06', x: -0.55, z: -2.2, h: 1.25 }, { c: 'table', x: -1.35, z: -0.45, r: 0.3, h: 0.66, color: '#f7f3ea' }, { c: 'basket', x: 0.4, z: 0.6 },
      { m: 'h27', x: 2.6, z: -0.6, h: 0.8, ry: 2 },
    ] },
];
const CHAPTERS = ['parlour', 'tearoom', 'music', 'bedroom', 'attic', 'garden'];
const PER = 6, STORY_LEVELS = CHAPTERS.length * PER;
// the story: Nana Pearl's lines (chapter intros) and the keepsake each scene recovers
const INTRO = [
  "Welcome home, dear! The parlour is full of memories. Help me find what I've misplaced?",
  "Tea time! I hid something special in the tea room years ago. Let's look together.",
  "Grandpa played this piano every Sunday. His music things are hiding everywhere.",
  "My bedroom! Mind the clutter, love. Old letters, old treasures, old me.",
  "Up to the attic! Dusty, yes, but the best stories are kept up here.",
  "And at last, the garden. Grandpa planted every rose. Let's finish our album out here.",
];
const KEEPSAKES = [
  ["Grandpa's pocket watch", 'He was never late. Not once in fifty years.'], ['The wedding photo', 'June 1962. It rained, and we danced anyway.'], ['A silver thimble', 'I sewed every curtain in this house with it.'],
  ['The first love letter', 'Three pages, and he misspelled my name twice.'], ['Mum\'s cameo brooch', 'She wore it every Sunday. Now it\'s yours.'], ['The parlour key', 'This room is restored. Thank you, dear!'],
  ['The blue teacup', 'The one cup that survived the great tea party of 1978.'], ['My scone recipe', 'The secret is cold butter and a warm heart.'], ['A tin of sugar cubes', 'For the horse at the end of the lane.'],
  ['The lace doily', 'Crocheted by your great-aunt Ivy.'], ['The silver spoon', 'Every baby in this family ate from it.'], ['The tea room key', 'Let\'s have a cuppa to celebrate!'],
  ['Grandpa\'s sheet music', 'He wrote this waltz for me. Listen, it\'s playing now.'], ['The tuning fork', 'Middle A. He tuned everything, even the doorbell.'], ['A dance card', 'Every line says the same name.'],
  ['The music box', 'Wind it up. Still plays after sixty years.'], ['A concert ticket', 'Row F, seats 9 and 10. Our first date.'], ['The music room key', 'Grandpa would be so proud.'],
  ['My hair ribbon', 'Pink silk. I wore it to the summer fair.'], ['A pressed rose', 'From the very first bush he planted.'], ['The diary', 'Shh. Some pages are just for me.'],
  ['Pearl earrings', 'Where do you think my name came from?'], ['Baby\'s first shoe', 'Your mother\'s. So tiny!'], ['The bedroom key', 'Sweet dreams, little room.'],
  ['The old compass', 'Grandpa\'s, from his sailing days.'], ['A tin soldier', 'Your uncle lost the other eleven.'], ['The family quilt', 'Every square is a different year.'],
  ['A postcard from Lisbon', 'Our honeymoon. Yellow trams and custard tarts.'], ['The toy train', 'It still goes round, if you push it.'], ['The attic key', 'Nothing up here is lost anymore.'],
  ['Grandpa\'s trowel', 'Worn smooth from forty springs.'], ['The seed tin', 'Sweet peas, saved every autumn.'], ['A garden gnome', 'His name is Gerald. Don\'t ask.'],
  ['The swing rope', 'Your mother learned to fly right here.'], ['The rose label', '"Pearl", he named the pink one after me.'], ['The house key', 'The whole house remembers now. Thank you, my love.'],
];

// ---------------------------------------------------------------- renderer, scene, post
const LITE = Q.has('lite') || (Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5);
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const bgTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#ffe9cf'); g.addColorStop(0.6, '#fbd3c0'); g.addColorStop(1, '#e8b7b0'); x.fillStyle = g; x.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const skyTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#7cc4ff'); g.addColorStop(0.6, '#cfeaff'); g.addColorStop(1, '#fff1d6'); x.fillStyle = g; x.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
scene.background = bgTex;
const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 80);
const C = cine(R, scene, cam, { bloom: 0.22, bloomThreshold: 0.92, bloomRadius: 0.45, exposure: 1.0, envIntensity: 0.5, lite: LITE, grade: { sat: 1.15, contrast: 1.05, vignette: 0.1, grain: 0 } });
if (C.lite) R.shadowMap.type = THREE.PCFShadowMap;
R.shadowMap.autoUpdate = false; R.info.autoReset = false;           // the rooms are static: shadows are drawn once per scene
const hemi = new THREE.HemisphereLight('#fff4e2', '#b48a6a', 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffd9a0', 3.4); sun.castShadow = true; sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -5.5, right: 5.5, top: 5.5, bottom: -5.5, near: 1, far: 30 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#ffe6cc', 0.55); fill.position.set(-2, 5, 8); scene.add(fill);   // soft front fill, no shadow

// ---------------------------------------------------------------- UI
const ui = createUI({ title: 'Keepsake<br>Lane', hint: 'Tap to play', hand: '', progress: false, score: false });
ui.els.start.id = 'ks-start';
const D = daily('keepsake-lane', ui, { name: NAME });
const B = board({ game: 'keepsake-lane', label: 'Stars', limits: { maxRun: 3, maxPerSec: 1 }, mode: 'sum', corner: 'tl', accent: '#ffb347' });
const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const startSub = $(`<div class="ks-sub">Hidden Objects</div>`); ui.els.start.querySelector('h1').after(startSub);
const startInfo = $(`<div class="ks-startinfo"><div class="ks-chap"></div><div class="ks-stars"></div></div>`); startSub.after(startInfo);
const startBtns = $(`<div class="ks-startbtns"><button class="ks-btn ks-map">📖 Journey</button><button class="ks-btn ks-daily">☀️ Daily scene</button></div>`);
ui.els.start.appendChild(startBtns);
const heroWrap = $(`<div class="ks-heroes"></div>`); ui.els.start.appendChild(heroWrap);
const hud = $(`<div class="ks-hud ks-off">
  <div class="ks-timer"><i>⏱</i><b>2:00</b></div>
  <div class="ks-room"></div>
  <div class="ks-score"><i>✦</i><b>0</b></div>
  <button class="ks-mute" aria-label="Sound">🔊</button>
</div>`);
const panel = $(`<div class="ks-panel ks-off">
  <div class="ks-list"></div>
  <div class="ks-tools">
    <button class="ks-hint" aria-label="Hint"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" class="bg"/><circle cx="32" cy="32" r="29" class="fg"/></svg><span>🔍</span><em></em></button>
    <button class="ks-glass" aria-label="Add time"><span>⏳</span><em></em></button>
  </div>
</div>`);
const zoomBar = $(`<div class="ks-zoom ks-off"><button data-z="in">＋</button><button data-z="out">－</button></div>`);
const bubble = $(`<div class="ks-bubble ks-off"><img alt="" src="${BASE}assets/hero/thumbs/p05.webp"><div><b>Nana Pearl</b><p></p></div></div>`);
const veil = $(`<div class="ks-veil"><div class="ks-load"><b>Opening Nana's house…</b><i><u></u></i></div></div>`);
const mapEl = $(`<div class="ks-mapwrap" hidden><div class="ks-mapcard"><button class="ks-x">✕</button><h2>Nana's Album</h2><p class="ks-mapsub"></p><div class="ks-chaps"></div></div></div>`);
document.body.append(hud, panel, zoomBar, bubble, mapEl, veil);
const winExtra = $(`<div class="ks-win"><div class="ks-wstars"><i>★</i><i>★</i><i>★</i></div><div class="ks-wscore"></div><div class="ks-keep"><span>🎁</span><div><b></b><p></p></div></div></div>`);
ui.els.win.querySelector('h1').after(winExtra);
ui.els.win.querySelector('h1').textContent = 'Scene cleared!';
ui.els.win.querySelector('p').innerHTML = 'SCENE <span data-l>1</span>';
for (const el of [hud, panel, zoomBar, mapEl, startBtns, bubble]) ['pointerdown', 'pointerup', 'touchstart', 'mousedown', 'wheel'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: ev !== 'wheel' }));
const muteBtn = hud.querySelector('.ks-mute'); const setMuteIcon = () => muteBtn.textContent = SND.isMuted() ? '🔇' : '🔊'; setMuteIcon();
muteBtn.addEventListener('click', () => { SND.setMuted(!SND.isMuted()); setMuteIcon(); });

// ---------------------------------------------------------------- progress (store)
let maxLevel = S.get('max', 1), cur = Math.min(S.get('lvl', 1), maxLevel);
if (+Q.get('lv') > 0) { cur = +Q.get('lv'); maxLevel = Math.max(maxLevel, cur); }   // QA / deep link: open a given scene
let starsBy = S.get('stars', {});            // level → best stars
let lens = S.get('lens', 2), glass = S.get('glass', 1);
const saveProg = () => { S.set('max', maxLevel); S.set('lvl', cur); S.set('stars', starsBy); S.set('lens', lens); S.set('glass', glass); };
const totalStars = () => Object.values(starsBy).reduce((a, b) => a + b, 0);
const chapterOf = n => n <= STORY_LEVELS ? Math.floor((n - 1) / PER) : (n - 1) % CHAPTERS.length;
const isDaily = !!D.seed;

// ---------------------------------------------------------------- assets
const loader = new GLTFLoader();
const TPL = {};
function toFloat(g) {
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k]; if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute && !a.normalized) continue;
    const n = a.itemSize, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { out[i * n] = a.getX(i); if (n > 1) out[i * n + 1] = a.getY(i); if (n > 2) out[i * n + 2] = a.getZ(i); if (n > 3) out[i * n + 3] = a.getW(i); }
    g.setAttribute(k, new THREE.BufferAttribute(out, n));
  }
  return g;
}
async function loadTpl(id) {
  const gl = await loader.loadAsync(`${BASE}assets/${id}.glb`); gl.scene.updateMatrixWorld(true);
  let mesh = null; gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const g = toFloat(mesh.geometry.clone()); g.applyMatrix4(mesh.matrixWorld);
  // the library's optimiser dropped the source's +90° X node rotation (Z-up export), so stand every model back up
  g.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2)); g.computeBoundingBox();
  const bb = g.boundingBox, c = bb.getCenter(new THREE.Vector3()); g.translate(-c.x, -bb.min.y, -c.z); g.computeBoundingBox(); g.computeBoundingSphere();
  const m = mesh.material; m.side = THREE.FrontSide; if (m.map) m.map.anisotropy = 4;
  const size = g.boundingBox.getSize(new THREE.Vector3());
  TPL[id] = { geo: g, mat: m, size };
}
let loaded = 0; const ALL = [...FURN, ...KINDS.map(k => k.id)];
const ready = Promise.all(ALL.map(id => loadTpl(id).then(() => { loaded++; veil.querySelector('u').style.width = (loaded / ALL.length * 100) + '%'; }))).catch(e => console.warn(e));
function inst(id, { h, w, s, d } = {}) {
  const t = TPL[id]; const k = h ? h / t.size.y : w ? w / t.size.x : d ? d / t.size.z : (s || 1) / Math.max(t.size.x, t.size.y, t.size.z);
  const m = new THREE.Mesh(t.geo, t.mat); m.scale.setScalar(k); m.userData.shared = true; m.userData.id = id; m.castShadow = true; m.receiveShadow = true;
  m.userData.dims = t.size.clone().multiplyScalar(k); return m;
}
// detach shared templates before removing so the kit's GPU memory guard never frees a shared geometry/material
const DUMMY_G = new THREE.BufferGeometry(), DUMMY_M = new THREE.MeshBasicMaterial();
function drop(obj) { obj.traverse(o => { if (o.userData.shared) { o.geometry = DUMMY_G; o.material = DUMMY_M; } }); obj.parent && obj.parent.remove(obj); }

// ---------------------------------------------------------------- room
let room = null;     // { def, group, solids, furn, spots, lights, shafts, dust, home }
const ray = new THREE.Raycaster(), V = new THREE.Vector3(), V2 = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
function buildRoom(def) {
  if (room) { drop(room.group); for (const l of room.lights) scene.remove(l); }
  const sunDir = new THREE.Vector3(...def.sun).normalize();
  const shell = RM.buildShell(def, sunDir);
  const group = new THREE.Group(); group.add(shell.group); scene.add(group);
  scene.background = def.outdoor ? skyTex : bgTex;
  hemi.intensity = def.outdoor ? 1.35 : 1.15; sun.intensity = def.outdoor ? 2.6 : 3.4; fill.intensity = def.outdoor ? 0.3 : 0.6;
  sun.position.copy(sunDir).multiplyScalar(-12); sun.target.position.set(0, 0, 0);
  const solids = shell.solids.slice(), furn = [], lights = [], glows = [];
  const { W, D, H } = def;
  for (const it of def.items) {
    if (it.m) {
      const m = inst(it.m, it); const d = m.userData.dims; let x = it.x ?? 0, z = it.z ?? 0, ry = it.ry ?? 0, y = it.y ?? 0;
      if (it.wall === 'back') { z = -D / 2 + d.z / 2 + 0.03; ry = 0; if (it.hang) z = -D / 2 + d.z / 2 * 0.5; }
      if (it.wall === 'left') { x = -W / 2 + d.z / 2 + 0.03; ry = P2; if (it.hang) x = -W / 2 + d.z / 2 * 0.5; }
      if (it.wall === 'right') { x = W / 2 - d.z / 2 - 0.03; ry = -P2; if (it.hang) x = W / 2 - d.z / 2 * 0.5; }
      if (it.hangTop) { y = CEIL - d.y; const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, H - CEIL + 0.05, 6), RM.mat('#b8893a', { metalness: 0.7, roughness: 0.3 })); ch.position.set(x, (H + CEIL) / 2, z); group.add(ch); }
      m.position.set(x, y, z); m.rotation.y = ry; group.add(m); solids.push(m); furn.push(m);
      if (it.m === 'h08') { m.castShadow = false; m.userData.floor = true; }
      continue;
    }
    let o = null;
    if (it.c === 'table') { o = RM.sideTable(it.r, it.h, it.color, it.cloth); o.position.set(it.x, 0, it.z); }
    else if (it.c === 'shelf') { o = RM.wallShelf(it.w); o.position.set(it.x, it.y, it.z); o.rotation.y = it.ry;
      if (it.books !== false) { const bk = RM.rowBooks(it.w * 0.42, Math.round(it.x * 10 + it.y * 7)); bk.position.set(-it.w * 0.26, 0.025, 0.13); o.add(bk); } }
    else if (it.c === 'frame') { o = RM.frame(it.w, it.h, it.k); o.position.set(it.x, it.y, it.z); o.rotation.y = it.ry; }
    else if (it.c === 'rug') { o = RM.rug(it.w, it.d, it.cols, it.key); o.position.set(it.x, 0.009, it.z); o.rotation.y = it.ry || 0; o.userData.floor = true; }
    else if (it.c === 'sconce') { o = RM.sconce(); o.position.set(it.x, it.y, it.z); o.rotation.y = it.ry; addGlow(group, glows, new THREE.Vector3(it.x, it.y + 0.1, it.z + 0.19), 0.5, '#ffd08a'); }
    else if (it.c === 'basket') { o = RM.basket(0.22); o.position.set(it.x, 0, it.z); }
    else if (it.c === 'cabinet') { o = RM.cabinet(it.w, it.h, it.d, it.color, it.wood); o.position.set(it.x, 0, it.z); o.rotation.y = it.ry || 0; }
    else if (it.c === 'console') { o = RM.consoleTable(it.w, it.d, it.h, it.color); o.position.set(it.x, 0, it.z); o.rotation.y = it.ry || 0; }
    else if (it.c === 'ottoman') { o = RM.ottoman(it.r, it.h, it.color); o.position.set(it.x, 0, it.z); }
    else if (it.c === 'plant') { o = RM.pottedPlant(it.h, it.pot, it.leaf, it.seed); o.position.set(it.x, it.y || 0, it.z); }
    else if (it.c === 'crate') { o = RM.crate(it.s, it.color); o.position.set(it.x, it.y || 0, it.z); o.rotation.y = it.ry || 0; }
    else if (it.c === 'stool') { o = RM.stool(it.h, it.color); o.position.set(it.x, 0, it.z); }
    else if (it.c === 'hatbox') { o = RM.hatbox(it.r, it.h, it.color); o.position.set(it.x, it.y || 0, it.z); }
    else if (it.c === 'umbrella') { o = RM.umbrellaStand(); o.position.set(it.x, 0, it.z); }
    else if (it.c === 'books') { o = RM.bookStack(it.n || 4, it.seed || 3); o.position.set(it.x, it.y || 0, it.z); o.rotation.y = it.ry || 0; }
    else if (it.c === 'light') {
      const l = new THREE.PointLight(it.color, it.i, it.d, 1.6); l.position.set(it.x, it.y, it.z); l.userData.flicker = !!it.flicker; l.userData.base = it.i; scene.add(l); lights.push(l);
      addGlow(group, glows, l.position.clone(), it.flicker ? 0.9 : 0.75, it.color); continue;
    }
    if (o) { group.add(o); o.traverse(c => { if (c.isMesh) { solids.push(c); c.castShadow = c.castShadow || false; c.receiveShadow = true; } }); }
  }
  group.updateMatrixWorld(true);
  room = { def, group, solids, furn, lights, glows, walls: shell.walls, shafts: shell.shafts, dust: shell.dust, spots: null, decor: new THREE.Group() };
  group.add(room.decor);
  for (const wg of Object.values(shell.walls || {})) mergeStatic(wg, true);
  mergeStatic(group);
  room.spots = findSpots(def);
  dressDecor(def);
  mergeStatic(room.decor);
  return room;
}
// static code-built pieces share a handful of materials: bake them into one mesh per material (draw calls ÷ 3)
function mergeStatic(root, wallOK = false) {
  root.updateMatrixWorld(true);
  const groups = new Map(), inv = root.matrixWorld.clone().invert(), M4 = new THREE.Matrix4();
  root.traverse(o => {
    if (!o.isMesh || o.userData.merged || (o.userData.inWall && !wallOK) || o.isInstancedMesh || o.userData.shared || o.userData.find || o.userData.noPick || o.userData.floor) return;
    const m = o.material; if (Array.isArray(m) || !m.isMeshStandardMaterial || m.transparent || !o.visible) return;
    const g = o.geometry; if (!g.attributes.uv || !g.attributes.normal) return;
    if (!groups.has(m)) groups.set(m, []); groups.get(m).push(o);
  });
  for (const [m, list] of groups) {
    if (list.length < 2) continue;
    const geos = list.map(o => { let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); g.clearGroups(); g.applyMatrix4(M4.multiplyMatrices(inv, o.matrixWorld)); return g; });
    const mg = mergeGeometries(geos, false); if (!mg) continue;
    geos.forEach(g => g.dispose());
    const mm = new THREE.Mesh(mg, m); mm.castShadow = list.some(o => o.castShadow); mm.receiveShadow = true; mm.userData.merged = true;
    mm.userData.inWall = root.userData.wallSide; root.add(mm);
    for (const o of list) { const i = room.solids.indexOf(o); if (i >= 0) room.solids.splice(i, 1); o.material = DUMMY_M; o.parent.remove(o); }
    room.solids.push(mm);
  }
}
function addGlow(group, glows, p, s, color) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: RM.glowTex(), color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.position.copy(p); sp.scale.setScalar(s); sp.userData.noPick = true; group.add(sp); glows.push(sp);
}
// candidate surfaces for hiding things: rays from the ceiling down through every shelf, seat, table and floor
function findSpots(def) {
  const { W, D, H } = def, out = [], rnd = RM.srand(def.key.length * 977 + 3);
  const nanaP = new THREE.Vector2(def.nana[0], def.nana[1]);
  for (let i = 0; i < 700; i++) {
    const x = (rnd() - 0.5) * (W - 0.35), z = -D / 2 + 0.18 + rnd() * (D - 0.5);
    if (Math.hypot(x - nanaP.x, z - nanaP.y) < 0.6) continue;
    ray.set(V.set(x, H - 0.05, z), DOWN); ray.far = H + 1;
    const hits = ray.intersectObjects(room.solids, false);
    for (const h of hits) {
      if (!h.face) continue;
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if (n.y < 0.8) continue;
      const fl = !!h.object.userData.floor;
      out.push({ p: h.point.clone(), obj: h.object, floor: fl, fur: !fl });
    }
  }
  return out;
}
// clearance of a spot: room above (headroom) and to the sides (lateral)
function clearance(sp, r) {
  ray.far = 3; ray.set(V.copy(sp.p).add(V2.set(0, 0.01, 0)), UP);
  const up = ray.intersectObjects(room.solids, false)[0]; const head = up ? up.distance : 3;
  let lat = 9; const y = sp.p.y + Math.min(0.08, r * 0.6);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ray.far = r + 0.05; ray.set(V.set(sp.p.x, y, sp.p.z), V2.set(dx, 0, dz)); const h = ray.intersectObjects(room.solids, false)[0]; if (h) lat = Math.min(lat, h.distance); }
  // support: footprint corners must have a surface just below
  let sup = 0; for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ray.far = 0.12; ray.set(V.set(sp.p.x + dx * r * 0.45, sp.p.y + 0.04, sp.p.z + dz * r * 0.45), DOWN); if (ray.intersectObjects(room.solids, false).length) sup++; }
  return { head, lat, sup };
}
// fixed per-room dressing: book stacks, candles, vases on surfaces (same every visit)
function dressDecor(def) {
  const rnd = RM.srand(def.key.length * 131 + 9); let n = 0, tries = 0;
  const want = def.outdoor ? 5 : 13, placed = [];
  while (n < want && tries++ < 300) {
    const sp = room.spots[(rnd() * room.spots.length) | 0]; if (!sp || (sp.floor && rnd() < 0.8)) continue;
    if (placed.some(p => p.distanceTo(sp.p) < 0.5)) continue;
    const c = clearance(sp, 0.12); if (c.head < 0.3 || c.lat < 0.1 || c.sup < 3) continue;
    const k = (rnd() * 4) | 0; let o;
    if (k === 0) o = RM.bookStack(2 + ((rnd() * 3) | 0), n + 1); else if (k === 1) o = RM.candle(0.12 + rnd() * 0.08); else if (k === 2) o = RM.vase(['#6fa8c9', '#e7a7b8', '#9cc98a', '#f2d27a'][(rnd() * 4) | 0], 0.18 + rnd() * 0.1); else o = RM.bookStack(3, n + 7);
    o.position.copy(sp.p); o.rotation.y = rnd() * 6; room.decor.add(o); placed.push(sp.p.clone()); n++;
    o.traverse(c => { if (c.isMesh) room.solids.push(c); });
  }
  room.decor.updateMatrixWorld(true);
  room.decorPts = placed;
}

// ---------------------------------------------------------------- level
let L = null;           // current level: { n, cfg, items:[{kind, mesh, target, found, sil}], ... }
let state = 'ready', score = 0, timeLeft = 0, timeTotal = 0, found = 0, combo = 0, lastFind = -9, misses = [], lockUntil = 0, hintCD = 0, hintMax = 30, runStart = 0, recorded = false;
const rngOf = seed => RM.srand((seed * 2654435761) >>> 0);
function levelCfg(n) {
  const fk = F.k();
  if (isDaily) { const s = D.seed; return { n, room: ROOMS.find(r => r.key === CHAPTERS[s % CHAPTERS.length]), seed: s, list: 9, extra: Math.round(16 * fk), time: Math.round(170 / fk), sil: 'mix', scale: 1.0, daily: true }; }
  const ch = chapterOf(n), step = (n - 1) % PER, encore = n > STORY_LEVELS;
  const list = Math.min(10, 5 + Math.floor((n - 1) / 3));
  const sil = step === 2 || step === 5 ? 'all' : n >= 13 && step % 2 ? 'mix' : 'none';
  const scale = lerp(1.3, 0.95, Math.min(1, (n - 1) / 30)) * (encore ? 0.92 : 1);
  return { n, room: ROOMS.find(r => r.key === CHAPTERS[ch]), seed: n * 7919 + 13, list, extra: Math.round(Math.min(24, 6 + n * 0.6) * fk),
    time: Math.round((45 + list * 13) * (encore ? 0.85 : 1) / fk), sil, scale };
}
function clearLevel() {
  if (!L) return;
  for (const it of L.items) { if (it.hmat) { it.hmat.dispose(); } drop(it.mesh); }
  L = null;
}
function buildLevel(n) {
  clearLevel();
  const cfg = levelCfg(n);
  if (!room || room.def !== cfg.room) buildRoom(cfg.room);
  const rnd = rngOf(cfg.seed);
  // choose kinds: the list + extra decoys (each kind at most once in a scene)
  const pool = KINDS.slice(); for (let i = pool.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const total = Math.min(pool.length, cfg.list + cfg.extra);
  const items = []; const taken = room.decorPts ? room.decorPts.map(p => ({ p, r: 0.12 })) : [];
  homeCam(true);
  const camPos = camPosFor(home.target, home.yaw, home.pitch, home.dist);
  for (let i = 0; i < pool.length && items.length < total; i++) {
    const kind = pool[i], target = items.filter(x => x.target).length < cfg.list;
    const sz = kind.size * cfg.scale * (0.9 + rnd() * 0.2) * 1.35;
    const t = TPL[kind.id], k = sz / Math.max(t.size.x, t.size.y, t.size.z), dims = t.size.clone().multiplyScalar(k), r = Math.max(dims.x, dims.z) / 2;
    let ok = null;
    for (let tries = 0; tries < 90 && !ok; tries++) {
      const sp = room.spots[(rnd() * room.spots.length) | 0];
      const w = sp.floor ? 0.4 : 1; if (rnd() > w) continue;
      if (taken.some(o => o.p.distanceTo(sp.p) < (o.r + r) * 1.05)) continue;
      const c = clearance(sp, r); if (c.head < dims.y + 0.02 || c.lat < r * 0.8 || c.sup < 3) continue;
      if (sp.floor && c.head > 2 && rnd() < 0.93) continue;   // open floor is rare: prefer tucked-under floor spots
      ok = sp;
    }
    if (!ok) continue;
    const m = new THREE.Mesh(t.geo, t.mat); m.userData.shared = true; m.scale.setScalar(k); m.position.copy(ok.p); m.rotation.y = rnd() * Math.PI * 2;
    m.castShadow = true; m.receiveShadow = true; m.userData.find = true; room.group.add(m); m.updateMatrixWorld(true);
    const it = { kind, mesh: m, target, found: false, r: Math.max(r, dims.y / 2), c: ok.p.clone().add(new THREE.Vector3(0, dims.y / 2, 0)), h: dims.y };
    // targets must be at least partly visible from the starting view (partly hidden is the fun part)
    if (target && visibleFrac(it, camPos) < 0.34) { drop(m); continue; }
    m.userData.item = it; items.push(it); taken.push({ p: ok.p, r });
  }
  const targets = items.filter(i => i.target);
  // silhouettes or names
  targets.forEach((it, i) => { it.sil = cfg.sil === 'all' || (cfg.sil === 'mix' && rnd() < 0.5); });
  L = { n, cfg, items, targets };
  R.shadowMap.needsUpdate = true;
  found = 0; combo = 0; score = 0; misses = []; lockUntil = 0; hintMax = n <= 3 ? 18 : 30; hintCD = 0; recorded = false;
  timeTotal = timeLeft = cfg.time;
  renderList(); updateHud();
}
const _pts = [[0, 0, 0], [0.6, 0.3, 0], [-0.6, 0.3, 0], [0, 0.4, 0.6], [0, -0.3, 0.5], [0, 0.45, 0]];
function samplePts(it) { return _pts.map(([a, b, c]) => it.c.clone().add(new THREE.Vector3(a * it.r, b * it.h, c * it.r))); }
function visibleFrac(it, from) {
  let v = 0; const pts = samplePts(it);
  for (const p of pts) {
    const dir = V2.copy(p).sub(from); const dist = dir.length(); dir.normalize(); ray.set(from, dir); ray.far = dist + 0.05;
    const hits = ray.intersectObjects([...room.solids, ...(L ? L.items.map(i => i.mesh) : []), it.mesh], false);
    const h = hits.find(x => x.object.visible);
    if (!h || h.object === it.mesh || h.distance > dist - it.r * 0.15) v++;
  }
  return v / pts.length;
}

// ---------------------------------------------------------------- object thumbnails (colour + silhouette) for the list
const THUMB = new Map();
let thumbR = null; const thumbScene = new THREE.Scene(), thumbCam = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
thumbScene.add(new THREE.HemisphereLight('#ffffff', '#c9a68a', 2.2)); const tl = new THREE.DirectionalLight('#fff', 2.2); tl.position.set(1, 2, 2); thumbScene.add(tl);
function thumb(id) {
  if (THUMB.has(id)) return THUMB.get(id);
  if (!thumbR) { thumbR = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); thumbR.setSize(128, 128, false); thumbR.setPixelRatio(1); thumbR.outputColorSpace = THREE.SRGBColorSpace; thumbR.toneMapping = THREE.ACESFilmicToneMapping; }
  const t = TPL[id], m = new THREE.Mesh(t.geo, t.mat); const s = 1 / Math.max(t.size.x, t.size.y, t.size.z); m.scale.setScalar(s); m.position.y = -t.size.y * s / 2; m.rotation.y = -0.5;
  thumbScene.add(m); thumbCam.position.set(0, 0.45, 2.15); thumbCam.lookAt(0, 0, 0); thumbR.render(thumbScene, thumbCam); thumbScene.remove(m);
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.drawImage(thumbR.domElement, 0, 0); const col = c.toDataURL();
  x.globalCompositeOperation = 'source-in'; x.fillStyle = '#4b3550'; x.fillRect(0, 0, 128, 128); const sil = c.toDataURL();
  const r = { col, sil }; THUMB.set(id, r); return r;
}

// ---------------------------------------------------------------- list UI
const listEl = panel.querySelector('.ks-list');
function renderList() {
  listEl.innerHTML = ''; listEl.classList.toggle('ks-many', L.targets.length > 8);
  for (const it of L.targets) {
    const th = thumb(it.kind.id);
    const el = $(`<div class="ks-item ${it.sil ? 'sil' : ''}">${it.sil ? `<img alt="" src="${th.sil}">` : `<span>${it.kind.name}</span>`}<i class="ok">✓</i></div>`);
    it.el = el; listEl.appendChild(el);
  }
}
function updateHud() {
  const t = Math.max(0, Math.ceil(timeLeft)), tm = hud.querySelector('.ks-timer');
  tm.querySelector('b').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  tm.classList.toggle('low', t <= 15 && state === 'play');
  hud.querySelector('.ks-score b').textContent = score.toLocaleString();
  hud.querySelector('.ks-room').textContent = L ? (L.cfg.daily ? 'Daily scene · ' + L.cfg.room.name : `${L.cfg.room.name} · Scene ${L.n}`) : '';
  const hb = panel.querySelector('.ks-hint'), p = 1 - hintCD / hintMax;
  hb.querySelector('.fg').style.strokeDashoffset = (182 * (1 - p)).toFixed(1); hb.classList.toggle('ready', hintCD <= 0 || lens > 0);
  hb.querySelector('em').textContent = hintCD <= 0 ? '' : lens > 0 ? '×' + lens : Math.ceil(hintCD) + 's';
  panel.querySelector('.ks-glass em').textContent = '×' + glass; panel.querySelector('.ks-glass').classList.toggle('empty', glass <= 0);
}

// ---------------------------------------------------------------- camera: gentle orbit + zoom toward the finger, limited range
const home = { target: new THREE.Vector3(0, 0.9, -0.35), yaw: 0, pitch: 0.5, dist: 9, fov: 50 };
const camS = { target: home.target.clone(), yaw: 0, pitch: 0.5, dist: 9 }, camG = { target: home.target.clone(), yaw: 0, pitch: 0.5, dist: 9 };
let PANEL = 170, TOP = 74, portrait = true;
let shake = 0;
function camPosFor(t, yaw, pitch, dist) { return new THREE.Vector3(t.x + Math.sin(yaw) * Math.cos(pitch) * dist, t.y + Math.sin(pitch) * dist, t.z + Math.cos(yaw) * Math.cos(pitch) * dist); }
function layout() {
  const w = innerWidth, h = innerHeight; portrait = w / h < 0.9;
  R.setSize(w, h); C.resize(w, h);
  PANEL = portrait ? (L && L.targets.length > 8 ? 178 : 158) : 132; TOP = portrait ? 78 : 66;
  if (portrait) { home.fov = 60; home.pitch = 0.52; home.dist = 8; home.target.set(0, 0.8, -1.2); if (Q.get('cam')) { const [pp, tz, ty, fv] = Q.get('cam').split(',').map(Number); home.pitch = pp; home.target.set(0, ty, tz); home.fov = fv || 54; } }
  else { home.fov = 38; home.pitch = 0.34; home.dist = 12.4; home.target.set(0, 1.45, -0.2); }
  cam.fov = home.fov; cam.aspect = w / h;
  const s = Math.max(0, (PANEL - TOP) / 2);
  cam.setViewOffset(w, h + 2 * s, 0, 2 * s, w, h); cam.updateProjectionMatrix();
  if (portrait) {
    // phone: pull in until the room's front edge sits just above the list, so no empty floorless band shows
    const edge = new THREE.Vector3(0, -0.3, D0 / 2 + 0.05), want = h - PANEL + 20;
    let lo = 3, hi = 14;
    for (let i = 0; i < 24; i++) { const d = (lo + hi) / 2; cam.position.copy(camPosFor(home.target, 0, home.pitch, d)); cam.lookAt(home.target); cam.updateMatrixWorld(); const y = toScreen(edge).y; if (y > want) lo = d; else hi = d; }
    home.dist = lo;
  }
}
function homeCam(snap = false) {
  camG.target.copy(home.target); camG.yaw = 0; camG.pitch = home.pitch; camG.dist = home.dist;
  guardFrame();
  if (snap) { camS.target.copy(camG.target); camS.yaw = camG.yaw; camS.pitch = camG.pitch; camS.dist = camG.dist; }
}
const lim = () => ({ yaw: portrait ? 0.62 : 0.55, pMin: home.pitch - 0.3, pMax: home.pitch + 0.22, dMin: home.dist * 0.28, dMax: home.dist });
const GC = new THREE.PerspectiveCamera();
// phone: keep the frame inside the room at every zoom/pan: the floor's front edge stays under the list, the wall tops above the HUD
function guardFrame() {
  if (!portrait || !room) return;
  const def = room.def, w = innerWidth, h = innerHeight; GC.copy(cam);
  const pf = new THREE.Vector3(), pt = new THREE.Vector3();
  for (let i = 0; i < 12; i++) { const x = camPosFor(camG.target, camG.yaw, camG.pitch, camG.dist).x; if (Math.abs(x) <= def.W / 2 - 0.35) break; camG.yaw *= 0.85; if (Math.abs(camG.target.x) > 0.01) camG.target.x *= 0.9; }
  for (let i = 0; i < 14; i++) {
    GC.position.copy(camPosFor(camG.target, camG.yaw, camG.pitch, camG.dist)); GC.lookAt(camG.target); GC.updateMatrixWorld();
    pf.set(camG.target.x, -0.3, def.D / 2 + 0.05).project(GC); pt.set(camG.target.x, def.outdoor ? -9 : def.H, -def.D / 2).project(GC);
    const yf = (1 - pf.y) / 2 * h, yt = (1 - pt.y) / 2 * h;
    const lowBad = yf < h - PANEL + 2, topBad = !def.outdoor && yt > TOP - 2;
    if (lowBad && !topBad) camG.target.z -= 0.1; else if (topBad && !lowBad) camG.target.z += 0.1; else if (lowBad && topBad) { camG.dist *= 0.95; } else break;
  }
}
function clampCam() {
  const l = lim(); camG.yaw = clamp(camG.yaw, -l.yaw, l.yaw); camG.pitch = clamp(camG.pitch, l.pMin, l.pMax); camG.dist = clamp(camG.dist, l.dMin, l.dMax);
  const def = room ? room.def : ROOMS[0], z = clamp(1 - (camG.dist - l.dMin) / (home.dist - l.dMin), 0, 1);   // z: 0 zoomed out … 1 zoomed in
  const bx = (def.W / 2 - 0.3) * z, bz0 = -def.D / 2 + 0.4, bz1 = def.D / 2 - 0.4;
  camG.target.x = clamp(camG.target.x, home.target.x - bx, home.target.x + bx);
  camG.target.y = clamp(camG.target.y, 0.15, Math.max(home.target.y, 2.2 * z + home.target.y * (1 - z)));
  camG.target.z = clamp(camG.target.z, lerp(home.target.z, bz0, z), lerp(home.target.z, bz1, z));
  guardFrame();
}
function updateCam(dt) {
  const k = 1 - Math.pow(0.0008, dt / 60);
  camS.yaw = lerp(camS.yaw, camG.yaw, k); camS.pitch = lerp(camS.pitch, camG.pitch, k); camS.dist = lerp(camS.dist, camG.dist, k); camS.target.lerp(camG.target, k);
  cam.position.copy(camPosFor(camS.target, camS.yaw, camS.pitch, camS.dist));
  if (shake > 0) { cam.position.x += (Math.random() - 0.5) * shake * 0.06; cam.position.y += (Math.random() - 0.5) * shake * 0.06; shake = Math.max(0, shake - dt * 0.08); }
  cam.lookAt(camS.target);
}
function worldAt(sx, sy) {
  ndc(sx, sy); ray.setFromCamera(NDC, cam); ray.far = 60;
  const h = room ? ray.intersectObjects(room.solids, false)[0] : null;
  if (h) return h.point;
  const t = (0.6 - ray.ray.origin.y) / ray.ray.direction.y; return ray.ray.origin.clone().addScaledVector(ray.ray.direction, t > 0 ? t : 5);
}
function zoomAt(f, sx, sy) {
  const l = lim(), nd = clamp(camG.dist * f, l.dMin, l.dMax); if (Math.abs(nd - camG.dist) < 1e-4) return;
  if (f < 1) { const p = worldAt(sx, sy); camG.target.lerp(p, 1 - nd / camG.dist); }
  else { const back = (nd - camG.dist) / (Math.max(home.dist, nd) - camG.dist + 1e-6); camG.target.lerp(home.target, clamp(back, 0, 1)); camG.yaw *= 1 - clamp(back, 0, 1) * 0.5; }
  camG.dist = nd; clampCam();
}
function panBy(dx, dy) {
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), fwd = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  const s = camG.dist * 0.0019; camG.target.addScaledVector(right, -dx * s).addScaledVector(fwd, dy * s); clampCam();
}
const NDC = new THREE.Vector2();
function ndc(x, y) { NDC.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); return NDC; }
function toScreen(p) { const v = p.clone().project(cam); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, z: v.z }; }

// ---------------------------------------------------------------- input (touch: drag turns / pans, pinch zooms; mouse: drag, wheel, right-drag pans)
const ptrs = new Map(); let gest = null;
const cv = R.domElement;
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  SND.ctx(); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  if (ptrs.size === 1) gest = { sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0, pan: e.button === 2 || e.shiftKey };
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gest = { pinch: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, moved: 99 }; }
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p || !gest) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (!canControl()) return;
  if (ptrs.size >= 2 && gest.pinch) {
    const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    zoomAt(gest.pinch / Math.max(20, d), mx, my); panBy(mx - gest.mx, my - gest.my); gest.pinch = d; gest.mx = mx; gest.my = my; return;
  }
  gest.moved += Math.abs(dx) + Math.abs(dy);
  if (gest.moved < 8) return;
  const zoomed = camG.dist < home.dist * 0.82;
  if (gest.pan || zoomed) panBy(dx, dy); else { camG.yaw -= dx * 0.0042; camG.pitch += dy * 0.003; clampCam(); }
});
const endPtr = e => {
  const had = ptrs.delete(e.pointerId); if (!had || !gest) return;
  if (ptrs.size === 0) { const g = gest; gest = null; if (!g.pinch && g.moved < 10 && performance.now() - g.t < 450) onTap(e.clientX, e.clientY); }
  else if (ptrs.size === 1) { const [a] = [...ptrs.values()]; gest = { sx: a.x, sy: a.y, t: 0, moved: 99 }; }
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', e => { e.preventDefault(); if (!canControl()) return; zoomAt(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
zoomBar.addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (!b || !canControl()) return; SND.tap(); zoomAt(b.dataset.z === 'in' ? 0.62 : 1.6, innerWidth / 2, TOP + (innerHeight - PANEL - TOP) / 2); });
addEventListener('keydown', e => { if (!canControl()) return; if (e.key === '+' || e.key === '=') zoomAt(0.7, innerWidth / 2, innerHeight / 2); if (e.key === '-') zoomAt(1.4, innerWidth / 2, innerHeight / 2); if (e.key === 'h') useHint(); });
const canControl = () => state === 'play' || state === 'intro';

// ---------------------------------------------------------------- finding
function pickAt(sx, sy) {
  ndc(sx, sy); ray.setFromCamera(NDC, cam); ray.far = 60;
  const live = L.items.filter(i => !i.found).map(i => i.mesh);
  const h = ray.intersectObjects([...room.solids, ...live], false).find(x => x.object.visible && !x.object.userData.noPick);
  if (h && h.object.userData.find) { const it = h.object.userData.item; return it.target && !it.found ? it : 'decoy'; }
  // fat-finger forgiveness: a listed object whose visible part is right under the finger
  let best = null, bd = 1e9;
  for (const it of L.targets) {
    if (it.found) continue;
    const c = toScreen(it.c), e = toScreen(it.c.clone().add(V.set(0, it.h / 2, 0))); const rad = Math.max(16, Math.hypot(c.x - e.x, c.y - e.y) * 1.15);
    const d = Math.hypot(c.x - sx, c.y - sy); if (d < rad && d < bd && visibleFrac(it, cam.position) > 0) { best = it; bd = d; }
  }
  return best;
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in room 1, until the first real touch,
// two listed objects in plain sight are tapped for the player (the QA aim), so they lift, sparkle and fly into the list
demo(() => {
  if (L.targets.filter(i => !i.found).length <= 3) return false;
  const p = window.__game.aim(); if (!p) return false; onTap(p[0], p[1]);
}, { ready: () => state === 'play' && L && L.n === 1 && !isDaily && performance.now() >= lockUntil, wait: 1800, every: 1600, max: 2 });
function onTap(x, y) {
  if (state === 'intro') { endIntro(); return; }
  if (state !== 'play' || !L) return;
  if (performance.now() < lockUntil) { ui.pop('Easy there…', '#fff', 26, 30); return; }
  const r = pickAt(x, y);
  if (r && r !== 'decoy') findItem(r, x, y); else miss(x, y);
}
function findItem(it, sx, sy) {
  it.found = true; found++;
  const now = performance.now() / 1000; combo = now - lastFind < 4 ? combo + 1 : 0; lastFind = now;
  const pts = 100 + combo * 40; score += pts;
  SND.found(combo); buzz(18);
  const s = toScreen(it.c); sx = sx ?? s.x; sy = sy ?? s.y;
  floatText(`+${pts}`, sx, sy - 20, '#fff6c8');
  if (combo >= 1) floatText(`Combo ×${combo + 1}!`, sx, sy - 52, '#ffd36b', 22);
  sparkle(it.c, 1);
  // the object lifts, spins, swells and pops; a picture of it flies into the list
  const m = it.mesh; m.castShadow = false; R.shadowMap.needsUpdate = true; it.anim = 0; it.base = m.scale.x; it.y0 = m.position.y;
  if (it.hmat) { m.material = TPL[it.kind.id].mat; it.hmat.dispose(); it.hmat = null; }
  flyIcon(it, sx, sy);
  if (found >= L.targets.length) setTimeout(winLevel, 650);
  updateHud();
}
function miss(x, y) {
  SND.miss(); buzz([10, 30, 10]); shake = 1;
  const pen = 5; timeLeft = Math.max(0, timeLeft - pen); combo = 0;
  const el = $(`<div class="ks-miss" style="left:${x}px;top:${y}px">✕</div>`); document.body.appendChild(el); setTimeout(() => el.remove(), 700);
  floatText(`−${pen}s`, x, y - 34, '#ff7b7b', 22);
  const tm = hud.querySelector('.ks-timer'); tm.classList.remove('hit'); void tm.offsetWidth; tm.classList.add('hit');
  const now = performance.now(); misses = misses.filter(t => now - t < 3000); misses.push(now);
  if (misses.length >= 3) { lockUntil = now + 2000; misses = []; ui.pop('Too many taps! Wait a moment', '#fff', 22, 30); }
  updateHud();
}
function floatText(t, x, y, color = '#fff', size = 28) { const el = $(`<div class="ks-float" style="left:${x}px;top:${y}px;color:${color};font-size:${size}px">${t}</div>`); document.body.appendChild(el); setTimeout(() => el.remove(), 1000); }
function flyIcon(it, sx, sy) {
  const img = $(`<img class="ks-fly" alt="" src="${thumb(it.kind.id).col}">`); img.style.left = sx + 'px'; img.style.top = sy + 'px'; document.body.appendChild(img);
  const r = it.el.getBoundingClientRect();
  requestAnimationFrame(() => requestAnimationFrame(() => { img.style.transform = `translate(${r.left + r.width / 2 - sx}px, ${r.top + r.height / 2 - sy}px) scale(.45)`; img.style.opacity = '0.2'; }));
  setTimeout(() => { img.remove(); it.el.classList.add('done'); if (it.sil) it.el.querySelector('img').src = thumb(it.kind.id).col; SND.pop(); }, 620);
}
const SPARK = ['#fff3b0', '#ffd36b', '#ffffff', '#ffb7d0'];
function sparkle(p, k = 1) { burst(scene, p, SPARK, Math.round(16 * k), { speed: 0.03, up: 0.025, size: 0.22, gravity: 0.0011, shape: 'sphere', life: 1 }); }

// hint: recharges; a magnifier token skips the wait. The camera glides to the object and it glows.
let hintRing = null;
function useHint() {
  if (state !== 'play' || !L) return;
  const usingLens = hintCD > 0; if (usingLens && lens <= 0) { ui.pop(`Hint in ${Math.ceil(hintCD)}s`, '#fff', 24, 30); return; }
  const left = L.targets.filter(i => !i.found); if (!left.length) return;
  if (usingLens) { lens--; saveProg(); } else hintCD = hintMax;
  const it = left.slice().sort((a, b) => visibleFrac(b, cam.position) - visibleFrac(a, cam.position))[0];
  focusOn(it, 0.45);
  SND.hint(); sparkle(it.c, 1.4);
  if (!it.hmat) { it.hmat = TPL[it.kind.id].mat.clone(); it.hmat.emissive = new THREE.Color('#ffcf6a'); it.mesh.material = it.hmat; }
  it.hintT = 4.5;
  if (!hintRing) { hintRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex(), transparent: true, depthTest: false, depthWrite: false })); hintRing.renderOrder = 20; scene.add(hintRing); }
  hintRing.userData.it = it; hintRing.userData.t = 4.5; hintRing.visible = true;
  updateHud();
}
function focusOn(it, z = 0.5) { camG.target.copy(it.c); camG.dist = home.dist * z; camG.yaw *= 0.5; clampCam(); }
let _ring = null;
function ringTex() { if (_ring) return _ring; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.strokeStyle = 'rgba(255,214,110,.95)'; x.lineWidth = 7; x.shadowColor = '#fff2a8'; x.shadowBlur = 14; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.stroke();
  x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(64, 64, 42, 0, 7); x.stroke(); _ring = new THREE.CanvasTexture(c); _ring.colorSpace = THREE.SRGBColorSpace; return _ring; }
panel.querySelector('.ks-hint').addEventListener('click', () => useHint());
panel.querySelector('.ks-glass').addEventListener('click', () => {
  if (state !== 'play') return; if (glass <= 0) { ui.pop('Earn ⏳ by finishing chapters', '#fff', 22, 30); return; }
  glass--; saveProg(); timeLeft += 30; timeTotal += 30; SND.hint(); floatText('+30s', innerWidth / 2, TOP + 30, '#bff0c9', 30); updateHud();
});

// ---------------------------------------------------------------- Nana (Hero Lab character) + your hero
let nana = null, mine = null, mineSig = '';
async function loadNana() {
  try {
    nana = await loadHero(THREE, GLTFLoader, { hero: { char: 'p05', hue: 0, sat: 1, bri: 1 }, assets: BASE + 'assets/hero/', height: 1.55, shadows: false });
    nana.object.add(blob(0.42)); scene.add(nana.object); placeNana();
  } catch (e) { console.warn('nana', e); }
}
function blob(r) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(40,20,10,.45)'); g.addColorStop(1, 'rgba(40,20,10,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); m.rotation.x = -P2; m.position.y = 0.012; m.userData.noPick = true; return m; }
function placeNana() {
  if (!room) return; const [x, z, ry] = room.def.nana;
  if (nana) { nana.object.position.set(x, 0, z); nana.object.rotation.y = ry; }
  if (mine) { mine.object.position.set(x + Math.cos(ry) * 0.75, 0, z - Math.sin(ry) * 0.75); mine.object.rotation.y = ry; mine.object.visible = state !== 'play'; }
}
async function useMyHero() {
  const h = selectedHero(), sig = h ? JSON.stringify(h) : ''; if (sig === mineSig) return; mineSig = sig;
  if (mine) { mine.dispose(); mine = null; }
  if (!h) return;
  try { const m = await loadHero(THREE, GLTFLoader, { hero: h, height: 1.62, shadows: false }); if (JSON.stringify(selectedHero()) !== mineSig) { m.dispose(); return; } mine = m; mine.object.add(blob(0.4)); scene.add(mine.object); placeNana(); } catch (e) { console.warn('hero', e); }
}
heroBar({ parent: heroWrap, title: 'Visit as', noneLabel: 'Just me', noneIcon: '🏡', onPick: () => useMyHero() });
onHeroesChange(() => useMyHero());

// ---------------------------------------------------------------- flow: start → intro → play → won / lost
function showGame(on) { for (const el of [hud, panel, zoomBar]) el.classList.toggle('ks-off', !on); }
function say(text, ms = 0) { if (state !== 'lost') bubble.classList.remove('ks-low'); bubble.querySelector('p').textContent = text; bubble.classList.remove('ks-off'); clearTimeout(say.t); if (ms) say.t = setTimeout(() => bubble.classList.add('ks-off'), ms); }
function framNana() { if (!room) return; const [x, z] = room.def.nana; camG.target.set(x * 0.55, 1.0, z * 0.5 - 0.3); camG.dist = home.dist * 0.62; camG.yaw = x > 0 ? 0.25 : -0.25; clampCam(); }
async function startLevel(n) {
  await ready; veil.classList.add('gone');
  cur = n; if (!isDaily) saveProg();
  buildLevel(n); placeNana(); layout(); homeCam(true);
  showGame(true); SND.startMusic();
  const ch = chapterOf(n), firstOfChapter = !isDaily && n <= STORY_LEVELS && (n - 1) % PER === 0;
  if (firstOfChapter) { state = 'intro'; framNana(); camS.target.copy(camG.target); camS.dist = camG.dist * 1.25; say(INTRO[ch]); nana && nana.play('cheer'); introT = 4.2; if (mine) mine.object.visible = true; }
  else beginPlay();
  updateHud();
}
let introT = 0;
function endIntro() { if (state !== 'intro') return; beginPlay(); }
function beginPlay() {
  state = 'play'; bubble.classList.add('ks-off'); bubble.classList.remove('ks-low'); homeCam(); nana && nana.play('idle'); if (mine) mine.object.visible = false;
  runStart = performance.now(); B.start();
  const tip = L.n === 1 ? 'Tap the objects on the list!' : L.targets.some(t => t.sil) ? 'Find the shapes!' : 'Find them all!';
  ui.pop(tip, '#fff', 26, 26);
}
function starsFor() { const f = timeLeft / timeTotal; return f >= 0.45 ? 3 : f >= 0.2 ? 2 : 1; }
function winLevel() {
  if (state !== 'play') return; state = 'won';
  const bonus = Math.round(timeLeft) * 10; score += bonus;
  const st = starsFor(), ms = Math.round(performance.now() - runStart);
  if (!recorded) { recorded = true; F.level(true); B.submit(st, { ms }); }
  SND.win(); confetti(scene, camS.target.clone().add(V.set(0, 1.2, 0)), 70); buzz([20, 40, 20]);
  nana && nana.play('cheer'); if (mine) { mine.object.visible = true; mine.play('cheer'); }
  bubble.classList.add('ks-off'); homeCam();
  let ks = null;
  if (L.cfg.daily) ks = ['Today\'s scene', 'Same scene for everyone today. Come back tomorrow!'];
  else {
    const n = L.n, prev = starsBy[n] || 0; if (st > prev) starsBy[n] = st;
    if (st === 3) { lens++; }
    if (n % PER === 0) { glass++; }
    if (n === maxLevel) maxLevel = n + 1;
    cur = n + 1; saveProg();
    ks = n <= STORY_LEVELS ? KEEPSAKES[n - 1] : ['An encore memory', `Encore scene ${n - STORY_LEVELS}. Nana has more stories every day.`];
  }
  const w = winExtra; w.querySelectorAll('.ks-wstars i').forEach((e, i) => { e.className = ''; setTimeout(() => { if (i < st) { e.className = 'on'; SND.star(i); } }, 900 + i * 280); });
  w.querySelector('.ks-wscore').innerHTML = `<b>${score.toLocaleString()}</b><small>+${bonus} time bonus${st === 3 && !L.cfg.daily ? ' · 🔍+1' : ''}${!L.cfg.daily && L.n % PER === 0 ? ' · ⏳+1' : ''}</small>`;
  w.querySelector('.ks-keep b').textContent = (L.cfg.daily ? '' : 'Keepsake: ') + ks[0]; w.querySelector('.ks-keep p').textContent = '“' + ks[1] + '”';
  if (D.beaten(score)) { ui.pop('BEATEN!', '#ffd36b', 40, 24); confetti(scene, camS.target.clone(), 50); }
  D.won(score, 'scored');
  ui.win(L.cfg.daily ? 'DAILY' : L.n, '');
  showGame(false); updateHud();
}
function loseLevel() {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.level(false, found / L.targets.length); }
  SND.lose(); bubble.classList.add('ks-low'); say("Oh dear, the clock beat us. Let's try again!"); homeCam();
  ui.lose('Out of time!', `You found ${found} of ${L.targets.length}`);
  showGame(false);
}
ui.onTap(which => {
  SND.ctx();
  if (which === 'start') { startLevel(isDaily ? 1 : cur); return; }
  if (which === 'win') { startLevel(isDaily ? 1 : cur); return; }
  if (which === 'lose') { startLevel(isDaily ? 1 : L.n); return; }
});

// start card: chapter, stars, journey map, daily
function refreshStart() {
  const ch = chapterOf(cur), r = ROOMS.find(x => x.key === CHAPTERS[ch]);
  startInfo.querySelector('.ks-chap').textContent = isDaily ? `Daily scene · ${levelCfg(1).room.name}` : cur <= STORY_LEVELS ? `Chapter ${ch + 1} · ${r.name} · Scene ${(cur - 1) % PER + 1}` : `Encore · ${r.name} · Scene ${cur - STORY_LEVELS}`;
  startInfo.querySelector('.ks-stars').textContent = `★ ${totalStars()} / ${STORY_LEVELS * 3}`;
  ui.els.start.querySelector('.hint').textContent = isDaily ? 'Tap to play today\'s scene' : cur === 1 ? 'Tap to visit Nana' : 'Tap to play';
}
startBtns.querySelector('.ks-daily').addEventListener('click', () => { const u = new URL(location.href); if (isDaily) u.searchParams.delete('daily'); else u.searchParams.set('daily', '1'); location.href = u.href; });
if (isDaily) startBtns.querySelector('.ks-daily').textContent = '📖 Story';
startBtns.querySelector('.ks-map').addEventListener('click', () => { SND.page(); openMap(); });
mapEl.querySelector('.ks-x').addEventListener('click', () => { mapEl.hidden = true; });
mapEl.addEventListener('click', e => { if (e.target === mapEl) mapEl.hidden = true; const b = e.target.closest('[data-l]'); if (!b || b.disabled) return; cur = +b.dataset.l; saveProg(); mapEl.hidden = true; refreshStart(); previewRoom(); SND.tap(); });
['pointerdown', 'pointerup'].forEach(ev => mapEl.addEventListener(ev, e => e.stopPropagation()));
function openMap() {
  const host = mapEl.querySelector('.ks-chaps'); host.innerHTML = '';
  mapEl.querySelector('.ks-mapsub').textContent = `★ ${totalStars()} of ${STORY_LEVELS * 3} · Keepsakes ${Math.min(STORY_LEVELS, maxLevel - 1)} of ${STORY_LEVELS} · 🔍 ${lens} · ⏳ ${glass}`;
  CHAPTERS.forEach((k, ci) => {
    const r = ROOMS.find(x => x.key === k), first = ci * PER + 1, open = maxLevel >= first;
    const c = $(`<div class="ks-ch ${open ? '' : 'locked'}"><div class="ks-chh"><b>${ci + 1}</b><span>${r.name}</span>${open ? '' : '<i>🔒</i>'}</div><div class="ks-lv"></div></div>`);
    for (let j = 0; j < PER; j++) { const n = first + j, s = starsBy[n] || 0; const b = $(`<button data-l="${n}" ${n <= maxLevel ? '' : 'disabled'} class="${n === cur ? 'cur' : ''}"><b>${j + 1}</b><small>${'★'.repeat(s)}${'☆'.repeat(n < maxLevel ? 3 - s : 0)}</small></button>`); c.querySelector('.ks-lv').appendChild(b); }
    host.appendChild(c);
  });
  if (maxLevel > STORY_LEVELS) { const c = $(`<div class="ks-ch"><div class="ks-chh"><b>∞</b><span>Encore scenes</span></div><div class="ks-lv"><button data-l="${maxLevel}" class="cur"><b>${maxLevel - STORY_LEVELS}</b><small>next</small></button></div></div>`); host.appendChild(c); }
  mapEl.hidden = false;
}
async function previewRoom() {
  await ready; const cfg = levelCfg(isDaily ? 1 : cur); if (!room || room.def !== cfg.room) { clearLevel(); buildRoom(cfg.room); R.shadowMap.needsUpdate = true; }
  placeNana(); framNana(); camS.target.copy(camG.target); camS.dist = camG.dist; camS.yaw = camG.yaw; camS.pitch = camG.pitch;
  say(cur === 1 && !isDaily ? "Hello, dear! I'm Nana Pearl. My memory's not what it was. Will you help me find my keepsakes?" : isDaily ? 'A new scene every day. Same one for everybody!' : 'Ready for the next room, love?');
  nana && nana.play('idle');
}

// ---------------------------------------------------------------- loop
let t0 = performance.now(), fpsN = 0, fpsT = 0, fps = 60;
loop((dt, t) => {
  const sec = dt / 60;
  if (state === 'play' && document.visibilityState === 'visible') {
    timeLeft -= sec; if (hintCD > 0) hintCD = Math.max(0, hintCD - sec);
    if (timeLeft <= 10 && Math.floor(timeLeft) !== Math.floor(timeLeft + sec) && timeLeft > 0) SND.tick();
    if (timeLeft <= 0) { timeLeft = 0; loseLevel(); }
    if ((t * 4 | 0) !== ((t - sec) * 4 | 0)) updateHud();
  }
  if (state === 'intro') { introT -= sec; if (introT <= 0) endIntro(); }
  if (state === 'ready' || state === 'won' || state === 'lost') { camG.yaw = Math.sin(t * 0.15) * 0.12 + (room && room.def.nana[0] > 0 ? 0.22 : -0.22); if (portrait) guardFrame(); }
  updateCam(dt);
  // found objects: lift, spin, swell then vanish
  if (L) for (const it of L.items) {
    if (it.found && it.anim !== undefined && it.anim < 1) {
      it.anim = Math.min(1, it.anim + sec / 0.6); const a = it.anim, m = it.mesh;
      m.position.y = it.y0 + Math.sin(a * Math.PI * 0.5) * 0.35; m.rotation.y += sec * 9; m.scale.setScalar(it.base * (a < 0.6 ? 1 + a * 0.9 : (1.54) * (1 - (a - 0.6) / 0.4)));
      if (a >= 1) { m.visible = false; }
    }
    if (it.hintT > 0) { it.hintT -= sec; if (it.hmat) it.hmat.emissiveIntensity = 0.35 + 0.35 * Math.sin(t * 9); if (it.hintT <= 0 && it.hmat && !it.found) { it.mesh.material = TPL[it.kind.id].mat; it.hmat.dispose(); it.hmat = null; } }
  }
  if (hintRing && hintRing.visible) { const u = hintRing.userData; u.t -= sec; const it = u.it; hintRing.position.copy(it.c); const s = it.r * 3.2 * (1 + 0.12 * Math.sin(t * 8)); hintRing.scale.set(s, s, 1); hintRing.material.opacity = Math.min(1, u.t); if (u.t <= 0 || it.found) hintRing.visible = false; }
  if (room && room.walls) {
    const { W, D } = room.def, p = cam.position;
    room.walls.left.visible = p.x > -W / 2 - 0.05; room.walls.right.visible = p.x < W / 2 + 0.05; room.walls.back.visible = p.z > -D / 2;
  }
  if (room) {
    for (const l of room.lights) if (l.userData.flicker) l.intensity = l.userData.base * (0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3));
    for (const s of room.shafts) s.material.uniforms.uT.value = t;
    if (room.dust) { const p = room.dust.geometry.attributes.position, b = room.dust.userData.base; for (let i = 0; i < p.count; i++) { p.setY(i, b[i * 3 + 1] + Math.sin(t * 0.4 + i) * 0.06); p.setX(i, b[i * 3] + Math.sin(t * 0.23 + i * 1.7) * 0.05); } p.needsUpdate = true; }
    for (const g of room.glows) g.material.opacity = 0.45 + 0.08 * Math.sin(t * 3 + g.position.x);
  }
  if (nana) {
    nana.mixer.update(sec);
    nana.object.visible = state !== 'play' || cam.position.distanceTo(nana.object.position) > 3.2;   // step aside when you zoom past her
    // Nana turns to face you whenever she is talking (start, intro, win, lose); in play she minds her own corner
    const want = state === 'play' || !room ? (room ? room.def.nana[2] : 0) : Math.atan2(cam.position.x - nana.object.position.x, cam.position.z - nana.object.position.z);
    let d = want - nana.object.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); nana.object.rotation.y += d * Math.min(1, sec * 4);
  }
  if (mine) mine.mixer.update(sec);
  R.info.reset(); C.render(sec);
  fpsN++; fpsT += sec; if (fpsT > 1) { fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
});
addEventListener('resize', () => { layout(); });
layout();

// ---------------------------------------------------------------- boot
(async () => {
  refreshStart();
  await ready; await previewRoom(); veil.classList.add('gone');
  loadNana().then(() => { placeNana(); nana && nana.play('idle'); });
  useMyHero();
})();
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') SND.stopMusic(); else if (state === 'play') SND.startMusic(); });

// ---------------------------------------------------------------- test hooks + bot (plays like a person: finds the next listed object it can see)
let botTick = 0;
window.__game = {
  get state() { return state === 'intro' ? 'play' : state; }, get level() { return L ? L.n : cur; }, get score() { return score; }, get fps() { return fps; },
  get info() { return { found, total: L && L.targets.length, time: timeLeft, draws: R.info.render.calls, tris: R.info.render.triangles, items: L && L.items.length, spots: room && room.spots.length }; },
  dbg() { return L.targets.map(it => { const s = toScreen(it.c); ndc(s.x, s.y); ray.setFromCamera(NDC, cam); ray.far = 60; const hs = ray.intersectObjects([...room.solids, ...L.items.map(i => i.mesh)], false); const h = hs[0]; return { n: it.kind.name, s: [Math.round(s.x), Math.round(s.y), +s.z.toFixed(3)], hit: h && (h.object === it.mesh ? 'SELF' : (h.object.userData.id || h.object.type) + ' ' + h.distance.toFixed(2)), self: hs.findIndex(x => x.object === it.mesh), d: cam.position.distanceTo(it.c).toFixed(2) }; }); },
  qaTime(t) { timeLeft = t; },
  // QA: screen point of a visible part of the next listed object (null if none visible)
  aim() { if (!L) return null; for (const it of L.targets) { if (it.found) continue; for (const p of samplePts(it)) { const s = toScreen(p); if (s.z > 1 || s.y < TOP || s.y > innerHeight - PANEL) continue; ndc(s.x, s.y); ray.setFromCamera(NDC, cam); ray.far = 60; const h = ray.intersectObjects([...room.solids, ...L.items.filter(i => !i.found).map(i => i.mesh)], false).find(x => x.object.visible && !x.object.userData.noPick); if (h && h.object === it.mesh) return [Math.round(s.x), Math.round(s.y)]; } } return null; },
  bot() {
    if (state === 'intro') { endIntro(); return; }
    if (state !== 'play' || !L) return;
    if (++botTick % 8) return;
    const left = L.targets.filter(i => !i.found); if (!left.length) return;
    for (const it of left) {
      for (const p of samplePts(it)) {
        const s = toScreen(p); if (s.z > 1 || s.x < 8 || s.x > innerWidth - 8 || s.y < TOP + 6 || s.y > innerHeight - PANEL - 6) continue;
        ndc(s.x, s.y); ray.setFromCamera(NDC, cam); ray.far = 60;
        const h = ray.intersectObjects([...room.solids, ...L.items.filter(i => !i.found).map(i => i.mesh)], false).find(x => x.object.visible && !x.object.userData.noPick);
        if (h && h.object === it.mesh) { onTap(s.x, s.y); return; }
      }
    }
    if (hintCD <= 0) { useHint(); return; }
    focusOn(left[botTick % left.length], 0.5);
  },
};
