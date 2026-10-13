// =========================
//    Canvas & Viewport
// =========================
export const W = 800;
export const H = 480;

// =========================
//    Tile System
// =========================
export const T = 32;
export const COLS = Math.ceil(W / T) + 2;

// =========================
//    Physics
// =========================
export const GRAV = 0.35;
export const GRAV_LOW = 0.10;
export const JUMP_VEL = -7.6;
export const MAX_FALL = 10;
export const MOVE_ACC = 0.065;
export const MOVE_DEC = 0.85;
export const AIR_DEC = 0.97;
export const MAX_WALK = 1.8;
export const MAX_RUN = 3.2;

// Jump assist (frames)
export const JUMP_BUFFER_FRAMES = 8;
export const COYOTE_FRAMES = 6;
export const JUMP_HOLD_FRAMES = 16;

// =========================
//    Level Dimensions
// =========================
export const LEVEL_W = 212;
export const LEVEL_H = 15;

// =========================
//    Tile Types
// =========================
export const EMPTY = 0;
export const GND = 1;
export const DIRT = 2;
export const BRICK = 3;
export const QCARROT = 4;
export const QLEEK = 5;
export const USED = 6;
export const STONE = 7;
export const PTL = 8;
export const PTR = 9;
export const PBL = 10;
export const PBR = 11;
export const QKUMA = 12;
export const YPTL = 13;
export const YPTR = 14;
export const YPBL = 15;
export const YPBR = 16;
export const QMIKU = 17;
export const QYOSHI = 18;
export const LAVA = 19;
export const QCHII = 20;
export const Q1UP = 21;
export const VINE = 22;
export const QSTAR = 23;

// =========================
//    Color Palette
//    (Authentic NES hex values)
// =========================
export const SKY = '#5C94FC';
export const C_GND = '#00A800';
export const C_DIRT = '#E05000';
export const C_BRICK = '#E05000';
export const C_BRICK_D = '#000000';
export const C_BRICK_L = '#FC9838';
export const C_USED = '#7C7C7C';
export const C_STONE = '#BCBCBC';
export const C_STONE_D = '#7C7C7C';
export const C_PIPE = '#00A800';
export const C_PIPE_D = '#005800';
export const C_PIPE_L = '#80D010';
export const C_YPIPE = '#FCE030';
export const C_YPIPE_D = '#AC7C00';
export const C_YPIPE_L = '#FCFC00';

// NES sprite colors (shared across renderers)
export const NES_RED = '#F83800';
export const NES_BROWN = '#AC7C00';
export const NES_BLUE = '#6888FC';
export const NES_WHITE = '#FCFCFC';
export const NES_BLACK = '#000000';
export const NES_SKIN = '#FCBCB0';
export const NES_GOLD = '#FCE030';
export const NES_ORANGE = '#FC9838';
export const NES_DKGREEN = '#005800';
export const NES_GREEN = '#00A800';
export const NES_LTGREEN = '#80D010';
export const NES_TEAL = '#00E8D8';
export const NES_PINK = '#F878F8';
export const NES_PURPLE = '#7058C0';
export const NES_DKPURPLE = '#44009C';
