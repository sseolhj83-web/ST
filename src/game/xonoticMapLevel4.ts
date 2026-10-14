/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapWall, JumpPad, PickupItem } from './xonoticTypes';

// ── LEVEL 4 — "THE ROOF" (폭우의 옥상) ───────────────────────────────────────────────────────
// Night-rain rooftop stealth. Two roof slabs linked by an open skybridge over a deadly alley
// void — the outer edges have NO parapets, walk off and you fall. Cover: AC units, vent ducts,
// a penthouse hut. Red aviation blinkers pulse on poles; the helipad glows green.
// Rule (see xonoticEngine.ts): moving is LOUD (Shift = sneak), noise 100 pins every guard.
// Monsters: 4 guards holding posts (bridge chokepoint + helipad + roof patrol).

export const L4_WALL_H = 3.2; // penthouse/pole heights share the hotel ceiling constant shape
export const L4_ROOF_Y = 0;   // roof walking surface height

// Walkable floor rects (also the fall-death test volume in the engine).
export interface L4FloorRect { x0: number; x1: number; z0: number; z1: number; zone: 'A' | 'bridge' | 'B' }
export const L4_FLOORS: L4FloorRect[] = [
  { x0: -30, x1: 30, z0: -10, z1: 50, zone: 'A' },       // main roof (spawn south)
  { x0: -3, x1: 3, z0: -34, z1: -10, zone: 'bridge' },   // skybridge (open sides!)
  { x0: -30, x1: 30, z0: -70, z1: -34, zone: 'B' },       // far roof (helipad)
];

export const L4_CHUNK_SIZE = 48;
export const L4_CHUNK_LOAD_RADIUS = 2; // streamed chunks are empty city void

// Player opens on Roof A facing the bridge (-Z, yaw 0).
export const L4_SPAWN_POINT = { x: 0, y: 1.5, z: 42 };

// Guard posts: bridge chokepoint, helipad flanks, roof-A patrol.
export const L4_POSTS = [
  { x: 0, z: -22 },   // 0: mid-bridge blocker
  { x: -8, z: -58 },  // 1: helipad west
  { x: 8, z: -58 },   // 2: helipad east
  { x: 10, z: 20 },   // 3: roof-A patrol
];

export const L4_ESCAPE_WALL_ID = 'l4_helipad_trigger';
export const L4_ESCAPE_WALL_POS = { x: 0, y: 1.2, z: -62 };

export const L4_MONSTER_SPAWN = { x: 0, y: 2, z: -22 }; // unused (guards open on posts)

// ── geometry helpers ─────────────────────────────────────────────────────────────────────────

function pushBox(
  walls: MapWall[], id: string,
  cx: number, cy: number, cz: number, sx: number, sy: number, sz: number,
  opts?: { color?: string; emissive?: boolean; doorDecor?: boolean },
) {
  walls.push({
    id,
    pos: { x: cx, y: cy, z: cz },
    size: { x: sx, y: sy, z: sz },
    color: opts?.color ?? '#3a3e42',
    emissive: opts?.emissive,
    doorDecor: opts?.doorDecor,
  });
}

// Red aviation obstruction blinker on a pole: pole collides, lamp is glow-only dressing.
function pushBlinker(walls: MapWall[], id: string, x: number, z: number, baseY: number) {
  pushBox(walls, `${id}_pole`, x, baseY + 1.5, z, 0.3, 3, 0.3, { color: '#1c1e20' });
  walls.push({
    id: `${id}_lamp`,
    pos: { x, y: baseY + 3.1, z },
    size: { x: 0.22, y: 0.22, z: 0.22 },
    color: '#ff2222',
    emissive: true,
    doorDecor: true,
  });
}

// ── the roofs ────────────────────────────────────────────────────────────────────────────────

