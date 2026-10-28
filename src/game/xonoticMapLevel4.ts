/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ── LEVEL 4 — "무한한 공간" (THE INFINITE YELLOW) ─────────────────────────────────────────
// An endless Backrooms that never repeats itself. The world is an infinite grid of 20m room
// cells, and every single cell is its own room: its own archetype (open hall with columns,
// dog-leg corridor, pillar forest, sealed alcove, split chamber, empty void), its own wall
// thickness, its own doorway widths and offsets, its own colour tint and its own rows of
// ceiling tubes. Nothing is copied and nothing tiles — the layout of a room is derived from a
// hash of that room's grid coordinates, so no two rooms anywhere in the space are alike, and the
// world keeps going in every direction forever.
//
// Reachability is guaranteed instead of hoped for. Doorways are hashed per EDGE (not per cell),
// so the two rooms sharing an edge always agree on where the gap is. A breadth-first search over
// that same edge function finds the connected region around the spawn, and the exit door is
// parked in a room deep inside it — so the way out always exists, no matter how tangled the maze
// gets. The exit is a green-lit slab standing in that room; walking into it ends the run.
//
// Performance notes (this level is the heaviest thing in the game, so everything here is built
// for it):
//  - A chunk is 2x2 cells and only CHUNK_LOAD_RADIUS=2 chunks are resident (5x5 = 25 chunks),
//    which the dense fog hides completely — the player never sees a chunk appear.
//  - Every room contributes ~15 boxes, and the canvas draws a whole chunk as a handful of
//    InstancedMeshes (one per material) instead of one Mesh per wall.
//  - The engine buckets walls into 20m cells so collision only tests the 3x3 neighbourhood
//    around the mover instead of every wall in the world (see xonoticEngine.ts).

import { MapWall, JumpPad, PickupItem } from './xonoticTypes';
import { mulberry32, hashSeed } from './xonoticMap';

export const L4_CELL = 20;                 // one room cell (20 x 20 m)
export const L4_CHUNK_SIZE = L4_CELL * 2;  // streamed chunk = 2x2 cells = 40 m
export const L4_CHUNK_LOAD_RADIUS = 2;     // 5x5 chunks resident (200 m span, hidden by fog)
export const L4_WALL_H = 4.6;              // office ceiling height — matches the reference photo

export const L4_WALL_COLOR = '#c9b95f';    // damp yellow wallpaper
export const L4_CEILING_COLOR = '#d6d0ae'; // ceiling tile
export const L4_FLOOR_COLOR = '#b39a52';   // carpet
export const L4_LIGHT_COLOR = '#fffce8';   // fluorescent tube

export const L4_ESCAPE_WALL_ID = 'l4_exit_door';
export const L4_SPAWN_POINT = { x: L4_CELL * 0.5, y: 1.5, z: L4_CELL * 0.5 };
export const L4_MONSTER_SPAWN = { x: L4_SPAWN_POINT.x + 28, y: 2, z: L4_SPAWN_POINT.z + 24 };

const OPEN_CHANCE = 0.66;   // per-edge doorway probability — above the ~50% percolation threshold,
                            // so the space stays one sprawling connected region
const ARCHETYPES = 6;       // room archetypes — the reason no two rooms look alike
const GAP_CLEARANCE = 0.5;  // metres of clearance kept between any furniture and a doorway

// ── colour helpers ────────────────────────────────────────────────────────────────────────────
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Per-room colour drift: two neighbouring rooms are never quite the same shade, which is what
// sells "every room is different" more than any amount of geometry.
function jitterColor(hex: string, dh: number, dl: number): string {
  const [h, s, l] = hexToHsl(hex);
  const nh = (h + (dh - 0.5) * 9 + 360) % 360;
  const nl = Math.min(0.92, Math.max(0.08, l + (dl - 0.5) * 0.14));
  const ns = Math.min(1, Math.max(0, s + (dh - 0.5) * 0.08));
  return hslToHex(nh, ns, nl);
}

