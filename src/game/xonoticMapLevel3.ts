/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapWall, JumpPad, PickupItem } from './xonoticTypes';

// ── BACKROOMS LEVEL 3 — "THE LAB" (폐쇄된 지하 연구시설) ───────────────────────────────────
// Red-light-green-light horror: the facility fluorescents run a strict ON/OFF cycle (see
// xonoticEngine.ts). Move while dark and you die. Every OFF→ON edge, the long-armed entity
// advances toward the player. Linear route: start room → long corridor → main lab → security
// room → exit door. The map is a sealed, hand-built facility — no infinite maze, so streamed
// chunks outside the hub are empty by design (generateLevel3Chunk returns []).

export const L3_WALL_H = 3.2;   // low concrete ceiling — oppressive, close
export const L3_WALL_COLOR = '#7a7e7d';    // stained concrete
export const L3_FLOOR_COLOR = '#33363a';   // dark sealed concrete
export const L3_CEILING_COLOR = '#242627'; // stained acoustic tile
export const L3_METAL_COLOR = '#3d4a43';   // old lab equipment green-grey
export const L3_SCREEN_COLOR = '#9fd8cb';  // dead CCTV monitor glow
export const L3_EXIT_COLOR = '#ff2d2d';    // exit door warning red

export const L3_CHUNK_SIZE = 48; // same grid as L2 (only matters for hub-chunk math)
export const L3_CHUNK_LOAD_RADIUS = 2; // streamed chunks are empty — radius is irrelevant

// Player opens facing down the corridor (-Z, yaw 0). The entity starts behind, same room.
export const L3_SPAWN_POINT = { x: 0, y: 1.5, z: 6 };

// The entity starts inside the start room with the player — it is already here when you wake.
export const L3_MONSTER_SPAWN = { x: -4, y: 2, z: 17 };

export const L3_ESCAPE_WALL_ID = 'l3_exit_door_trigger';
export const L3_ESCAPE_WALL_POS = { x: 0, y: L3_WALL_H / 2, z: -231 };

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

// ── the sealed facility ────────────────────────────────────────────────────────────────────

