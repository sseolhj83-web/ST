/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapWall, JumpPad, PickupItem } from './xonoticTypes';

// ── BACKROOMS LEVEL 3 — "THE LAB" (폐쇄된 지하 연구시설) ───────────────────────────────────
// Red-light-green-light horror: the facility fluorescents run a strict ON/OFF cycle (see
// xonoticEngine.ts). Move while dark and you die. Every OFF→ON edge, the long-armed entity
// advances toward the player. The map is a winding concrete MAZE (seeded, identical every run)
// with landmark rooms along the way: start room → maze → main lab → maze → security room →
// maze → exit door. The facility is sealed — no infinite maze, so streamed chunks outside the
// hub rect are empty by design (generateLevel3Chunk returns []).

export const L3_WALL_H = 3.2;   // low concrete ceiling — oppressive, close
export const L3_WALL_COLOR = '#7a7e7d';    // stained concrete
export const L3_FLOOR_COLOR = '#33363a';   // dark sealed concrete
export const L3_CEILING_COLOR = '#242627'; // stained acoustic tile
export const L3_METAL_COLOR = '#3d4a43';   // old lab equipment green-grey
export const L3_SCREEN_COLOR = '#9fd8cb';  // dead CCTV monitor glow
export const L3_EXIT_COLOR = '#ff2d2d';    // exit door warning red

export const L3_CHUNK_SIZE = 48; // same grid as L2 (only matters for hub-chunk math)
export const L3_CHUNK_LOAD_RADIUS = 2; // streamed chunks are empty — radius is irrelevant

// Maze grid: COLSxROWS cells of CELL metres. Deterministic seed → same maze every run.
// (Exported: headless tests BFS the same grid the map is built from.)
export const L3_COLS = 8;
export const L3_ROWS = 15;
export const L3_CELL = 12;
const L3_T = 1; // partition thickness
export const L3_X0 = -48; // west grid line
export const L3_Z0 = 12;  // north grid line (rows grow south, -Z)

// Landmark rooms (cell rects, inclusive). Interiors are knocked clear; the maze stays connected
// because knockout only ever removes walls.
const L3_START = { i0: 3, i1: 4, j0: 0, j1: 1 }; // start room (spawn)
const L3_LAB = { i0: 2, i1: 4, j0: 6, j1: 7 };   // main lab (equipment)
const L3_SEC = { i0: 5, i1: 6, j0: 10, j1: 10 }; // security room (CCTV wall)
const L3_EXIT_CELL = { i: 1, j: 14 };            // exit alcove cell (south wall = the door)

// Player opens facing into the maze (-Z, yaw 0). The entity starts behind, same room.
export const L3_SPAWN_POINT = { x: 0, y: 1.5, z: 6 };
export const L3_MONSTER_SPAWN = { x: -11, y: 2, z: 11 };

export const L3_ESCAPE_WALL_ID = 'l3_exit_door_trigger';
// South grid line of the exit cell, narrowed to a 4m doorway (see below).
export const L3_ESCAPE_WALL_POS = { x: -30, y: L3_WALL_H / 2, z: -168 };

// ── deterministic RNG (mulberry32) ───────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── geometry helpers ─────────────────────────────────────────────────────────────────────────

function pushBox(
  walls: MapWall[], id: string,
  cx: number, cz: number, sx: number, sz: number, h: number = L3_WALL_H,
  opts?: { color?: string; emissive?: boolean; doorDecor?: boolean },
) {
  walls.push({
    id,
    pos: { x: cx, y: h / 2, z: cz },
    size: { x: sx, y: h, z: sz },
    color: opts?.color ?? L3_WALL_COLOR,
    emissive: opts?.emissive,
    doorDecor: opts?.doorDecor,
  });
}

// A ceiling tube fixture. Emissive + doorDecor: never collidable, never blocks sight — the
// canvas drives all of them from one shared flickering material (see XonoticCanvas.tsx).
function pushTube(walls: MapWall[], id: string, x: number, z: number, alongX: boolean) {
  walls.push({
    id,
    pos: { x, y: L3_WALL_H - 0.12, z },
    size: alongX ? { x: 3.4, y: 0.16, z: 0.55 } : { x: 0.55, y: 0.16, z: 3.4 },
    color: '#e8f4ec',
    emissive: true,
    doorDecor: true,
  });
}

// ── the sealed maze facility ─────────────────────────────────────────────────────────────────