// ── doorway (edge) decisions ──────────────────────────────────────────────────────────────────
interface EdgeInfo {
  open: boolean;     // is there a gap to walk through?
  doorW: number;     // gap width (m)
  offset: number;    // 0..1 position of the gap along the edge
  thickness: number; // wall thickness (m)
}

// The wall on the WEST edge of cell (i,j) sits at x = i*CELL and is keyed (i,j,'v').
// The wall on the NORTH edge of cell (i,j) sits at z = j*CELL and is keyed (i,j,'h').
// Keying by the EDGE (not by the cell) is what guarantees both rooms sharing that edge agree
// on the gap position — otherwise rooms would disagree and you could see a doorway that leads
// into a solid wall.
function edgeInfo(i: number, j: number, axis: 'v' | 'h'): EdgeInfo {
  const seed = axis === 'v' ? hashSeed(i, j, 9101) : hashSeed(i, j, 9102);
  const r = mulberry32(seed);
  const open = r() < OPEN_CHANCE;
  const doorW = 3.8 + r() * 2.8;      // 3.8 - 6.6 m gaps (narrowed slightly from 3.2-7.4)
  const offset = r();                  // gap centre along the edge
  const thickness = 0.3 + r() * 0.45;  // 0.3 - 0.75 m thick walls
  return { open, doorW, offset, thickness };
}

// Where the gap of one edge sits, in world coordinates along that edge's long axis.
interface GapSpan { start: number; end: number; }

function edgeGapSpan(i: number, j: number, axis: 'v' | 'h'): GapSpan | null {
  const e = edgeInfo(i, j, axis);
  if (!e.open) return null;
  // The gap centre stays between 25% and 75% of the edge, so it never sits flush in a corner.
  const centre = L4_CELL * (0.25 + e.offset * 0.5);
  const origin = axis === 'v' ? j * L4_CELL : i * L4_CELL;
  return { start: origin + centre - e.doorW / 2, end: origin + centre + e.doorW / 2 };
}

// The four doorway openings of a room, expressed as world-space boxes plus the axis the gap
// runs along ('x' = north/south doorways, 'z' = east/west doorways). Furniture is never allowed
// to overlap one of these — a column dropped across a doorway would seal the room off and
// quietly break the "always reachable" guarantee.
interface DoorBox {
  x0: number; x1: number; z0: number; z1: number;
  gapAxis: 'x' | 'z';
}

function roomDoorBoxes(i: number, j: number): DoorBox[] {
  const x0 = i * L4_CELL, z0 = j * L4_CELL;
  const boxes: DoorBox[] = [];
  const pad = 0.6;
  const west = edgeGapSpan(i, j, 'v');
  if (west) boxes.push({ x0: x0 - pad, x1: x0 + pad, z0: west.start - pad, z1: west.end + pad, gapAxis: 'z' });
  const east = edgeGapSpan(i + 1, j, 'v');
  if (east) boxes.push({ x0: x0 + L4_CELL - pad, x1: x0 + L4_CELL + pad, z0: east.start - pad, z1: east.end + pad, gapAxis: 'z' });
  const north = edgeGapSpan(i, j, 'h');
  if (north) boxes.push({ x0: north.start - pad, x1: north.end + pad, z0: z0 - pad, z1: z0 + pad, gapAxis: 'x' });
  const south = edgeGapSpan(i, j + 1, 'h');
  if (south) boxes.push({ x0: south.start - pad, x1: south.end + pad, z0: z0 + L4_CELL - pad, z1: z0 + L4_CELL + pad, gapAxis: 'x' });
  return boxes;
}

function overlapsDoor(doors: DoorBox[], x: number, z: number, sx: number, sz: number): boolean {
  const hx = sx / 2, hz = sz / 2;
  for (const d of doors) {
    if (x + hx > d.x0 && x - hx < d.x1 && z + hz > d.z0 && z - hz < d.z1) return true;
  }
  return false;
}

