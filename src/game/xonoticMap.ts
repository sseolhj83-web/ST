/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapWall, JumpPad, PickupItem } from './xonoticTypes';

// The Backrooms — Level 0 style liminal maze.
// Layout: an open outer hallway ring (keeps existing bot spawn points / outer pickups clear of walls)
// surrounding a dense inner maze core built from a procedural grid of yellow partition rooms.
// One fixed cell in the core is left open as a vertical "vent shaft" rising past the ceiling —
// this is the same rocket-jump-accessible portal volume the engine already checks for (xonoticEngine.ts
// isInsidePortal, fixed at x=-28, z=-34.5), so no gameplay coordinates elsewhere need to change.
//
// Beyond this hand-built 160x160 "hub", the maze keeps going forever: generateStreamedChunk()
// below extends the exact same yellow-partition grid out to infinity, streamed in/out around the
// player by xonoticEngine.ts / XonoticCanvas.tsx so the map is never bounded. Every surface — hub
// and streamed alike — sits under a solid ceiling; there is no sky anywhere, this is Backrooms, it's
// all indoors.

export const WALL_COLOR = '#c9b458';    // damp yellow wallpaper
export const CEILING_COLOR = '#cfc48f'; // stained popcorn ceiling tile
export const LIGHT_COLOR = '#fef9c3';   // buzzing fluorescent tube
export const CARPET_COLOR = '#9c9166';  // moist mustard carpet

export const WALL_H = 6.5;    // backrooms ceiling height (raised from the original 3.2 — still low/oppressive, but headroom to move)
export const CELL = 20;       // maze partition grid spacing, shared by the hub and every streamed chunk

// --- Infinite streaming grid -------------------------------------------------------------
// The world beyond the hub is an endless deterministic maze: partition walls sit on every grid
// line spaced CELL apart, each split by a doorway gap whose position is derived from a hash of
// the line's own coordinates (not Math.random()), so the layout is identical no matter which
// chunk "discovers" it first and is stable if the player leaves and comes back.
export const CHUNK_SIZE = CELL * 2;  // one streamed chunk = a 2x2 block of maze cells
export const CHUNK_LOAD_RADIUS = 3;  // chunks kept resident around the player (in chunk units)
const HUB_HALF = 80;                 // hub spans x/z in [-80, 80) — matches sizeX/sizeZ below

export function chunkKey(cx: number, cz: number): string {
  return `${cx}_${cz}`;
}

// Chunks fully inside the hand-built hub footprint are skipped — that geometry is already
// generated once by getXonoticMap() below.
export function isHubChunk(cx: number, cz: number): boolean {
  const half = HUB_HALF / CHUNK_SIZE;
  return cx >= -half && cx < half && cz >= -half && cz < half;
}

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(a: number, b: number, c: number): number {
  let h = 0x811c9dc5;
  h ^= a; h = Math.imul(h, 0x01000193);
  h ^= b; h = Math.imul(h, 0x01000193);
  h ^= c; h = Math.imul(h, 0x01000193);
  return h >>> 0;
}