// Builds the maze partition grids (exported for headless connectivity tests — same seed,
// same maze). vWall[i][j]: partition on vertical grid line i across row j. hWall[i][j]:
// partition on horizontal grid line j across col i.
export function buildLevel3MazeGrid(): { vWall: boolean[][]; hWall: boolean[][] } {
  const rand = mulberry32(20261007);

  // — Perfect maze via iterative backtracker, then braid (knock ~22% of remaining walls for
  // loops/shortcuts — a pure perfect maze winds for kilometres; braided stays maze-like but
  // traversable in a few minutes).
  // vWall[i][j]: partition on vertical grid line i (0..COLS) across row j (0..ROWS-1).
  // hWall[i][j]: partition on horizontal grid line j (0..ROWS) across col i (0..COLS-1).
  const vWall: boolean[][] = Array.from({ length: L3_COLS + 1 }, () => new Array(L3_ROWS).fill(true));
  const hWall: boolean[][] = Array.from({ length: L3_COLS }, () => new Array(L3_ROWS + 1).fill(true));
  const visited: boolean[][] = Array.from({ length: L3_COLS }, () => new Array(L3_ROWS).fill(false));
  const stack: Array<[number, number]> = [[3, 0]];
  visited[3][0] = true;
  while (stack.length > 0) {
    const [ci, cj] = stack[stack.length - 1];
    const options: Array<[number, number, 'v' | 'h', number, number]> = [];
    if (ci > 0 && !visited[ci - 1][cj]) options.push([ci - 1, cj, 'v', ci, cj]);
    if (ci < L3_COLS - 1 && !visited[ci + 1][cj]) options.push([ci + 1, cj, 'v', ci + 1, cj]);
    if (cj > 0 && !visited[ci][cj - 1]) options.push([ci, cj - 1, 'h', ci, cj]);
    if (cj < L3_ROWS - 1 && !visited[ci][cj + 1]) options.push([ci, cj + 1, 'h', ci, cj + 1]);
    if (options.length === 0) { stack.pop(); continue; }
    const [ni, nj, kind, wi, wj] = options[Math.floor(rand() * options.length)];
    if (kind === 'v') vWall[wi][wj] = false;
    else hWall[wi][wj] = false;
    visited[ni][nj] = true;
    stack.push([ni, nj]);
  }
  // Braid: knock interior walls at random (perimeter stays sealed).
  for (let i = 1; i < L3_COLS; i++) {
    for (let j = 0; j < L3_ROWS; j++) {
      if (vWall[i][j] && rand() < 0.22) vWall[i][j] = false;
    }
  }
  for (let i = 0; i < L3_COLS; i++) {
    for (let j = 1; j < L3_ROWS; j++) {
      if (hWall[i][j] && rand() < 0.22) hWall[i][j] = false;
    }
  }
  // Knock landmark room interiors clear (only removes walls — connectivity can only grow).
  const clearRect = (r: { i0: number; i1: number; j0: number; j1: number }) => {
    for (let i = r.i0 + 1; i <= r.i1; i++) {
      for (let j = r.j0; j <= r.j1; j++) vWall[i][j] = false;
    }
    for (let i = r.i0; i <= r.i1; i++) {
      for (let j = r.j0 + 1; j <= r.j1; j++) hWall[i][j] = false;
    }
  };
  clearRect(L3_START);
  clearRect(L3_LAB);
  clearRect(L3_SEC);

  return { vWall, hWall };
}

