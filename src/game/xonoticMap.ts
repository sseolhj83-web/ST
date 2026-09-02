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
// that always holds the same pickups and the one flickering escape wall.
// Beyond the hub, generateStreamedChunk() extends the exact same yellow-partition grid outward
// forever, streamed in/out around the player by xonoticEngine.ts / XonoticCanvas.tsx, so the maze
// itself never ends. Every surface — hub and streamed alike — sits under a solid, unbroken
// ceiling; there is no sky and no hole anywhere.

export const WALL_COLOR = '#C9BE6D';    // damp yellow wallpaper
export const CEILING_COLOR = '#DCD7C8'; // off-white popcorn ceiling tile
export const LIGHT_COLOR = '#fef9c3';   // buzzing fluorescent tube
export const CARPET_COLOR = '#D2B48C';  // tan carpet
export const PUDDLE_COLOR = '#4a4326';  // stagnant, contaminated floor water

export const WALL_H = 7.0; // backrooms ceiling height
export const CELL = 20;    // maze partition grid spacing, shared by the hub and every streamed chunk

// The single flickering wall that lets you escape — deliberately just one stub wall inside one
// ordinary-looking room, easy to miss, and tucked in the far corner of the maze core diagonally
// opposite SPAWN_POINT so it's never in sight (or even in the same quadrant) when the run starts.
// It never blocks movement (see xonoticEngine.ts checkWallAxisBound); walking into it ends the run
// in victory (see stepSimulator).
export const ESCAPE_WALL_ID = 'escape_wall';
export const ESCAPE_WALL_POS = { x: -33, y: WALL_H / 2, z: -47 };

// A safe, always-open spawn point out in the hallway ring, clear of every partition wall.
export const SPAWN_POINT = { x: 0, y: 1.5, z: 70 };