// Generates the portion of the infinite maze owned by chunk (cx, cz). Every grid line ix is
// "owned" by exactly one chunk (floor(ix / 2) === cx) so neighboring chunks never draw the same
// wall twice and never disagree about where a doorway sits.
export function generateStreamedChunk(cx: number, cz: number): MapWall[] {
  const walls: MapWall[] = [];
  const wallT = 0.5;
  const doorW = 4;
  const prefix = `stream_${cx}_${cz}`;
  const originX = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
  const originZ = cz * CHUNK_SIZE + CHUNK_SIZE / 2;

  // Floor + a full, unbroken ceiling slab — fully enclosed, indoor, no sky ever visible.
  walls.push({ id: `floor_${prefix}`, pos: { x: originX, y: -0.5, z: originZ }, size: { x: CHUNK_SIZE, y: 1, z: CHUNK_SIZE }, color: CARPET_COLOR });
  walls.push({ id: `${prefix}_ceiling`, pos: { x: originX, y: WALL_H + 0.15, z: originZ }, size: { x: CHUNK_SIZE, y: 0.3, z: CHUNK_SIZE }, color: CEILING_COLOR });

  const ixBase = cx * 2; // this chunk owns cell-index columns/rows ixBase and ixBase+1
  const izBase = cz * 2;

  // Vertical partitions (fixed x, spanning z)
  for (let li = 0; li < 2; li++) {
    const ix = ixBase + li;
    const gx = ix * CELL;
    for (let ci = 0; ci < 2; ci++) {
      const iz = izBase + ci;
      const gz = iz * CELL;
      const rand = mulberry32(hashSeed(ix, iz, 1));
      const doorCenter = gz + CELL / 2 + (rand() - 0.5) * (CELL - doorW - 2);
      const gapStart = doorCenter - doorW / 2;
      const gapEnd = doorCenter + doorW / 2;

      if (gapStart > gz) {
        const len = gapStart - gz;
        walls.push({ id: `${prefix}_v_${ix}_${iz}_a`, pos: { x: gx, y: WALL_H / 2, z: gz + len / 2 }, size: { x: wallT, y: WALL_H, z: len }, color: WALL_COLOR });
      }
      if (gz + CELL > gapEnd) {
        const len = gz + CELL - gapEnd;
        walls.push({ id: `${prefix}_v_${ix}_${iz}_b`, pos: { x: gx, y: WALL_H / 2, z: gapEnd + len / 2 }, size: { x: wallT, y: WALL_H, z: len }, color: WALL_COLOR });
      }
    }
  }

  // Horizontal partitions (fixed z, spanning x)
  for (let li = 0; li < 2; li++) {
    const iz = izBase + li;
    const gz = iz * CELL;
    for (let ci = 0; ci < 2; ci++) {
      const ix = ixBase + ci;
      const gx = ix * CELL;
      const rand = mulberry32(hashSeed(ix, iz, 2));
      const doorCenter = gx + CELL / 2 + (rand() - 0.5) * (CELL - doorW - 2);
      const gapStart = doorCenter - doorW / 2;
      const gapEnd = doorCenter + doorW / 2;

      if (gapStart > gx) {
        const len = gapStart - gx;
        walls.push({ id: `${prefix}_h_${ix}_${iz}_a`, pos: { x: gx + len / 2, y: WALL_H / 2, z: gz }, size: { x: len, y: WALL_H, z: wallT }, color: WALL_COLOR });
      }
      if (gx + CELL > gapEnd) {
        const len = gx + CELL - gapEnd;
        walls.push({ id: `${prefix}_h_${ix}_${iz}_b`, pos: { x: gapEnd + len / 2, y: WALL_H / 2, z: gz }, size: { x: len, y: WALL_H, z: wallT }, color: WALL_COLOR });
      }
    }
  }

  // Sparse buzzing fluorescent fixtures — deterministic per cell, roughly 2 out of every 5 cells lit.
  for (let li = 0; li < 2; li++) {
    const ix = ixBase + li;
    for (let ci = 0; ci < 2; ci++) {
      const iz = izBase + ci;
      const rand = mulberry32(hashSeed(ix, iz, 3));
      if (rand() > 0.4) continue;
      walls.push({
        id: `${prefix}_light_${ix}_${iz}`,
        pos: { x: ix * CELL + CELL / 2, y: WALL_H - 0.05, z: iz * CELL + CELL / 2 },
        size: { x: 3.5, y: 0.15, z: 0.9 },
        color: LIGHT_COLOR,
        emissive: true,
      });
    }
  }

  return walls;
}