export function getLevel3Map(): { walls: MapWall[]; jumpPads: JumpPad[]; pickups: PickupItem[] } {
  const walls: MapWall[] = [];
  const jumpPads: JumpPad[] = [];
  const pickups: PickupItem[] = [];
  const { vWall, hWall } = buildLevel3MazeGrid();

  // Floor + single unbroken ceiling slab over the whole footprint.
  walls.push({ id: 'l3_floor_main', pos: { x: 0, y: -0.5, z: -79 }, size: { x: 104, y: 1, z: 188 }, color: L3_FLOOR_COLOR });
  walls.push({ id: 'l3_ceiling_main', pos: { x: 0, y: L3_WALL_H + 0.15, z: -79 }, size: { x: 104, y: 0.3, z: 188 }, color: L3_CEILING_COLOR });

  const gx = (i: number) => L3_X0 + i * L3_CELL;
  const gz = (j: number) => L3_Z0 - j * L3_CELL;

  // Vertical partitions (skip the exit cell's south opening — handled below).
  for (let i = 0; i <= L3_COLS; i++) {
    for (let j = 0; j < L3_ROWS; j++) {
      if (!vWall[i][j]) continue;
      pushBox(walls, `l3_maze_v_${i}_${j}`, gx(i), (gz(j) + gz(j + 1)) / 2, L3_T, L3_CELL + L3_T);
    }
  }
  // Horizontal partitions, except the exit doorway gap.
  const exitCx = gx(L3_EXIT_CELL.i) + L3_CELL / 2; // -30
  for (let i = 0; i < L3_COLS; i++) {
    for (let j = 0; j <= L3_ROWS; j++) {
      if (!hWall[i][j]) continue;
      if (i === L3_EXIT_CELL.i && j === L3_ROWS) continue; // exit row built bespoke below
      pushBox(walls, `l3_maze_h_${i}_${j}`, (gx(i) + gx(i + 1)) / 2, gz(j), L3_CELL + L3_T, L3_T);
    }
  }

  // — Exit doorway: the exit cell's south side narrowed to a 4m gap with side segments.
  pushBox(walls, 'l3_exit_s_l', exitCx - 4, gz(L3_ROWS), 8, 1);
  pushBox(walls, 'l3_exit_s_r', exitCx + 4, gz(L3_ROWS), 8, 1);
  // The red exit door itself — glow only, walk straight through into the trigger behind it.
  pushBox(walls, 'l3_exitdoor', exitCx, gz(L3_ROWS) - 0.2, 4, 0.25, 2.6, { color: L3_EXIT_COLOR, emissive: true, doorDecor: true });
  pushBox(walls, 'l3_exitsign', exitCx, gz(L3_ROWS) - 0.35, 1.6, 0.2, 0.5, { color: '#39ff88', emissive: true, doorDecor: true });
  walls[walls.length - 1].pos.y = 2.9; // sign rides above the door
  walls.push({
    id: L3_ESCAPE_WALL_ID,
    pos: { ...L3_ESCAPE_WALL_POS },
    size: { x: 4, y: L3_WALL_H, z: 0.5 },
    color: L3_EXIT_COLOR,
  });

  // — Landmark dressing.
  // Start room: fallen cabinet (off the door lane).
  pushBox(walls, 'l3_start_cabinet', -9, 2, 2.5, 1.5, 1.6, { color: L3_METAL_COLOR });
  // Main lab (cells 2..4 x 6..7 → x -24..12, z -60..-84): experiment rigs.
  pushBox(walls, 'l3_lab_eq1', -16, -66, 4, 3, 1.6, { color: L3_METAL_COLOR });
  pushBox(walls, 'l3_lab_eq2', 2, -76, 5, 2.5, 1.6, { color: L3_METAL_COLOR });
  pushBox(walls, 'l3_lab_eq3', -14, -79, 4, 2, 1.1, { color: L3_METAL_COLOR });
  // Security room (cells 5..6 x row 10 → x 12..36, z -108..-120): consoles with monitors
  // riding their back edge (no wall needed — maze luck never buries them).
  pushBox(walls, 'l3_sec_console_l', 18, -115, 3, 1.5, 1.1, { color: L3_METAL_COLOR });
  pushBox(walls, 'l3_sec_console_r', 28, -115, 3, 1.5, 1.1, { color: L3_METAL_COLOR });
  pushBox(walls, 'l3_screen_1', 18, -116.2, 2.6, 0.15, 1.4, { color: L3_SCREEN_COLOR, emissive: true, doorDecor: true });
  pushBox(walls, 'l3_screen_2', 28, -116.2, 2.6, 0.15, 1.4, { color: L3_SCREEN_COLOR, emissive: true, doorDecor: true });
  walls[walls.length - 2].pos.y = 1.6;
  walls[walls.length - 1].pos.y = 1.6;

  // — Fluorescent tubes: one per cell (shared flicker material), alternating orientation.
  for (let i = 0; i < L3_COLS; i++) {
    for (let j = 0; j < L3_ROWS; j++) {
      pushTube(walls, `l3_lt_${i}_${j}`, gx(i) + L3_CELL / 2, (gz(j) + gz(j + 1)) / 2, (i + j) % 2 === 0);
    }
  }

  // — CCTV cameras on the guaranteed-sealed outer perimeter (maze-interior walls are luck —
  // never mount dressing on those). Dark housings + red recording LEDs, non-collidable.
  const cams: Array<[number, number, number, number]> = [
    // x, z, ledDx, ledDz
    [-47.4, -20, 0.2, 0], // west wall, eye east
    [47.4, -60, -0.2, 0], // east wall, eye west
    [10, 11.4, 0, -0.2],  // north wall, eye south
    [-20, -167.4, 0, 0.2], // south wall (clear of the exit gap), eye north
  ];
  cams.forEach(([x, z, ldx, ldz], k) => {
    pushBox(walls, `l3_cam_${k}`, x, z, 0.3, 0.5, 0.3, { color: '#151617', doorDecor: true });
    walls[walls.length - 1].pos.y = 2.6;
    walls.push({
      id: `l3_cam_${k}_led`,
      pos: { x: x + ldx, y: 2.55, z: z + ldz },
      size: { x: 0.08, y: 0.08, z: 0.08 },
      color: '#ff2222',
      emissive: true,
      doorDecor: true,
    });
  });

  return { walls, jumpPads, pickups };
}

// ── no infinite maze — the facility is sealed, everything outside the hub rect is void ────────

export function isLevel3HubChunk(cx: number, cz: number): boolean {
  return cx >= -2 && cx <= 1 && cz >= -6 && cz <= 0;
}

export function generateLevel3Chunk(_cx: number, _cz: number): MapWall[] {
  return [];
}

export function getLevel3Puddles(): { x: number; z: number; radius: number }[] {
  return [];
}

export function getLevel3Mannequins(): { x: number; z: number; rotationY: number }[] {
  return [];
}