// Builds the wall segments for one edge (a full cell-length line, optionally split by a gap).
function edgeWallSegments(i: number, j: number, axis: 'v' | 'h', color: string): MapWall[] {
  const edge = edgeInfo(i, j, axis);
  const x0 = i * L4_CELL, z0 = j * L4_CELL;
  const segId = `l4_${axis === 'v' ? 'w' : 'n'}_${i}_${j}`;

  const mk = (id: string, pos: { x: number; y: number; z: number }, size: { x: number; y: number; z: number }) => ({
    id, pos, size, color,
  });

  if (!edge.open) {
    if (axis === 'v') {
      return [mk(segId, { x: x0, y: L4_WALL_H / 2, z: z0 + L4_CELL / 2 }, { x: edge.thickness, y: L4_WALL_H, z: L4_CELL })];
    }
    return [mk(segId, { x: x0 + L4_CELL / 2, y: L4_WALL_H / 2, z: z0 }, { x: L4_CELL, y: L4_WALL_H, z: edge.thickness })];
  }

  const centre = L4_CELL * (0.25 + edge.offset * 0.5);
  const gapStart = centre - edge.doorW / 2;
  const gapEnd = centre + edge.doorW / 2;
  const segs: MapWall[] = [];

  if (axis === 'v') {
    if (gapStart > 0) {
      const len = gapStart;
      segs.push(mk(`${segId}_a`, { x: x0, y: L4_WALL_H / 2, z: z0 + len / 2 }, { x: edge.thickness, y: L4_WALL_H, z: len }));
    }
    if (L4_CELL > gapEnd) {
      const len = L4_CELL - gapEnd;
      segs.push(mk(`${segId}_b`, { x: x0, y: L4_WALL_H / 2, z: z0 + gapEnd + len / 2 }, { x: edge.thickness, y: L4_WALL_H, z: len }));
    }
  } else {
    if (gapStart > 0) {
      const len = gapStart;
      segs.push(mk(`${segId}_a`, { x: x0 + len / 2, y: L4_WALL_H / 2, z: z0 }, { x: len, y: L4_WALL_H, z: edge.thickness }));
    }
    if (L4_CELL > gapEnd) {
      const len = L4_CELL - gapEnd;
      segs.push(mk(`${segId}_b`, { x: x0 + gapEnd + len / 2, y: L4_WALL_H / 2, z: z0 }, { x: len, y: L4_WALL_H, z: edge.thickness }));
    }
  }
  return segs;
}