export function getLevel4Map(): { walls: MapWall[]; jumpPads: JumpPad[]; pickups: PickupItem[] } {
  const walls: MapWall[] = [];
  const jumpPads: JumpPad[] = [];
  const pickups: PickupItem[] = [];

  // Floor slabs — exactly the playable rects, nothing more (step off = void).
  pushBox(walls, 'l4_floor_A', 0, -0.5, 20, 60, 1, 60, { color: '#2e3134' });
  pushBox(walls, 'l4_floor_bridge', 0, -0.5, -22, 6, 1, 24, { color: '#232629' });
  pushBox(walls, 'l4_floor_B', 0, -0.5, -52, 60, 1, 36, { color: '#2e3134' });
  // No ceiling — open night sky.

  // — Roof A cover: AC units + vent ducts + penthouse hut (two doors).
  const acUnits: Array<[number, number]> = [[-14, 28], [-10, 28], [14, 10], [18, 10], [-18, -2], [8, 32]];
  acUnits.forEach(([x, z], i) => {
    pushBox(walls, `l4_ac_${i}`, x, 1.0, z, 3, 2, 2.2, { color: '#4a5054' });
  });
  pushBox(walls, 'l4_duct_A1', -4, 0.6, 18, 8, 1.2, 2, { color: '#3f4448' });
  pushBox(walls, 'l4_duct_A2', 12, 0.5, -4, 10, 1.0, 1.6, { color: '#3f4448' });
  // Penthouse hut (interior x -21..-11, z 20..28): walls with north + south door gaps.
  pushBox(walls, 'l4_hut_n_l', -20.25, 1.6, 28.5, 5.5, 3.2, 1);
  pushBox(walls, 'l4_hut_n_r', -11.75, 1.6, 28.5, 5.5, 3.2, 1);
  pushBox(walls, 'l4_hut_s_l', -20.25, 1.6, 19.5, 5.5, 3.2, 1);
  pushBox(walls, 'l4_hut_s_r', -11.75, 1.6, 19.5, 5.5, 3.2, 1);
  pushBox(walls, 'l4_hut_w', -23.5, 1.6, 24, 1, 3.2, 10);
  pushBox(walls, 'l4_hut_e', -8.5, 1.6, 24, 1, 3.2, 10);
  pushBox(walls, 'l4_hut_roof', -16, 3.35, 24, 16, 0.3, 10, { color: '#242627' });

  // — Roof B cover: ducts + AC pair near the pad (lane to the pad stays open).
  pushBox(walls, 'l4_duct_B1', -16, 0.6, -46, 8, 1.2, 2, { color: '#3f4448' });
  pushBox(walls, 'l4_duct_B2', 16, 0.6, -46, 8, 1.2, 2, { color: '#3f4448' });
  pushBox(walls, 'l4_ac_B1', -20, 1.0, -60, 3, 2, 2.2, { color: '#4a5054' });
  pushBox(walls, 'l4_ac_B2', 20, 1.0, -60, 3, 2, 2.2, { color: '#4a5054' });

  // — Helipad: green glow ring + trigger. The pad marking is the exit beacon.
  walls.push({
    id: 'l4_pad_ring',
    pos: { x: 0, y: 0.06, z: -62 },
    size: { x: 12, y: 0.08, z: 12 },
    color: '#39ff88',
    emissive: true,
    doorDecor: true,
  });
  // Exit sign pole beside the pad.
  pushBox(walls, 'l4_exitsign_pole', 7, 1.1, -62, 0.25, 2.2, 0.25, { color: '#1c1e20' });
  pushBox(walls, 'l4_exitsign', 7, 2.4, -62, 1.6, 0.5, 0.2, { color: '#39ff88', emissive: true, doorDecor: true });
  walls.push({
    id: L4_ESCAPE_WALL_ID,
    pos: { ...L4_ESCAPE_WALL_POS },
    size: { x: 5, y: 2.4, z: 5 },
    color: '#39ff88',
  });

  // — Aviation blinkers on the roof corners (poles collide, lamps pulse in the canvas).
  pushBlinker(walls, 'l4_blink_A_nw', -28, 48, 0);
  pushBlinker(walls, 'l4_blink_A_ne', 28, 48, 0);
  pushBlinker(walls, 'l4_blink_A_sw', -28, -8, 0);
  pushBlinker(walls, 'l4_blink_A_se', 28, -8, 0);
  pushBlinker(walls, 'l4_blink_B_nw', -28, -36, 0);
  pushBlinker(walls, 'l4_blink_B_ne', 28, -36, 0);
  pushBlinker(walls, 'l4_blink_B_sw', -28, -68, 0);
  pushBlinker(walls, 'l4_blink_B_se', 28, -68, 0);

  return { walls, jumpPads, pickups };
}

// ── open city void around the roofs — nothing out there ──────────────────────────────────────

export function isLevel4HubChunk(cx: number, cz: number): boolean {
  return cx >= -1 && cx <= 0 && cz >= -2 && cz <= 1;
}

export function generateLevel4Chunk(_cx: number, _cz: number): MapWall[] {
  return [];
}

export function getLevel4Puddles(): { x: number; z: number; radius: number }[] {
  return [];
}

export function getLevel4Mannequins(): { x: number; z: number; rotationY: number }[] {
  return [];
}
