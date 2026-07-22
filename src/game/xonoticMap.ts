/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapWall, JumpPad, PickupItem } from './xonoticTypes';

// The Backrooms — an endless, windowless maze of identical rooms. No storyline, no dimension
// gate, nothing outdoors: just damp yellow wallpaper, buzzing fluorescent tubes, and a moist
// carpet stretching further than anyone has mapped.
//
// This file builds a hand-authored 160x160 "hub" (getXonoticMap) — the guaranteed-reachable core
// that always holds the same pickups, the one Red Room, and the one flickering escape wall.
// Beyond the hub, generateStreamedChunk() extends the exact same yellow-partition grid outward
// forever, streamed in/out around the player by xonoticEngine.ts / XonoticCanvas.tsx, so the maze
// itself never ends. Every surface — hub and streamed alike — sits under a solid, unbroken
// ceiling; there is no sky and no hole anywhere.

export const WALL_COLOR = '#C9BE6D';    // damp yellow wallpaper
export const CEILING_COLOR = '#FAF9F6'; // off-white popcorn ceiling tile
export const LIGHT_COLOR = '#fef9c3';   // buzzing fluorescent tube
export const CARPET_COLOR = '#D2B48C';  // tan carpet
export const PUDDLE_COLOR = '#4a4326';  // stagnant, contaminated floor water

export const WALL_H = 6.5; // backrooms ceiling height
export const CELL = 20;    // maze partition grid spacing, shared by the hub and every streamed chunk

// The single flickering wall that lets you escape — deliberately just one stub wall inside one
// ordinary-looking room, easy to miss, and tucked in the far corner of the maze core diagonally
// opposite SPAWN_POINT so it's never in sight (or even in the same quadrant) when the run starts.
// It never blocks movement (see xonoticEngine.ts checkWallAxisBound); walking into it ends the run
// in victory (see stepSimulator).
export const ESCAPE_WALL_ID = 'escape_wall';
export const ESCAPE_WALL_POS = { x: -33, y: WALL_H / 2, z: -47 };

// The Red Room — one fixed, unmarked spot in the hub. Stray inside it and your peripheral vision
// turns red for the rest of the run: there is no way back out (see stepSimulator's curse damage).
export const RED_ROOM_CENTER = { x: -52, z: 52 };
export const RED_ROOM_RADIUS = 9;

// A safe, always-open spawn point out in the hallway ring, clear of every partition wall.
export const SPAWN_POINT = { x: 0, y: 1.5, z: 70 };

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

  // Buzzing fluorescent fixtures — deterministic per cell, roughly 9 out of every 10 cells lit.
  for (let li = 0; li < 2; li++) {
    const ix = ixBase + li;
    for (let ci = 0; ci < 2; ci++) {
      const iz = izBase + ci;
      const rand = mulberry32(hashSeed(ix, iz, 3));
      if (rand() > 0.9) continue;
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
  // generateStreamedChunk above), so this size is just where the fixed layout ends.
  const sizeX = 160;
  const sizeZ = 160;

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
  // around the perimeter. Doorway gaps are seeded by each wall's own grid coordinates (not
  // Math.random()) so the engine's collision copy and the canvas's render copy — two independent
  // calls to this function — always produce the exact same layout.
  const innerHalf = 60;    // maze core spans [-60, 60]
  const cell = CELL;       // grid cell size
  const wallH = WALL_H;    // backrooms ceiling height
  const wallT = 0.5;       // partition thickness
  const doorW = 4;         // doorway gap width
  const gridLines = [-40, -20, 0, 20, 40]; // interior partition lines within the core

  let mazeIdCounter = 0;

  // Vertical-running partitions (fixed x, spanning z) — split per cell with a deterministic doorway gap
  gridLines.forEach(gx => {
    for (let gz = -innerHalf; gz < innerHalf; gz += cell) {
      const rand = mulberry32(hashSeed(gx, gz, 100));
      const doorCenter = gz + cell / 2 + (rand() - 0.5) * (cell - doorW - 2);
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
      const rand = mulberry32(hashSeed(gx, gz, 101));
      const doorCenter = gx + cell / 2 + (rand() - 0.5) * (cell - doorW - 2);
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

  // 3. CEILING — a single unbroken slab over the entire hub footprint. No holes, no shafts, no
  // sky anywhere — this is the Backrooms, it is entirely indoors.
  walls.push({ id: 'ceiling_main', pos: { x: 0, y: wallH + 0.15, z: 0 }, size: { x: sizeX, y: 0.3, z: sizeZ }, color: ceilingColor });

  // 4. BUZZING FLUORESCENT FIXTURES — dense grid at every cell center under the ceiling
  const cellCenters = [-50, -30, -10, 10, 30, 50];
  cellCenters.forEach((cx, ci) => {
    cellCenters.forEach((cz, zi) => {
      walls.push({
        id: `light_${ci}_${zi}`,
        pos: { x: cx, y: wallH - 0.05, z: cz },
        size: { x: 3.5, y: 0.15, z: 0.9 },
        color: lightColor,
        emissive: true,
      });
    });
  });

  // 5. THE ESCAPE WALL — one unremarkable-looking stub wall tucked inside an ordinary room, deep
  // enough in the maze that stumbling onto it takes real exploring. It never blocks movement (see
  // xonoticEngine.ts checkWallAxisBound) — walking through it is how the run is won. Rendered with
  // a severe flicker (see XonoticCanvas.tsx) as the only hint it isn't just another wall.
  walls.push({
    id: ESCAPE_WALL_ID,
    pos: { x: ESCAPE_WALL_POS.x, y: ESCAPE_WALL_POS.y, z: ESCAPE_WALL_POS.z },
    size: { x: 8, y: wallH, z: wallT },
    color: wallColor,
    flicker: true,
  });

  // 6. PICKUPS
  pickups.push({ id: 'mega_hp', type: 'health_mega', pos: { x: -28, y: 1.5, z: -34.5 }, radius: 2, respawnTimer: 0, value: 100 });

  pickups.push({ id: 'mega_arm_1', type: 'armor_mega', pos: { x: -14, y: 1.5, z: -12 }, radius: 1.8, respawnTimer: 0, value: 100 });
  pickups.push({ id: 'mega_arm_2', type: 'armor_mega', pos: { x: 14, y: 1.5, z: -12 }, radius: 1.8, respawnTimer: 0, value: 100 });

  // Outer hallway ring armor drops
  pickups.push({ id: 'armor_o_1', type: 'armor_mega', pos: { x: -55, y: 1.5, z: 0 }, radius: 1.8, respawnTimer: 0, value: 100 });
  pickups.push({ id: 'armor_o_2', type: 'armor_mega', pos: { x: 55, y: 1.5, z: 0 }, radius: 1.8, respawnTimer: 0, value: 100 });

  return { walls, jumpPads, pickups };
}

// Decorative, non-collidable puddles of contaminated standing water — visual only, rendered
// directly from this fixed list by XonoticCanvas.tsx (never added to the engine's collision walls).
export function getPuddles(): { x: number; z: number; radius: number }[] {
  return [
    { x: -10, z: 5, radius: 2.4 },
    { x: 25, z: -35, radius: 1.8 },
    { x: -35, z: -8, radius: 2.1 },
    { x: 12, z: 45, radius: 1.6 },
    { x: -48, z: 30, radius: 2.6 },
    { x: 5, z: -55, radius: 1.9 },
    { x: 42, z: 10, radius: 2.2 },
    { x: -22, z: -48, radius: 1.7 },
  ];
}