// ── room archetypes ───────────────────────────────────────────────────────────────────────────
// Each archetype lays out ONE room. Positions are jittered per cell so two halls are never
// mirrored copies of each other, and nothing is ever allowed to sit in a doorway.
function buildInterior(
  i: number, j: number, arch: number, wallColor: string, rand: () => number,
  keepClear?: { x: number; z: number; r: number }
): MapWall[] {
  const x0 = i * L4_CELL, z0 = j * L4_CELL;
  const doors = roomDoorBoxes(i, j);
  const walls: MapWall[] = [];
  const add = (id: string, x: number, z: number, sx: number, sz: number) => {
    // Nothing is ever dropped on top of the player's spawn point.
    if (keepClear) {
      const dx = x - keepClear.x, dz = z - keepClear.z;
      const reach = Math.hypot(dx, dz) - Math.max(sx, sz) / 2;
      if (reach < keepClear.r) return;
    }
    walls.push({
      id, pos: { x, y: L4_WALL_H / 2, z }, size: { x: sx, y: L4_WALL_H, z: sz }, color: wallColor,
    });
  };
  // A wall segment running along z at x = X, from `from` to `from + len` (in z).
  const addVertical = (id: string, X: number, from: number, len: number, t: number) =>
    add(id, X, z0 + from + len / 2, t, len);
  // A wall segment running along x at z = Z, from `from` to `from + len` (in x).
  const addHorizontal = (id: string, Z: number, from: number, len: number, t: number) =>
    add(id, x0 + from + len / 2, Z, len, t);

  switch (arch) {
    case 0: {
      // HALL — a forest of square columns on a jittered grid (the reference photo's pillars).
      const cols = 2 + Math.floor(rand() * 3);
      const step = L4_CELL / (cols + 1);
      for (let a = 0; a < cols; a++) {
        for (let b = 0; b < cols; b++) {
          if (rand() < 0.22) continue; // some grid slots stay empty
          const w = 1.25 + rand() * 1.15;
          const px = x0 + step * (a + 1) + (rand() - 0.5) * 1.4;
          const pz = z0 + step * (b + 1) + (rand() - 0.5) * 1.4;
          if (overlapsDoor(doors, px, pz, w, w)) continue;
          add(`l4_col_${i}_${j}_${a}_${b}`, px, pz, w, w);
        }
      }
      break;
    }
    case 1: {
      // DOG-LEG — one interior partition with a single gap: the room becomes an S-corridor.
      const vertical = rand() < 0.5;
      const t = 0.3 + rand() * 0.35;
      const gapW = 3 + rand() * 3.5;
      for (const frac of [0.32, 0.5, 0.68]) {
        const gapCentre = L4_CELL * frac;
        const gapStart = gapCentre - gapW / 2;
        const gapEnd = gapCentre + gapW / 2;
        // The partition must not cross the north/south doorways.
        if (vertical) {
          if (crossesDoor(doors, gapCentre, t, 'z')) continue;
          if (gapStart > 0) addVertical(`l4_part_${i}_${j}_a`, x0 + gapCentre, 0, gapStart, t);
          if (L4_CELL > gapEnd) addVertical(`l4_part_${i}_${j}_b`, x0 + gapCentre, gapEnd, L4_CELL - gapEnd, t);
        } else {
          if (crossesDoor(doors, gapCentre, t, 'x')) continue;
          if (gapStart > 0) addHorizontal(`l4_part_${i}_${j}_a`, z0 + gapCentre, 0, gapStart, t);
          if (L4_CELL > gapEnd) addHorizontal(`l4_part_${i}_${j}_b`, z0 + gapCentre, gapEnd, L4_CELL - gapEnd, t);
        }
        break; // the first fraction that doesn't conflict wins
      }
      break;
    }
    case 2: {
      // PILLARS — irregular small columns, no grid at all.
      const n = 4 + Math.floor(rand() * 6);
      for (let k = 0; k < n; k++) {
        const w = 0.9 + rand() * 1.3;
        const px = x0 + 3 + rand() * (L4_CELL - 6);
        const pz = z0 + 3 + rand() * (L4_CELL - 6);
        if (overlapsDoor(doors, px, pz, w, w)) continue;
        add(`l4_pil_${i}_${j}_${k}`, px, pz, w, w);
      }
      break;
    }
    case 3: {
      // ALCOVE — a sealed block tucked into one corner: a room inside a room. The corner with
      // the most clearance from the doorways is chosen so it can never seal one shut.
      const corner = bestCorner(i, j);
      const clearance = corner.clearance;
      const size = Math.max(1.8, Math.min(4.2, clearance - 1.2));
      const px = corner.x + (corner.ax ? 1 : -1) * size / 2;
      const pz = corner.z + (corner.az ? 1 : -1) * size / 2;
      add(`l4_alcove_${i}_${j}`, px, pz, size, size);
      break;
    }
    case 4: {
      // SPLIT CHAMBER — two perpendicular partitions, each with its own gap.
      const vertical = rand() < 0.5;
      for (let part = 0; part < 2; part++) {
        const along = part === 0 ? vertical : !vertical;
        const gapW = 3 + rand() * 3;
        const t = 0.3 + rand() * 0.3;
        let placed = false;
        for (const frac of [0.35, 0.65, 0.5, 0.25, 0.8]) {
          const gapCentre = L4_CELL * frac;
          const gapStart = gapCentre - gapW / 2;
          const gapEnd = gapCentre + gapW / 2;
          if (along) {
            if (crossesDoor(doors, gapCentre, t, 'z')) continue;
            if (gapStart > 0) addVertical(`l4_split_${i}_${j}_${part}_a`, x0 + gapCentre, 0, gapStart, t);
            if (L4_CELL > gapEnd) addVertical(`l4_split_${i}_${j}_${part}_b`, x0 + gapCentre, gapEnd, L4_CELL - gapEnd, t);
          } else {
            if (crossesDoor(doors, gapCentre, t, 'x')) continue;
            if (gapStart > 0) addHorizontal(`l4_split_${i}_${j}_${part}_a`, z0 + gapCentre, 0, gapStart, t);
            if (L4_CELL > gapEnd) addHorizontal(`l4_split_${i}_${j}_${part}_b`, z0 + gapCentre, gapEnd, L4_CELL - gapEnd, t);
          }
          placed = true;
          break;
        }
        if (!placed) continue;
      }
      break;
    }
    default:
      // VOID — an empty room. Rare, and it reads as a breath between the busy ones.
      break;
  }
  return walls;
}