export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(a: number, b: number, c: number): number {
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
  const prefix = `stream_${cx}_${cz}`;
  const originX = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
  const originZ = cz * CHUNK_SIZE + CHUNK_SIZE / 2;

  // Floor + a full, unbroken ceiling slab — fully enclosed, indoor, no sky ever visible.
  walls.push({ id: `floor_${prefix}`, pos: { x: originX, y: -0.5, z: originZ }, size: { x: CHUNK_SIZE, y: 1, z: CHUNK_SIZE }, color: CARPET_COLOR });
  walls.push({ id: `${prefix}_ceiling`, pos: { x: originX, y: WALL_H + 0.15, z: originZ }, size: { x: CHUNK_SIZE, y: 0.3, z: CHUNK_SIZE }, color: CEILING_COLOR });

  const ixBase = cx * 2; // this chunk owns cell-index columns/rows ixBase and ixBase+1
  const izBase = cz * 2;

  // A real maze needs walls that are usually SOLID with only occasional doorways — not a door on
  // every single cell boundary, which is just an open dungeon grid you can walk through in any
  // direction. Each cell edge independently (and deterministically, via a hash of its own grid
  // coordinates, so collision/render copies always agree) rolls whether it gets a doorway at all.
  // ~55% stays just above the ~50% bond-percolation threshold of a square grid, so the maze remains
  // mostly one connected sprawl while still generating plenty of dead ends and forced detours.
  const OPEN_CHANCE = 0.55;

  // Vertical partitions (fixed x, spanning z)
  for (let li = 0; li < 2; li++) {
    const ix = ixBase + li;
    const gx = ix * CELL;
    for (let ci = 0; ci < 2; ci++) {
      const iz = izBase + ci;
      const gz = iz * CELL;
      const wallT = 0.2 + mulberry32(hashSeed(ix, iz, 6))() * 2.0; // 0.2 (paper-thin) to 2.2 (very thick) — no two walls match
      const open = mulberry32(hashSeed(ix, iz, 8))() < OPEN_CHANCE;

      if (!open) {
        walls.push({ id: `${prefix}_v_${ix}_${iz}`, pos: { x: gx, y: WALL_H / 2, z: gz + CELL / 2 }, size: { x: wallT, y: WALL_H, z: CELL }, color: WALL_COLOR });
        continue;
      }

      const rand = mulberry32(hashSeed(ix, iz, 1));
      const doorW = 2.5 + mulberry32(hashSeed(ix, iz, 4))() * 2.2; // 2.5-4.7, tighter than before — narrower doorways read as more maze-like
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
      const wallT = 0.2 + mulberry32(hashSeed(ix, iz, 7))() * 2.0; // 0.2 (paper-thin) to 2.2 (very thick) — no two walls match
      const open = mulberry32(hashSeed(ix, iz, 9))() < OPEN_CHANCE;

      if (!open) {
        walls.push({ id: `${prefix}_h_${ix}_${iz}`, pos: { x: gx + CELL / 2, y: WALL_H / 2, z: gz }, size: { x: CELL, y: WALL_H, z: wallT }, color: WALL_COLOR });
        continue;
      }

      const rand = mulberry32(hashSeed(ix, iz, 2));
      const doorW = 2.5 + mulberry32(hashSeed(ix, iz, 5))() * 2.2; // 2.5-4.7, tighter than before — narrower doorways read as more maze-like
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

  // Buzzing fluorescent fixtures — clustered into zones instead of an independent per-cell coin
  // flip. A flat 90% chance per cell only ever produces single unlit rooms surrounded by lit
  // neighbors (light bleeds between rooms with no occlusion), never an actual dark stretch. Real
  // Backrooms photos are DENSELY lit almost everywhere, with only occasional patches plunged into
  // near-total dark — so a coarse per-zone roll decides whether this whole ~4-cell block is a lit
  // zone (~97% of its cells lit, i.e. lights nearly everywhere) or a dark zone (only ~8% lit, just
  // enough that it isn't pure black), and lit zones are the large majority.
  const FIXTURE_ZONE_CELLS = 4; // zone spans a 4x4 block of cells (~80 units per side)
  for (let li = 0; li < 2; li++) {
    const ix = ixBase + li;
    for (let ci = 0; ci < 2; ci++) {
      const iz = izBase + ci;
      const zoneX = Math.floor(ix / FIXTURE_ZONE_CELLS);
      const zoneZ = Math.floor(iz / FIXTURE_ZONE_CELLS);
      const isDarkZone = mulberry32(hashSeed(zoneX, zoneZ, 600))() < 0.18;
      const litChance = isDarkZone ? 0.08 : 0.97;
      const rand = mulberry32(hashSeed(ix, iz, 3));
      if (rand() > litChance) continue;
      const baseX = ix * CELL + CELL / 2;
      const baseZ = iz * CELL + CELL / 2;
      walls.push({
        id: `${prefix}_light_${ix}_${iz}`,
        pos: { x: baseX, y: WALL_H - 0.05, z: baseZ },
        size: { x: 3.5, y: 0.15, z: 0.9 },
        color: LIGHT_COLOR,
        emissive: true,
      });
      // A real Backrooms ceiling has rows of tube lights, not one fixture per room — two more
      // flank the primary tube. Decorative only (lightDecor): they don't feed the roaming
      // light-pool's target list (see XonoticCanvas.tsx), just add ceiling density.
      [-6, 6].forEach((offset, oi) => {
        walls.push({
          id: `${prefix}_light_${ix}_${iz}_extra${oi}`,
          pos: { x: baseX + offset, y: WALL_H - 0.05, z: baseZ },
          size: { x: 3.5, y: 0.15, z: 0.9 },
          color: LIGHT_COLOR,
          emissive: true,
          lightDecor: true,
        });
      });
    }
  }

  return walls;
}

// Builds a genuine perfect maze (randomized-DFS spanning tree) over an NxN cell grid, so every cell
// is guaranteed reachable from every other — shared by the Level 1 hub below and the Level 2 hotel
// hub (see xonoticMapLevel2.ts). vOpen[i][j]: passage between column i and i+1 at row j. hOpen[j][i]:
// passage between row j and j+1 at column i. A fixed seed keeps it identical on every call.
export function buildPerfectMaze(cells: number, seed = 0x9e3779b9, braid = 0.12) {
  const rand = mulberry32(seed);
  const visited: boolean[][] = Array.from({ length: cells }, () => new Array(cells).fill(false));
  const vOpen: boolean[][] = Array.from({ length: cells - 1 }, () => new Array(cells).fill(false));
  const hOpen: boolean[][] = Array.from({ length: cells - 1 }, () => new Array(cells).fill(false));

  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;
  while (stack.length > 0) {
    const [i, j] = stack[stack.length - 1];
    const options: Array<{ open: () => void; ni: number; nj: number }> = [];
    if (i > 0 && !visited[i - 1][j]) options.push({ open: () => { vOpen[i - 1][j] = true; }, ni: i - 1, nj: j });
    if (i < cells - 1 && !visited[i + 1][j]) options.push({ open: () => { vOpen[i][j] = true; }, ni: i + 1, nj: j });
    if (j > 0 && !visited[i][j - 1]) options.push({ open: () => { hOpen[j - 1][i] = true; }, ni: i, nj: j - 1 });
    if (j < cells - 1 && !visited[i][j + 1]) options.push({ open: () => { hOpen[j][i] = true; }, ni: i, nj: j + 1 });

    if (options.length === 0) { stack.pop(); continue; }
    const pick = options[Math.floor(rand() * options.length)];
    pick.open();
    visited[pick.ni][pick.nj] = true;
    stack.push([pick.ni, pick.nj]);
  }

  for (let i = 0; i < cells - 1; i++) for (let j = 0; j < cells; j++) if (!vOpen[i][j] && rand() < braid) vOpen[i][j] = true;
  for (let j = 0; j < cells - 1; j++) for (let i = 0; i < cells; i++) if (!hOpen[j][i] && rand() < braid) hOpen[j][i] = true;

  return { vOpen, hOpen };
}

// Builds a genuine perfect maze (randomized-DFS spanning tree) over the hub's 6x6 core cell grid,
// so every cell is guaranteed reachable from every other cell — safe for the fixed escape wall and
// pickups, which all sit inside this grid — while still producing real corridors and dead ends
// instead of a fully-doored open grid. A fixed seed keeps it identical on every call.
function buildHubMazeGraph(cells: number) {
  const rand = mulberry32(0x9e3779b9);
  const visited: boolean[][] = Array.from({ length: cells }, () => new Array(cells).fill(false));
  // vOpen[i][j]: doorway between column i and column i+1, at row j (i: 0..cells-2)
  const vOpen: boolean[][] = Array.from({ length: cells - 1 }, () => new Array(cells).fill(false));
  // hOpen[j][i]: doorway between row j and row j+1, at column i (j: 0..cells-2)
  const hOpen: boolean[][] = Array.from({ length: cells - 1 }, () => new Array(cells).fill(false));

  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;
  while (stack.length > 0) {
    const [i, j] = stack[stack.length - 1];
    const options: Array<{ open: () => void; ni: number; nj: number }> = [];
    if (i > 0 && !visited[i - 1][j]) options.push({ open: () => { vOpen[i - 1][j] = true; }, ni: i - 1, nj: j });
    if (i < cells - 1 && !visited[i + 1][j]) options.push({ open: () => { vOpen[i][j] = true; }, ni: i + 1, nj: j });
    if (j > 0 && !visited[i][j - 1]) options.push({ open: () => { hOpen[j - 1][i] = true; }, ni: i, nj: j - 1 });
    if (j < cells - 1 && !visited[i][j + 1]) options.push({ open: () => { hOpen[j][i] = true; }, ni: i, nj: j + 1 });

    if (options.length === 0) { stack.pop(); continue; }
    const pick = options[Math.floor(rand() * options.length)];
    pick.open();
    visited[pick.ni][pick.nj] = true;
    stack.push([pick.ni, pick.nj]);
  }

  // Light braiding — open a few extra edges beyond the spanning tree so it isn't a strict
  // single-solution labyrinth, while staying mostly closed/maze-like.
  for (let i = 0; i < cells - 1; i++) for (let j = 0; j < cells; j++) if (!vOpen[i][j] && rand() < 0.12) vOpen[i][j] = true;
  for (let j = 0; j < cells - 1; j++) for (let i = 0; i < cells; i++) if (!hOpen[j][i] && rand() < 0.12) hOpen[j][i] = true;

  return { vOpen, hOpen };
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
  const doorW = 3.2;       // doorway gap width — narrower than the old 4 for tighter, more maze-like passages
  const gridLines = [-40, -20, 0, 20, 40]; // interior partition lines within the core
  const cellsPerAxis = gridLines.length + 1; // 6 columns/rows of cells across the core

  let mazeIdCounter = 0;

  // A genuine maze graph (spanning tree + light braiding) over the 6x6 core — see buildHubMazeGraph.
  // Every cell is guaranteed reachable, so the escape wall/pickups can never be sealed off.
  const { vOpen, hOpen } = buildHubMazeGraph(cellsPerAxis);

  // Vertical-running partitions (fixed x, spanning z) — solid by default; only carved into a
  // doorway where the maze graph says this edge is part of the path network.
  gridLines.forEach((gx, li) => {
    for (let gz = -innerHalf; gz < innerHalf; gz += cell) {
      const row = (gz + innerHalf) / cell;
      const wallT = 0.2 + mulberry32(hashSeed(gx, gz, 102))() * 2.0; // 0.2 (paper-thin) to 2.2 (very thick) — no two walls match

      if (!vOpen[li][row]) {
        walls.push({ id: `maze_v_${mazeIdCounter++}`, pos: { x: gx, y: wallH / 2, z: gz + cell / 2 }, size: { x: wallT, y: wallH, z: cell }, color: wallColor });
        continue;
      }

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

  // Horizontal-running partitions (fixed z, spanning x) — same maze-graph gating as above.
  gridLines.forEach((gz, lj) => {
    for (let gx = -innerHalf; gx < innerHalf; gx += cell) {
      const col = (gx + innerHalf) / cell;
      const wallT = 0.2 + mulberry32(hashSeed(gx, gz, 103))() * 2.0; // 0.2 (paper-thin) to 2.2 (very thick) — no two walls match

      if (!hOpen[lj][col]) {
        walls.push({ id: `maze_h_${mazeIdCounter++}`, pos: { x: gx + cell / 2, y: wallH / 2, z: gz }, size: { x: cell, y: wallH, z: wallT }, color: wallColor });
        continue;
      }

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

  // 4. BUZZING FLUORESCENT FIXTURES — every cell used to get a light unconditionally, which meant
  // the hub (where the run starts, and where the player spends the most time) never had a single
  // dark room. Same zone-clustering as the streamed maze below: most of the hub is a well-lit zone,
  // but a few ~2x2-cell patches are dark zones where fixtures mostly don't spawn at all.
  const cellCenters = [-50, -30, -10, 10, 30, 50];
  const HUB_FIXTURE_ZONE_CELLS = 2; // zone spans a 2x2 block of cells -> 3x3 zones across the hub core
  cellCenters.forEach((cx, ci) => {
    cellCenters.forEach((cz, zi) => {
      const zoneX = Math.floor(ci / HUB_FIXTURE_ZONE_CELLS);
      const zoneZ = Math.floor(zi / HUB_FIXTURE_ZONE_CELLS);
      const isDarkZone = mulberry32(hashSeed(zoneX, zoneZ, 601))() < 0.18;
      const litChance = isDarkZone ? 0.1 : 0.98;
      const rand = mulberry32(hashSeed(cx, cz, 8));
      if (rand() > litChance) return;
      walls.push({
        id: `light_${ci}_${zi}`,
        pos: { x: cx, y: wallH - 0.05, z: cz },
        size: { x: 3.5, y: 0.15, z: 0.9 },
        color: lightColor,
        emissive: true,
      });
      // Same ceiling-density touch as the streamed maze: two flanking decorative tubes per lit
      // cell, excluded from the roaming light-pool's target list (see lightDecor in xonoticTypes.ts).
      [-6, 6].forEach((offset, oi) => {
        walls.push({
          id: `light_${ci}_${zi}_extra${oi}`,
          pos: { x: cx + offset, y: wallH - 0.05, z: cz },
          size: { x: 3.5, y: 0.15, z: 0.9 },
          color: lightColor,
          emissive: true,
          lightDecor: true,
        });
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
    size: { x: 8, y: wallH, z: 0.5 },
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

// Decorative, non-collidable human-shaped mannequins standing motionless in a handful of hub
// rooms — visual-only set dressing (never added to engine collision), just something unsettling
// to catch in the flashlight beam. Placed at hub maze cell centers (see cellCenters in
// getXonoticMap) so every position sits in open room interior, never inside a partition wall.
// rotationY is where each one is facing (radians) — deliberately arbitrary/unnatural angles, not
// aligned to the corridor, since a motionless figure facing an odd direction reads as far more
// wrong than one facing the doorway.
export function getMannequins(): { x: number; z: number; rotationY: number }[] {
  return [
    { x: -50, z: -50, rotationY: 2.3 },
    { x: -10, z: -30, rotationY: 0.6 },
    { x: 30, z: -10, rotationY: 4.1 },
    { x: 50, z: 50, rotationY: 1.2 },
    { x: -30, z: 30, rotationY: 5.4 },
    { x: 10, z: 10, rotationY: 3.0 },
    { x: -50, z: 10, rotationY: 0.1 },
  ];
}
