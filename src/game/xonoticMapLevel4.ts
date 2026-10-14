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
  { x0: -4, x1: 4, z0: -34, z1: -10, zone: 'bridge' },   // skybridge, open sides, centre duct
  { x0: -30, x1: 30, z0: -70, z1: -34, zone: 'B' },       // far roof (helipad)
];

export const L4_CHUNK_SIZE = 48;
export const L4_CHUNK_LOAD_RADIUS = 2; // streamed chunks are empty city void

// Player opens on Roof A facing the bridge (-Z, yaw 0).
export const L4_SPAWN_POINT = { x: 0, y: 1.5, z: 42 };

// Guard posts: two helipad flanks, one Roof-B roamer, one Roof-A east patrol (west stays
// readable as the stealth approach). The bridge itself is unguarded — open edges + fall risk
// are the threat there.
export const L4_POSTS = [
  { x: 6, z: -44 },   // 0: Roof-B roamer (also watches the bridge landing)
  { x: -10, z: -58 }, // 1: helipad west
  { x: 10, z: -58 },  // 2: helipad east
  { x: 18, z: 16 },   // 3: Roof-A east patrol
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
  pushBox(walls, 'l4_floor_bridge', 0, -0.5, -22, 8, 1, 24, { color: '#232629' });
  pushBox(walls, 'l4_floor_B', 0, -0.5, -52, 60, 1, 36, { color: '#2e3134' });
  // No ceiling — open night sky.

  // — Roof A cover: AC units + vent ducts + penthouse hut (two doors).
  // Dense enough to break the patrol's sightlines every ~15m (stealth needs cover to shake
  // pursuit via the 2.5s give-up). Lanes stay ≥3m; spawn disc (x -6..6, z 36..50) stays clear.
  const acUnits: Array<[number, number, number, number, number]> = [
    // x, z, sx, sz, sy
    [-14, 28, 3, 2, 2], [-10, 28, 3, 2, 2], [14, 10, 3, 2, 2], [18, 10, 3, 2, 2],
    [-18, -2, 3, 2, 2], [8, 32, 3, 2, 2],
    [-14, 38, 3, 2, 2], [-3.5, 34, 3, 2, 2], [10, 34, 3, 2, 2], [-20, 24, 2.5, 2, 1.8],
    [-4, 26, 3, 2, 2], [8, 18, 3, 2, 2], [20, 18, 3, 2, 2], [-12, 8, 3, 2, 2],
    [12, 2, 2.5, 2, 1.8], [-20, -2, 3, 2, 2],
  ];
  acUnits.forEach(([x, z, sx, sz, sy], i) => {
    pushBox(walls, `l4_ac_${i}`, x, sy / 2, z, sx, sy, sz, { color: '#4a5054' });
  });
  pushBox(walls, 'l4_duct_A1', -4, 0.6, 18, 8, 1.2, 2, { color: '#3f4448' });
  pushBox(walls, 'l4_duct_A2', 12, 0.5, -4, 10, 1.0, 1.6, { color: '#3f4448' });
  // Bridge cover: a central duct splits the 6m span into two lanes and breaks sightlines
  // for anything chasing onto the span.
  pushBox(walls, 'l4_duct_bridge', 0, 0.7, -22, 1.2, 1.4, 8, { color: '#3f4448' });
  // Penthouse hut (interior x -23..-9, z 20..28): walls with north + south door gaps.
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
  pushBox(walls, 'l4_ac_B3', -12, 0.9, -41, 3, 1.8, 2, { color: '#4a5054' });
  pushBox(walls, 'l4_ac_B4', 12, 0.9, -41, 3, 1.8, 2, { color: '#4a5054' });
  pushBox(walls, 'l4_ac_B5', -8, 0.9, -52, 2.5, 1.8, 2, { color: '#4a5054' });

  // — Edge hazard paint: emissive yellow strips along every open drop (doorDecor paint,
  // walkable over). Roofs end in black void at night — without these the edge is unreadable.
  const edge = (id: string, cx: number, cz: number, sx: number, sz: number) => {
    walls.push({
      id: `l4_edge_${id}`,
      pos: { x: cx, y: 0.05, z: cz },
      size: { x: sx, y: 0.06, z: sz },
      color: '#ffd21f',
      emissive: true,
      doorDecor: true,
    });
  };
  edge('A_w', -29.6, 20, 0.5, 60);
  edge('A_e', 29.6, 20, 0.5, 60);
  edge('A_n', 0, 49.6, 60, 0.5);
  edge('A_s_l', -17, -10, 26, 0.5);
  edge('A_s_r', 17, -10, 26, 0.5);
  edge('bridge_w', -3.75, -22, 0.5, 24);
  edge('bridge_e', 3.75, -22, 0.5, 24);
  edge('B_w', -29.6, -52, 0.5, 36);
  edge('B_e', 29.6, -52, 0.5, 36);
  edge('B_n_l', -17, -34, 26, 0.5);
  edge('B_n_r', 17, -34, 26, 0.5);
  edge('B_s', 0, -69.6, 60, 0.5);
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