// Does a partition standing at `pos` sit on top of one of the room's doorways?
// `wallAxis` is the axis the partition RUNS along: 'z' = a wall at fixed x, 'x' = a wall at
// fixed z. A partition running along z can only block the doorways whose gap runs along x
// (the north/south ones) — and vice versa.
function crossesDoor(doors: DoorBox[], pos: number, t: number, wallAxis: 'x' | 'z'): boolean {
  for (const d of doors) {
    if (d.gapAxis === wallAxis) continue;           // a gap running the other way is untouched
    if (wallAxis === 'z') {
      // Wall runs along z at x = pos — check the doorway's x-range.
      if (pos + t / 2 > d.x0 && pos - t / 2 < d.x1) return true;
    } else {
      // Wall runs along x at z = pos — check the doorway's z-range.
      if (pos + t / 2 > d.z0 && pos - t / 2 < d.z1) return true;
    }
  }
  return false;
}

// The corner of the room with the most clearance from its doorways.
function bestCorner(i: number, j: number): { x: number; z: number; ax: boolean; az: boolean; clearance: number } {
  const x0 = i * L4_CELL, z0 = j * L4_CELL;
  const west = edgeGapSpan(i, j, 'v');
  const east = edgeGapSpan(i + 1, j, 'v');
  const north = edgeGapSpan(i, j, 'h');
  const south = edgeGapSpan(i, j + 1, 'h');
  const distToGap = (span: GapSpan | null, fromStart: boolean) => {
    if (!span) return Infinity;
    return fromStart ? span.start - z0 : (z0 + L4_CELL) - span.end;
  };
  const distX = (span: GapSpan | null, fromStart: boolean) => {
    if (!span) return Infinity;
    return fromStart ? span.start - x0 : (x0 + L4_CELL) - span.end;
  };
  const candidates = [
    { x: x0, z: z0, ax: true, az: true, clearance: Math.min(distToGap(west, true), distX(north, true)) },
    { x: x0 + L4_CELL, z: z0, ax: false, az: true, clearance: Math.min(distToGap(east, true), distX(north, false)) },
    { x: x0, z: z0 + L4_CELL, ax: true, az: false, clearance: Math.min(distToGap(west, false), distX(south, true)) },
    { x: x0 + L4_CELL, z: z0 + L4_CELL, ax: false, az: false, clearance: Math.min(distToGap(east, false), distX(south, false)) },
  ];
  candidates.sort((a, b) => b.clearance - a.clearance);
  return candidates[0];
}

// ── navigation (used by the Lv4 horde) ─────────────────────────────────────────────────────────
// Which 20m room cell holds a world position.
export function l4CellOf(x: number, z: number): { i: number; j: number } {
  return { i: Math.floor(x / L4_CELL), j: Math.floor(z / L4_CELL) };
}

// Is the wall on this edge passable? 'v' = the wall standing at x = i*CELL (the west face of
// room i,j), 'h' = the wall standing at z = j*CELL (the north face of room i,j).
export function l4EdgeOpen(i: number, j: number, axis: 'v' | 'h'): boolean {
  return edgeInfo(i, j, axis).open;
}