export function getLevel3Map(): { walls: MapWall[]; jumpPads: JumpPad[]; pickups: PickupItem[] } {
  const walls: MapWall[] = [];
  const jumpPads: JumpPad[] = [];
  const pickups: PickupItem[] = [];

  // Floor + single unbroken ceiling slab over the whole facility footprint.
  walls.push({ id: 'l3_floor_main', pos: { x: 0, y: -0.5, z: -106 }, size: { x: 34, y: 1, z: 254 }, color: L3_FLOOR_COLOR });
  walls.push({ id: 'l3_ceiling_main', pos: { x: 0, y: L3_WALL_H + 0.15, z: -106 }, size: { x: 34, y: 0.3, z: 254 }, color: L3_CEILING_COLOR });

  // — Start room (interior x -6..6, z 2..20). Deep enough that the entity opens behind the
  // player, not ahead on the escape route. Door south, gap x -1.5..1.5.
  pushBox(walls, 'l3_start_n', 0, 20.5, 15, 1);
  pushBox(walls, 'l3_start_w', -6.5, 11, 1, 19);
  pushBox(walls, 'l3_start_e', 6.5, 11, 1, 19);
  pushBox(walls, 'l3_start_s_l', -4.25, 1.5, 5.5, 1);
  pushBox(walls, 'l3_start_s_r', 4.25, 1.5, 5.5, 1);
  pushBox(walls, 'l3_start_cabinet', -4, 12, 2.5, 1.5, 1.6, { color: L3_METAL_COLOR }); // fallen cabinet

  // — Corridor A (interior x -2.5..2.5, z -118..2). Narrow concrete run.
  pushBox(walls, 'l3_corrA_w', -3, -58, 1, 122);
  pushBox(walls, 'l3_corrA_e', 3, -58, 1, 122);

  // — Main lab (interior x -15..15, z -152..-118). Doors north (x -2.5..2.5) + south (x -2..2).
  pushBox(walls, 'l3_lab_n_l', -9.25, -118, 13.5, 1);
  pushBox(walls, 'l3_lab_n_r', 9.25, -118, 13.5, 1);
  pushBox(walls, 'l3_lab_w', -15.5, -135, 1, 35);
  pushBox(walls, 'l3_lab_e', 15.5, -135, 1, 35);
  pushBox(walls, 'l3_lab_s_l', -9, -152, 14, 1);
  pushBox(walls, 'l3_lab_s_r', 9, -152, 14, 1);
  pushBox(walls, 'l3_lab_eq1', -8, -135, 4, 3, 1.6, { color: L3_METAL_COLOR }); // experiment rigs
  pushBox(walls, 'l3_lab_eq2', 8, -140, 5, 2.5, 1.6, { color: L3_METAL_COLOR });
  pushBox(walls, 'l3_lab_eq3', -11, -146, 4, 2, 1.1, { color: L3_METAL_COLOR });

  // — Corridor B (interior x -2..2, z -186..-152).
  pushBox(walls, 'l3_corrB_w', -2.5, -169, 1, 35);
  pushBox(walls, 'l3_corrB_e', 2.5, -169, 1, 35);

  // — Security room (interior x -8..8, z -198..-186). Doors north + south (x -1.5..1.5).
  pushBox(walls, 'l3_sec_n_l', -5.5, -186, 7, 1);
  pushBox(walls, 'l3_sec_n_r', 5.5, -186, 7, 1);
  pushBox(walls, 'l3_sec_w', -8.5, -192, 1, 13);
  pushBox(walls, 'l3_sec_e', 8.5, -192, 1, 13);
  pushBox(walls, 'l3_sec_s_l', -5.25, -198, 7.5, 1);
  pushBox(walls, 'l3_sec_s_r', 5.25, -198, 7.5, 1);
  pushBox(walls, 'l3_sec_console_l', -4.5, -193.5, 3, 1.5, 1.1, { color: L3_METAL_COLOR }); // CCTV consoles
  pushBox(walls, 'l3_sec_console_r', 4.5, -193.5, 3, 1.5, 1.1, { color: L3_METAL_COLOR });
  // Dead monitor wall — emissive set-dressing, walk-through (doorDecor).
  pushBox(walls, 'l3_screen_1', -3, -197.85, 4, 0.15, 1.5, { color: L3_SCREEN_COLOR, emissive: true, doorDecor: true });
  pushBox(walls, 'l3_screen_2', 3, -197.85, 4, 0.15, 1.5, { color: L3_SCREEN_COLOR, emissive: true, doorDecor: true });

  // — Corridor C (interior x -2..2, z -224..-198).
  pushBox(walls, 'l3_corrC_w', -2.5, -211, 1, 27);
  pushBox(walls, 'l3_corrC_e', 2.5, -211, 1, 27);

  // — Exit alcove (interior x -4..4, z -232..-224). South side is the pass-through EXIT.
  pushBox(walls, 'l3_exit_w', -4.5, -228, 1, 9);
  pushBox(walls, 'l3_exit_e', 4.5, -228, 1, 9);
  pushBox(walls, 'l3_exit_n_l', -3.5, -224, 3, 1);
  pushBox(walls, 'l3_exit_n_r', 3.5, -224, 3, 1);
  pushBox(walls, 'l3_exit_s_l', -3.5, -231.5, 3, 1);
  pushBox(walls, 'l3_exit_s_r', 3.5, -231.5, 3, 1);
  // The red exit door itself — glow only, walk straight through into the trigger behind it.
  pushBox(walls, 'l3_exitdoor', 0, -231.2, 4, 0.25, 2.6, { color: L3_EXIT_COLOR, emissive: true, doorDecor: true });
  pushBox(walls, 'l3_exitsign', 0, -231.35, 1.6, 0.2, 0.5, { color: '#39ff88', emissive: true, doorDecor: true });
  walls[walls.length - 1].pos.y = 2.9; // sign rides above the door
  walls.push({
    id: L3_ESCAPE_WALL_ID,
    pos: { ...L3_ESCAPE_WALL_POS },
    size: { x: 4, y: L3_WALL_H, z: 0.5 },
    color: L3_EXIT_COLOR,
  });

  // — Fluorescent tubes (all driven by the shared flicker material in the canvas).
  pushTube(walls, 'l3_lt_start_1', -3, 8, true);
  pushTube(walls, 'l3_lt_start_2', 3, 8, true);
  pushTube(walls, 'l3_lt_start_3', 0, 16, true);
  for (let i = 0; i < 10; i++) pushTube(walls, `l3_lt_corrA_${i}`, 0, -6 - i * 12, false);
  pushTube(walls, 'l3_lt_lab_1', -8, -130, true);
  pushTube(walls, 'l3_lt_lab_2', 8, -130, true);
  pushTube(walls, 'l3_lt_lab_3', -8, -144, true);
  pushTube(walls, 'l3_lt_lab_4', 8, -144, true);
  for (let i = 0; i < 3; i++) pushTube(walls, `l3_lt_corrB_${i}`, 0, -158 - i * 12, false);
  pushTube(walls, 'l3_lt_sec_1', -4, -192, true);
  pushTube(walls, 'l3_lt_sec_2', 4, -192, true);
  for (let i = 0; i < 3; i++) pushTube(walls, `l3_lt_corrC_${i}`, 0, -204 - i * 9, false);
  pushTube(walls, 'l3_lt_exit_1', 0, -228, true);

  // — CCTV cameras (dark housings + red recording LEDs, all non-collidable dressing).
  const cams: Array<[number, number, number]> = [
    [2.4, -30, 1], [-2.4, -70, -1], [2.4, -110, 1], [-14.9, -135, 1],
  ];
  cams.forEach(([x, z, dir], i) => {
    pushBox(walls, `l3_cam_${i}`, x, z, 0.3, 0.5, 0.3, { color: '#151617', doorDecor: true });
    walls[walls.length - 1].pos.y = 2.6;
    walls.push({
      id: `l3_cam_${i}_led`,
      pos: { x: x - dir * 0.2, y: 2.55, z },
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
  return cx >= -1 && cx <= 0 && cz >= -5 && cz <= 0;
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
