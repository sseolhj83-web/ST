/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapWall, JumpPad, PickupItem } from './xonoticTypes';
import { mulberry32, hashSeed, buildPerfectMaze } from './xonoticMap';

// ── BACKROOMS LEVEL 2 — "THE HOTEL" ─────────────────────────────────────────────────────────────
// You only reach here by escaping Level 1. This is an endless run-down hotel: an orthogonal grid of
// narrow corridors that never ends. Yellowed-beige wallpaper over dark walnut wainscoting, a brown
// patterned carpet, evenly repeating brown doors down both walls of every hall (painted into the
// wall texture — one door mesh per hall would be thousands of meshes), and a fluorescent tube
// running the ceiling of every corridor segment as far as the eye (and the flashlight) can see.
//
// getLevel2Map() builds a fixed 8x8-block hub around spawn, carved by a genuine perfect maze so the
// flickering escape corridor in the far corner is always reachable. generateLevel2Chunk() tiles the
// same corridor grid outward forever, streamed around the player by xonoticEngine.ts / the canvas.

export const L2_WALLPAPER_COLOR = '#b5a15c'; // yellowed beige wallpaper (upper wall)
export const L2_WAINSCOT_COLOR = '#3a2718';  // dark walnut wood paneling (lower wall)
export const L2_CARPET_COLOR = '#4a3120';    // brown patterned hallway carpet
export const L2_CEILING_COLOR = '#c7bb98';   // stained acoustic-tile ceiling
export const L2_LIGHT_COLOR = '#fff3d0';     // warm fluorescent tube
export const L2_DOOR_COLOR = '#40291a';      // painted-shut brown hotel door

export const L2_WALL_H = 4.5;   // low, oppressive hotel ceiling (vs Level 1's cavernous 7.0)
export const BLOCK = 24;        // corridor-grid spacing (one room block + one corridor)
export const CORRIDOR_W = 6;    // walkable hallway width
const ROOM = BLOCK - CORRIDOR_W; // 18 — the solid, non-enterable room block between corridors

export const L2_CHUNK_SIZE = BLOCK * 2;   // one streamed chunk = a 2x2 block of the corridor grid
export const L2_CHUNK_LOAD_RADIUS = 3;
const L2_HUB_HALF = 96;                   // hub spans blocks i,j in [-4, 3]  (crossings [-4, 4])

// A safe, always-open spawn at the central 4-way crossing.
export const L2_SPAWN_POINT = { x: 0, y: 1.5, z: 0 };

// The one flickering escape wall — a trigger, not a solid (see xonoticEngine.ts). Tucked in the far
// corner of the hub, down the x=+72 corridor. checkEscapeWall() ends the run when the player reaches
// within 2.2 units of it. The segment it sits in is force-opened after the maze is carved so a
// blocking wall can never seal it off.
export const L2_ESCAPE_WALL_ID = 'l2_escape_wall';
export const L2_ESCAPE_WALL_POS = { x: 72, y: L2_WALL_H / 2, z: -84 };

// The monster's lurk-start point — mid-corridor, clear of every block.
export const L2_MONSTER_SPAWN = { x: 0, y: 2, z: -48 };

// ── geometry helpers ───────────────────────────────────────────────────────────────────────────

// A solid, non-enterable room block for grid cell (i, j). The corridors are simply the negative
// space between these blocks; their faces are the hallway walls.
function pushBlock(walls: MapWall[], id: string, i: number, j: number) {
  const cx = (i + 0.5) * BLOCK;
  const cz = (j + 0.5) * BLOCK;
  walls.push({
    id,
    pos: { x: cx, y: L2_WALL_H / 2, z: cz },
    size: { x: ROOM, y: L2_WALL_H, z: ROOM },
    color: L2_WALLPAPER_COLOR,
  });
}

// A fluorescent tube centered over one corridor segment. `alongX` = the corridor runs east-west.
function pushLight(walls: MapWall[], id: string, x: number, z: number, alongX: boolean) {
  walls.push({
    id,
    pos: { x, y: L2_WALL_H - 0.08, z },
    size: alongX ? { x: 3.4, y: 0.16, z: 0.55 } : { x: 0.55, y: 0.16, z: 3.4 },
    color: L2_LIGHT_COLOR,
    emissive: true,
  });
}