// The doorway cut into one edge, in world coordinates — the centre of the gap an entity has to
// walk through. This is the same gap the renderer cut (see edgeWallSegments), so the horde
// always aims at holes that actually exist. Returns null for a solid edge.
export function l4Doorway(i: number, j: number, axis: 'v' | 'h'): { x: number; z: number; width: number } | null {
  const e = edgeInfo(i, j, axis);
  if (!e.open) return null;
  const centre = L4_CELL * (0.25 + e.offset * 0.5);
  if (axis === 'v') return { x: i * L4_CELL, z: j * L4_CELL + centre, width: e.doorW };
  return { x: i * L4_CELL + centre, z: j * L4_CELL, width: e.doorW };
}

// ── one room cell ─────────────────────────────────────────────────────────────────────────────
function generateCell(i: number, j: number): MapWall[] {
  const walls: MapWall[] = [];
  const x0 = i * L4_CELL, z0 = j * L4_CELL;
  const cx = x0 + L4_CELL / 2, cz = z0 + L4_CELL / 2;
  const rand = mulberry32(hashSeed(i, j, 9300));

  const wallColor = jitterColor(L4_WALL_COLOR, rand(), rand());
  const floorColor = jitterColor(L4_FLOOR_COLOR, rand(), rand());
  const ceilColor = jitterColor(L4_CEILING_COLOR, rand(), rand());

  // Floor + ceiling. The ceiling id ends with 'ceiling' so the engine's platform filter treats
  // it as a non-blocking slab (same trick the streamed Lv1 ceiling uses).
  walls.push({
    id: `l4_floor_${i}_${j}`, pos: { x: cx, y: -0.5, z: cz },
    size: { x: L4_CELL, y: 1, z: L4_CELL }, color: floorColor,
  });
  walls.push({
    id: `l4_${i}_${j}_ceiling`, pos: { x: cx, y: L4_WALL_H + 0.2, z: cz },
    size: { x: L4_CELL, y: 0.4, z: L4_CELL }, color: ceilColor,
  });

  // This cell owns its west and north edges; the east/south edges belong to the neighbours.
  walls.push(...edgeWallSegments(i, j, 'v', wallColor));
  walls.push(...edgeWallSegments(i, j, 'h', wallColor));

  // Interior. The spawn room is always an open hall and the exit room is always empty, so the
  // player can always walk in and out of the two rooms that matter.
  const isSpawn = i === 0 && j === 0;
  const isExit = i === EXIT_CELL.i && j === EXIT_CELL.j;
  const arch = isExit ? 5 : isSpawn ? 0 : Math.floor(mulberry32(hashSeed(i, j, 9200))() * ARCHETYPES);
  walls.push(...buildInterior(
    i, j, arch, wallColor, rand,
    isSpawn ? { x: L4_SPAWN_POINT.x, z: L4_SPAWN_POINT.z, r: 3.5 } : undefined
  ));

  // Ceiling tubes — one or two rows per room, each row a short string of fixtures. The rows
  // often line up with the neighbouring room's rows, which is what produces the long receding
  // light corridor from the reference photo.
  const rows = 1 + Math.floor(rand() * 2);
  for (let r = 0; r < rows; r++) {
    const alongX = rand() < 0.5;
    const off = 0.28 + rand() * 0.44;
    const count = 2 + Math.floor(rand() * 3);
    for (let c = 0; c < count; c++) {
      const t = (c + 0.5) / count;
      const px = alongX ? x0 + L4_CELL * t : x0 + L4_CELL * off;
      const pz = alongX ? z0 + L4_CELL * off : z0 + L4_CELL * t;
      walls.push({
        id: `l4_light_${i}_${j}_${r}_${c}`,
        pos: { x: px, y: L4_WALL_H - 0.06, z: pz },
        size: alongX ? { x: 3.0, y: 0.12, z: 0.85 } : { x: 0.85, y: 0.12, z: 3.0 },
        color: L4_LIGHT_COLOR,
        emissive: true,
      });
    }
  }

  return walls;
}