export function getXonoticMap(): { walls: MapWall[]; jumpPads: JumpPad[]; pickups: PickupItem[] } {
  const walls: MapWall[] = [];
  const jumpPads: JumpPad[] = [];
  const pickups: PickupItem[] = [];

  // Hub Width & Length — the hand-authored core; the maze continues forever beyond it (see
  // generateStreamedChunk above), so this size is just where the fixed portal/pickup layout ends.
  const sizeX = 160;
  const sizeZ = 160;
  const halfX = sizeX / 2;
  const halfZ = sizeZ / 2;

  const wallColor = WALL_COLOR;
  const ceilingColor = CEILING_COLOR;
  const lightColor = LIGHT_COLOR;
  const carpetColor = CARPET_COLOR;

  // 1. FLOOR — one continuous damp carpet slab spanning the whole hub
  walls.push({
    id: 'floor_main',
    pos: { x: 0, y: -0.5, z: 0 },
    size: { x: sizeX, y: 1, z: sizeZ },
    color: carpetColor,
  });

  // No perimeter walls — the hub opens directly into the infinite streamed maze on every side.

  // 2. INTERIOR MAZE — dense core in the middle 120x120, leaving a 20-unit-wide open hallway ring
  // around the perimeter (this keeps every existing enemy spawn point and the outer armor pickups,
  // which all sit at |x| or |z| >= 45, safely out in open floor instead of embedded in a wall).
  const innerHalf = 60;    // maze core spans [-60, 60]
  const cell = CELL;       // grid cell size
  const wallH = WALL_H;    // backrooms ceiling height
  const wallT = 0.5;       // partition thickness
  const doorW = 4;         // doorway gap width
  const gridLines = [-40, -20, 0, 20, 40]; // interior partition lines within the core

  // Portal vent-shaft occupies the single cell spanning x:[-40,-20], z:[-40,-20]
  const shaftMinX = -40, shaftMaxX = -20, shaftMinZ = -40, shaftMaxZ = -20;

  let mazeIdCounter = 0;

  // Vertical-running partitions (fixed x, spanning z) — split per cell with a randomized doorway gap
  gridLines.forEach(gx => {
    for (let gz = -innerHalf; gz < innerHalf; gz += cell) {
      const doorCenter = gz + cell / 2 + (Math.random() - 0.5) * (cell - doorW - 2);
      const gapStart = doorCenter - doorW / 2;
      const gapEnd = doorCenter + doorW / 2;

      if (gapStart > gz) {
        const len = gapStart - gz;
        walls.push({ id: `maze_v_${mazeIdCounter++}`, pos: { x: gx, y: wallH / 2, z: gz + len / 2 }, size: { x: wallT, y: wallH, z: len }, color: wallColor });
      }
      if (gz + cell > gapEnd) {
        const len = gz + cell - gapEnd;
        walls.push({ id: `maze_v_${mazeIdCounter++}`, pos: { x: gx, y: wallH / 2, z: gapEnd + len / 2 }, size: { x: wallT, y: wallH, z: len }, color: wallColor });
      }
    }
  });

  // Horizontal-running partitions (fixed z, spanning x)
  gridLines.forEach(gz => {
    for (let gx = -innerHalf; gx < innerHalf; gx += cell) {
      const doorCenter = gx + cell / 2 + (Math.random() - 0.5) * (cell - doorW - 2);
      const gapStart = doorCenter - doorW / 2;
      const gapEnd = doorCenter + doorW / 2;

      if (gapStart > gx) {
        const len = gapStart - gx;
        walls.push({ id: `maze_h_${mazeIdCounter++}`, pos: { x: gx + len / 2, y: wallH / 2, z: gz }, size: { x: len, y: wallH, z: wallT }, color: wallColor });
      }
      if (gx + cell > gapEnd) {
        const len = gx + cell - gapEnd;
        walls.push({ id: `maze_h_${mazeIdCounter++}`, pos: { x: gapEnd + len / 2, y: wallH / 2, z: gz }, size: { x: len, y: wallH, z: wallT }, color: wallColor });
      }
    }
  });

  // 3. CEILING — a single unbroken slab over the *entire* hub footprint (inner maze AND the outer
  // hallway ring alike), framed with a hole only above the portal shaft cell. Backrooms is indoor:
  // there must be no gap anywhere that leaves open air over the player's head.
  const ceilingY = wallH + 0.15;
  const leftW = shaftMinX - (-halfX);
  const rightW = halfX - shaftMaxX;
  const midW = shaftMaxX - shaftMinX;
  const topD = shaftMinZ - (-halfZ);
  const bottomD = halfZ - shaftMaxZ;
  walls.push({ id: 'ceiling_left', pos: { x: (-halfX + shaftMinX) / 2, y: ceilingY, z: 0 }, size: { x: leftW, y: 0.3, z: sizeZ }, color: ceilingColor });
  walls.push({ id: 'ceiling_right', pos: { x: (shaftMaxX + halfX) / 2, y: ceilingY, z: 0 }, size: { x: rightW, y: 0.3, z: sizeZ }, color: ceilingColor });
  walls.push({ id: 'ceiling_top', pos: { x: (shaftMinX + shaftMaxX) / 2, y: ceilingY, z: (-halfZ + shaftMinZ) / 2 }, size: { x: midW, y: 0.3, z: topD }, color: ceilingColor });
  walls.push({ id: 'ceiling_bottom', pos: { x: (shaftMinX + shaftMaxX) / 2, y: ceilingY, z: (shaftMaxZ + halfZ) / 2 }, size: { x: midW, y: 0.3, z: bottomD }, color: ceilingColor });

  // 4. BUZZING FLUORESCENT FIXTURES — checkerboard placement at cell centers under the ceiling
  const cellCenters = [-50, -30, -10, 10, 30, 50];
  cellCenters.forEach((cx, ci) => {
    cellCenters.forEach((cz, zi) => {
      const isShaftCell = cx > shaftMinX && cx < shaftMaxX && cz > shaftMinZ && cz < shaftMaxZ;
      if (isShaftCell || (ci + zi) % 2 !== 0) return;
      walls.push({
        id: `light_${ci}_${zi}`,
        pos: { x: cx, y: wallH - 0.05, z: cz },
        size: { x: 3.5, y: 0.15, z: 0.9 },
        color: lightColor,
        emissive: true,
      });
    });
  });

  // 5. PORTAL VENT SHAFT — tall solid chimney continuing straight up from the ceiling to the
  // rooftop portal volume; ground-level access into this cell uses the same doorways as any other
  // maze room (generated above), the shaft only seals off the space *above* ceiling height.
  const shaftCx = (shaftMinX + shaftMaxX) / 2;
  const shaftCz = (shaftMinZ + shaftMaxZ) / 2;
  const shaftHalf = (shaftMaxX - shaftMinX) / 2;
  const shaftBottom = wallH;
  const shaftTop = 20;
  const shaftH = shaftTop - shaftBottom;
  const shaftW = shaftMaxX - shaftMinX;
  walls.push({ id: 'shaft_n', pos: { x: shaftCx, y: shaftBottom + shaftH / 2, z: shaftCz - shaftHalf }, size: { x: shaftW, y: shaftH, z: wallT }, color: wallColor });
  walls.push({ id: 'shaft_s', pos: { x: shaftCx, y: shaftBottom + shaftH / 2, z: shaftCz + shaftHalf }, size: { x: shaftW, y: shaftH, z: wallT }, color: wallColor });
  walls.push({ id: 'shaft_w', pos: { x: shaftCx - shaftHalf, y: shaftBottom + shaftH / 2, z: shaftCz }, size: { x: wallT, y: shaftH, z: shaftW }, color: wallColor });
  walls.push({ id: 'shaft_e', pos: { x: shaftCx + shaftHalf, y: shaftBottom + shaftH / 2, z: shaftCz }, size: { x: wallT, y: shaftH, z: shaftW }, color: wallColor });

  // 6. PICKUPS
  // Mega HP now sits at the top of the vent shaft next to the portal — the rocket-jump reward.
  pickups.push({ id: 'mega_hp', type: 'health_mega', pos: { x: -28, y: 18.5, z: -34.5 }, radius: 2, respawnTimer: 0, value: 100 });

  pickups.push({ id: 'mega_arm_1', type: 'armor_mega', pos: { x: -14, y: 1.5, z: -12 }, radius: 1.8, respawnTimer: 0, value: 100 });
  pickups.push({ id: 'mega_arm_2', type: 'armor_mega', pos: { x: 14, y: 1.5, z: -12 }, radius: 1.8, respawnTimer: 0, value: 100 });

  // Outer hallway ring armor drops
  pickups.push({ id: 'armor_o_1', type: 'armor_mega', pos: { x: -55, y: 1.5, z: 0 }, radius: 1.8, respawnTimer: 0, value: 100 });
  pickups.push({ id: 'armor_o_2', type: 'armor_mega', pos: { x: 55, y: 1.5, z: 0 }, radius: 1.8, respawnTimer: 0, value: 100 });

  // Ammo drops — inner quadrants
  pickups.push({ id: 'ammo_1', type: 'ammo', pos: { x: -15, y: 1, z: -15 }, radius: 1, respawnTimer: 0, value: 20 });
  pickups.push({ id: 'ammo_2', type: 'ammo', pos: { x: 15, y: 1, z: -15 }, radius: 1, respawnTimer: 0, value: 20 });
  pickups.push({ id: 'ammo_3', type: 'ammo', pos: { x: -15, y: 1, z: 15 }, radius: 1, respawnTimer: 0, value: 20 });
  pickups.push({ id: 'ammo_4', type: 'ammo', pos: { x: 15, y: 1, z: 15 }, radius: 1, respawnTimer: 0, value: 20 });
  // Ammo drops — outer hallway ring
  pickups.push({ id: 'ammo_5', type: 'ammo', pos: { x: -45, y: 1, z: -45 }, radius: 1, respawnTimer: 0, value: 20 });
  pickups.push({ id: 'ammo_6', type: 'ammo', pos: { x: 45, y: 1, z: -45 }, radius: 1, respawnTimer: 0, value: 20 });
  pickups.push({ id: 'ammo_7', type: 'ammo', pos: { x: -45, y: 1, z: 45 }, radius: 1, respawnTimer: 0, value: 20 });
  pickups.push({ id: 'ammo_8', type: 'ammo', pos: { x: 45, y: 1, z: 45 }, radius: 1, respawnTimer: 0, value: 20 });

  return { walls, jumpPads, pickups };
}