// A wall panel capping a corridor segment the maze left closed (a dead end). `alongX` = the corridor
// it blocks runs east-west, so the panel is thin in x.
function pushBlocker(walls: MapWall[], id: string, x: number, z: number, alongX: boolean) {
  walls.push({
    id,
    pos: { x, y: L2_WALL_H / 2, z },
    size: alongX ? { x: 0.6, y: L2_WALL_H, z: CORRIDOR_W } : { x: CORRIDOR_W, y: L2_WALL_H, z: 0.6 },
    color: L2_WAINSCOT_COLOR,
  });
}

// ── the fixed hub ──────────────────────────────────────────────────────────────────────────────

export function getLevel2Map(): { walls: MapWall[]; jumpPads: JumpPad[]; pickups: PickupItem[] } {
  const walls: MapWall[] = [];
  const jumpPads: JumpPad[] = [];
  const pickups: PickupItem[] = [];

  const span = L2_HUB_HALF * 2 + 16; // a little overhang past the outer crossings

  // Floor (patterned carpet) + a single unbroken ceiling slab — fully enclosed, no sky.
  walls.push({ id: 'l2_floor_main', pos: { x: 0, y: -0.5, z: 0 }, size: { x: span, y: 1, z: span }, color: L2_CARPET_COLOR });
  walls.push({ id: 'l2_ceiling_main', pos: { x: 0, y: L2_WALL_H + 0.15, z: 0 }, size: { x: span, y: 0.3, z: span }, color: L2_CEILING_COLOR });

  // Room blocks: grid cells i, j in [-4, 3].
  for (let i = -4; i <= 3; i++) {
    for (let j = -4; j <= 3; j++) {
      pushBlock(walls, `l2_room_${i}_${j}`, i, j);
    }
  }

  // Carve the corridor grid with a genuine perfect maze over the 9x9 crossings (index 0..8 ↔
  // crossing coord -4..4), so the escape corridor is always reachable from spawn.
  const CELLS = 9;
  const { vOpen, hOpen } = buildPerfectMaze(CELLS, 0x5eed12, 0.16);

  // Force the escape wall's own segment open (crossing column +3 = index 7, between z-crossings
  // -4 and -3 = row index 0) so a blocker can never wall the player out of the win.
  hOpen[0][7] = true;

  // East-west corridor segments: closed ones get a capping panel. vOpen[ci][rj] = passage between
  // crossing column ci and ci+1, at crossing row rj.
  for (let ci = 0; ci <= CELLS - 2; ci++) {
    const xMid = (ci - 4 + 0.5) * BLOCK;
    for (let rj = 0; rj <= CELLS - 1; rj++) {
      const z = (rj - 4) * BLOCK;
      pushLight(walls, `l2_lt_h_${ci}_${rj}`, xMid, z, true);
      if (!vOpen[ci][rj]) pushBlocker(walls, `l2_blk_h_${ci}_${rj}`, xMid, z, true);
    }
  }

  // North-south corridor segments. hOpen[rj][ci] = passage between crossing row rj and rj+1, at
  // crossing column ci.
  for (let rj = 0; rj <= CELLS - 2; rj++) {
    const zMid = (rj - 4 + 0.5) * BLOCK;
    for (let ci = 0; ci <= CELLS - 1; ci++) {
      const x = (ci - 4) * BLOCK;
      pushLight(walls, `l2_lt_v_${ci}_${rj}`, x, zMid, false);
      if (!hOpen[rj][ci]) pushBlocker(walls, `l2_blk_v_${ci}_${rj}`, x, zMid, false);
    }
  }

  // The flickering escape wall — a pass-through trigger spanning the x=+72 corridor.
  walls.push({
    id: L2_ESCAPE_WALL_ID,
    pos: { ...L2_ESCAPE_WALL_POS },
    size: { x: CORRIDOR_W, y: L2_WALL_H, z: 0.5 },
    color: L2_WALLPAPER_COLOR,
    flicker: true,
  });

  // Pickups, all sitting on corridor centrelines.
  pickups.push({ id: 'l2_hp_1', type: 'health_mega', pos: { x: 0, y: 1.5, z: -24 }, radius: 2, respawnTimer: 0, value: 100 });
  pickups.push({ id: 'l2_hp_2', type: 'health_mega', pos: { x: 24, y: 1.5, z: -72 }, radius: 2, respawnTimer: 0, value: 100 });
  pickups.push({ id: 'l2_arm_1', type: 'armor_mega', pos: { x: 48, y: 1.5, z: 0 }, radius: 1.8, respawnTimer: 0, value: 100 });
  pickups.push({ id: 'l2_arm_2', type: 'armor_mega', pos: { x: -48, y: 1.5, z: 24 }, radius: 1.8, respawnTimer: 0, value: 100 });

  return { walls, jumpPads, pickups };
}