// ── connectivity: where the exit goes ─────────────────────────────────────────────────────────
// Breadth-first search over the doorway graph. Because both the BFS and the renderer derive
// the doorways from the same edgeInfo() hash, the exit is guaranteed to sit in a room that can
// actually be reached on foot.
function findExitCell(): { i: number; j: number; steps: number } {
  const LIMIT = 34;
  const seen = new Set<string>(['0_0']);
  const queue: Array<{ i: number; j: number; d: number }> = [{ i: 0, j: 0, d: 0 }];
  const candidates: Array<{ i: number; j: number; d: number }> = [];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    // Keep a spread of "far enough but not absurdly far" rooms — the run should be a long
    // trek (a few hundred metres) rather than a five-second sprint or a twenty-minute march.
    if (cur.d >= 10 && cur.d <= 16) candidates.push(cur);

    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>) {
      const ni = cur.i + di, nj = cur.j + dj;
      if (ni < -LIMIT || ni > LIMIT || nj < -LIMIT || nj > LIMIT) continue;
      const key = `${ni}_${nj}`;
      if (seen.has(key)) continue;
      // The shared edge between cur and its neighbour.
      const ei = di !== 0 ? (di > 0 ? ni : cur.i) : cur.i;
      const ej = di !== 0 ? cur.j : (dj > 0 ? nj : cur.j);
      const edge = edgeInfo(ei, ej, di !== 0 ? 'v' : 'h');
      if (!edge.open) continue;
      seen.add(key);
      queue.push({ i: ni, j: nj, d: cur.d + 1 });
    }
  }

  if (candidates.length === 0) {
    // Extremely unlikely (would need a fully sealed region) — fall back to the spawn room.
    return { i: 0, j: 0, steps: 0 };
  }
  // Deterministic pick among the candidates: hash the cell so the exit lands in a different
  // room every session without ever changing the rules.
  const pick = candidates[Math.floor(mulberry32(hashSeed(candidates.length, 77, 4242))() * candidates.length)];
  return { i: pick.i, j: pick.j, steps: pick.d };
}

export const EXIT_CELL = findExitCell();

// The exit itself: a green-lit slab standing in the middle of the exit room.
export const L4_ESCAPE_WALL_POS = {
  x: EXIT_CELL.i * L4_CELL + L4_CELL / 2,
  y: L4_WALL_H / 2,
  z: EXIT_CELL.j * L4_CELL + L4_CELL / 2,
};

// ── streaming ────────────────────────────────────────────────────────────────────────────────
// Level 4 has no hand-built hub: every part of the world is streamed, including the room the
// player starts in, so there is never a seam between "the level" and "the endless part".
export function isLevel4HubChunk(cx: number, cz: number): boolean {
  return false;
}

export function generateLevel4Chunk(cx: number, cz: number): MapWall[] {
  const walls: MapWall[] = [];
  for (let di = 0; di < 2; di++) {
    for (let dj = 0; dj < 2; dj++) {
      walls.push(...generateCell(cx * 2 + di, cz * 2 + dj));
    }
  }
  return walls;
}

// The static part of the map: only the exit door. Everything else streams in.
export function getLevel4Map(): { walls: MapWall[]; jumpPads: JumpPad[]; pickups: PickupItem[] } {
  const walls: MapWall[] = [];
  const jumpPads: JumpPad[] = [];
  const pickups: PickupItem[] = [];

  walls.push({
    id: L4_ESCAPE_WALL_ID,
    pos: { ...L4_ESCAPE_WALL_POS },
    size: { x: 6, y: L4_WALL_H, z: 0.4 },
    color: '#0b2a14',
    emissive: true,
  });

  // A little supplies cache next to the spawn so the first room isn't completely bare.
  pickups.push({
    id: 'l4_mega_hp', type: 'health_mega',
    pos: { x: L4_SPAWN_POINT.x + 4, y: 1.5, z: L4_SPAWN_POINT.z - 4 },
    radius: 2, respawnTimer: 0, value: 100,
  });

  return { walls, jumpPads, pickups };
}

// No static decoration for this level — the world is generated, so puddles and mannequins
// would float in the wrong room. (The canvas draws both from fixed lists.)
export function getLevel4Puddles(): { x: number; z: number; radius: number }[] {
  return [];
}
export function getLevel4Mannequins(): { x: number; z: number; rotationY: number }[] {
  return [];
}
