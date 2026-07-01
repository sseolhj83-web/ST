/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapWall, JumpPad, PickupItem } from './xonoticTypes';

// The Backrooms — Level 0 style liminal maze.
// Layout: an open outer hallway ring (keeps existing bot spawn points / outer pickups clear of walls)
// surrounding a dense inner maze core built from a procedural grid of yellow partition rooms.
// One fixed cell in the core is left open as a vertical "vent shaft" rising past the low ceiling —
// this is the same rocket-jump-accessible portal volume the engine already checks for (xonoticEngine.ts
// isInsidePortal, fixed at x=-28, z=-34.5), so no gameplay coordinates elsewhere need to change.
export function getXonoticMap(): { walls: MapWall[]; jumpPads: JumpPad[]; pickups: PickupItem[] } {
  const walls: MapWall[] = [];
  const jumpPads: JumpPad[] = [];
  const pickups: PickupItem[] = [];

  // Arena Width & Length
  const sizeX = 160;
  const sizeZ = 160;

  const wallColor = '#c9b458';    // damp yellow wallpaper
  const ceilingColor = '#cfc48f'; // stained popcorn ceiling tile
  const lightColor = '#fef9c3';   // buzzing fluorescent tube
  const carpetColor = '#9c9166';  // moist mustard carpet

  // 1. FLOOR — one continuous damp carpet slab spanning the whole arena
  walls.push({
    id: 'floor_main',
    pos: { x: 0, y: -0.5, z: 0 },
    size: { x: sizeX, y: 1, z: sizeZ },
    color: carpetColor,
  });

  // 2. OUTER PERIMETER WALLS — same footprint as before, just re-papered yellow
  walls.push({ id: 'wall_north', pos: { x: 0, y: 10, z: -sizeZ / 2 }, size: { x: sizeX, y: 20, z: 2 }, color: wallColor });
  walls.push({ id: 'wall_south', pos: { x: 0, y: 10, z: sizeZ / 2 }, size: { x: sizeX, y: 20, z: 2 }, color: wallColor });
  walls.push({ id: 'wall_west', pos: { x: -sizeX / 2, y: 10, z: 0 }, size: { x: 2, y: 20, z: sizeZ }, color: wallColor });
  walls.push({ id: 'wall_east', pos: { x: sizeX / 2, y: 10, z: 0 }, size: { x: 2, y: 20, z: sizeZ }, color: wallColor });

  // 3. INTERIOR MAZE — dense core in the middle 120x120, leaving a 20-unit-wide open hallway ring
  // around the perimeter (this keeps every existing enemy spawn point and the outer armor pickups,
  // which all sit at |x| or |z| >= 45, safely out in open floor instead of embedded in a wall).
  const innerHalf = 60;    // maze core spans [-60, 60]
  const cell = 20;         // grid cell size
  const wallH = 3.2;       // low backrooms ceiling height
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

  // 4. LOW POPCORN CEILING over the maze core, framed with a hole above the portal shaft cell
  const ceilingY = wallH + 0.15;
  walls.push({ id: 'ceiling_left', pos: { x: -50, y: ceilingY, z: 0 }, size: { x: 20, y: 0.3, z: 120 }, color: ceilingColor });
  walls.push({ id: 'ceiling_right', pos: { x: 20, y: ceilingY, z: 0 }, size: { x: 80, y: 0.3, z: 120 }, color: ceilingColor });
  walls.push({ id: 'ceiling_top', pos: { x: -30, y: ceilingY, z: -50 }, size: { x: 20, y: 0.3, z: 20 }, color: ceilingColor });
  walls.push({ id: 'ceiling_bottom', pos: { x: -30, y: ceilingY, z: 20 }, size: { x: 20, y: 0.3, z: 80 }, color: ceilingColor });

  // 5. BUZZING FLUORESCENT FIXTURES — checkerboard placement at cell centers under the ceiling
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

  // 6. PORTAL VENT SHAFT — tall solid chimney continuing straight up from the low ceiling to the
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

  // 7. PICKUPS
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