// ── the infinite streamed grid ─────────────────────────────────────────────────────────────────

export function isLevel2HubChunk(cx: number, cz: number): boolean {
  const half = L2_HUB_HALF / L2_CHUNK_SIZE; // 2
  return cx >= -half && cx < half && cz >= -half && cz < half;
}

// Generates the portion of the endless corridor grid owned by chunk (cx, cz). Each chunk owns block
// columns/rows {2cx, 2cx+1} and the corridor segments hanging off crossings {2cx, 2cx+1} × {2cz,
// 2cz+1}, so neighbouring chunks never draw the same block, blocker or tube twice.
export function generateLevel2Chunk(cx: number, cz: number): MapWall[] {
  const walls: MapWall[] = [];
  const prefix = `l2s_${cx}_${cz}`;
  const originX = cx * L2_CHUNK_SIZE + L2_CHUNK_SIZE / 2;
  const originZ = cz * L2_CHUNK_SIZE + L2_CHUNK_SIZE / 2;

  walls.push({ id: `l2_floor_${prefix}`, pos: { x: originX, y: -0.5, z: originZ }, size: { x: L2_CHUNK_SIZE, y: 1, z: L2_CHUNK_SIZE }, color: L2_CARPET_COLOR });
  walls.push({ id: `${prefix}_ceiling`, pos: { x: originX, y: L2_WALL_H + 0.15, z: originZ }, size: { x: L2_CHUNK_SIZE, y: 0.3, z: L2_CHUNK_SIZE }, color: L2_CEILING_COLOR });

  const ixBase = cx * 2;
  const izBase = cz * 2;

  // Away from the hand-carved hub, each corridor segment independently rolls open/closed from a hash
  // of its own grid coordinates (so collision and render copies always agree). ~62% open keeps the
  // grid well above the square-lattice percolation threshold, so it stays one connected sprawl while
  // still forcing plenty of turns and dead ends.
  const OPEN_CHANCE = 0.62;

  for (let li = 0; li < 2; li++) {
    const ix = ixBase + li;                 // crossing column
    for (let ci = 0; ci < 2; ci++) {
      const iz = izBase + ci;               // crossing row

      // Block (ix, iz).
      pushBlock(walls, `${prefix}_room_${ix}_${iz}`, ix, iz);

      // East-west segment between crossing (ix, iz) and (ix+1, iz).
      const xMid = (ix + 0.5) * BLOCK;
      const zRow = iz * BLOCK;
      pushLight(walls, `${prefix}_lt_h_${ix}_${iz}`, xMid, zRow, true);
      if (mulberry32(hashSeed(ix, iz, 21))() >= OPEN_CHANCE) {
        pushBlocker(walls, `${prefix}_blk_h_${ix}_${iz}`, xMid, zRow, true);
      }

      // North-south segment between crossing (ix, iz) and (ix, iz+1).
      const xCol = ix * BLOCK;
      const zMid = (iz + 0.5) * BLOCK;
      pushLight(walls, `${prefix}_lt_v_${ix}_${iz}`, xCol, zMid, false);
      if (mulberry32(hashSeed(ix, iz, 22))() >= OPEN_CHANCE) {
        pushBlocker(walls, `${prefix}_blk_v_${ix}_${iz}`, xCol, zMid, false);
      }
    }
  }

  return walls;
}

// Dry hotel — no floor puddles (kept so the canvas can call it uniformly).
export function getLevel2Puddles(): { x: number; z: number; radius: number }[] {
  return [];
}

// A handful of motionless mannequins standing in the halls — same flashlight peekaboo mechanic as
// Level 1. All positions sit on a corridor centreline, so none is buried in a block.
export function getLevel2Mannequins(): { x: number; z: number; rotationY: number }[] {
  return [
    { x: 0, z: 24, rotationY: 2.1 },
    { x: 24, z: 0, rotationY: 4.3 },
    { x: -24, z: -24, rotationY: 0.5 },
    { x: 48, z: -48, rotationY: 1.6 },
    { x: -48, z: 48, rotationY: 3.7 },
    { x: 0, z: -72, rotationY: 5.2 },
    { x: -72, z: 0, rotationY: 0.9 },
  ];
}
