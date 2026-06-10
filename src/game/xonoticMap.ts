/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapWall, JumpPad, PickupItem } from './xonoticTypes';

export function getXonoticMap(): { walls: MapWall[]; jumpPads: JumpPad[]; pickups: PickupItem[] } {
  const walls: MapWall[] = [];
  const jumpPads: JumpPad[] = [];
  const pickups: PickupItem[] = [];

  // Arena Width & Length
  const sizeX = 80;
  const sizeZ = 80;

  // 1. BOUNDARIES (FUTURISTIC WIREFRAME NEON WALLS & FLOORS)
  // Floor
  walls.push({
    id: 'floor_main',
    pos: { x: 0, y: -0.5, z: 0 },
    size: { x: sizeX, y: 1, z: sizeZ },
    color: '#090d16',
  });

  // Perimeter Walls (Sci-Fi mesh design)
  walls.push({
    id: 'wall_north',
    pos: { x: 0, y: 10, z: -sizeZ / 2 },
    size: { x: sizeX, y: 20, z: 2 },
    color: '#1e293b',
  });
  walls.push({
    id: 'wall_south',
    pos: { x: 0, y: 10, z: sizeZ / 2 },
    size: { x: sizeX, y: 20, z: 2 },
    color: '#1e293b',
  });
  walls.push({
    id: 'wall_west',
    pos: { x: -sizeX / 2, y: 10, z: 0 },
    size: { x: 2, y: 20, z: sizeZ },
    color: '#1e293b',
  });
  walls.push({
    id: 'wall_east',
    pos: { x: sizeX / 2, y: 10, z: 0 },
    size: { x: 2, y: 20, z: sizeZ },
    color: '#1e293b',
  });

  // Glowing neon stripes along the wall edges
  walls.push({ id: 'neon_n', pos: { x: 0, y: 10, z: -sizeZ / 2 + 1 }, size: { x: sizeX - 4, y: 0.5, z: 0.5 }, color: '#ec4899', emissive: true });
  walls.push({ id: 'neon_s', pos: { x: 0, y: 10, z: sizeZ / 2 - 1 }, size: { x: sizeX - 4, y: 0.5, z: 0.5 }, color: '#ec4899', emissive: true });
  walls.push({ id: 'neon_w', pos: { x: -sizeX / 2 + 1, y: 10, z: 0 }, size: { x: 0.5, y: 0.5, z: sizeZ - 4 }, color: '#06b6d4', emissive: true });
  walls.push({ id: 'neon_e', pos: { x: sizeX / 2 - 1, y: 10, z: 0 }, size: { x: 0.5, y: 0.5, z: sizeZ - 4 }, color: '#06b6d4', emissive: true });

  // 2. HAWKINS NATIONAL LABORATORY - Central Structure
  // ── Main Building Body (3-story brutalist concrete) ──
  walls.push({ id: 'hl_main',        pos: { x: 0, y: 5, z: 0 },      size: { x: 22, y: 10, z: 16 }, color: '#7a8898' });
  walls.push({ id: 'hl_main_roof',   pos: { x: 0, y: 10.7, z: 0 },   size: { x: 24, y: 1.4, z: 18 }, color: '#4a5568' });

  // ── Left Wing ──
  walls.push({ id: 'hl_wing_l',      pos: { x: -15, y: 4, z: 0 },    size: { x: 8, y: 8, z: 10 }, color: '#7a8898' });
  walls.push({ id: 'hl_wing_l_roof', pos: { x: -15, y: 8.7, z: 0 },  size: { x: 9, y: 1.4, z: 11 }, color: '#4a5568' });

  // ── Right Wing ──
  walls.push({ id: 'hl_wing_r',      pos: { x: 15, y: 4, z: 0 },     size: { x: 8, y: 8, z: 10 }, color: '#7a8898' });
  walls.push({ id: 'hl_wing_r_roof', pos: { x: 15, y: 8.7, z: 0 },   size: { x: 9, y: 1.4, z: 11 }, color: '#4a5568' });

  // ── Entrance Overhang (south face canopy) ──
  walls.push({ id: 'hl_canopy',      pos: { x: 0, y: 7.5, z: 9 },    size: { x: 14, y: 0.5, z: 2 }, color: '#374151' });

  // ── Entrance Steps ──
  walls.push({ id: 'hl_step1',       pos: { x: 0, y: 0.3, z: 9.5 },  size: { x: 12, y: 0.6, z: 2.5 }, color: '#5a6475' });
  walls.push({ id: 'hl_step2',       pos: { x: 0, y: 0.7, z: 8.7 },  size: { x: 10, y: 0.6, z: 1.5 }, color: '#5a6475' });

  // ── Windows: Front (south, z=+8.1) ──
  const winColor = '#fde68a'; // warm yellow institutional light
  // Floor 1
  walls.push({ id: 'win_f1_1', pos: { x: -6.5, y: 2.5, z: 8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_f1_2', pos: { x: -2.2, y: 2.5, z: 8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_f1_3', pos: { x:  2.2, y: 2.5, z: 8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_f1_4', pos: { x:  6.5, y: 2.5, z: 8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  // Floor 2
  walls.push({ id: 'win_f2_1', pos: { x: -6.5, y: 5.5, z: 8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_f2_2', pos: { x: -2.2, y: 5.5, z: 8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_f2_3', pos: { x:  2.2, y: 5.5, z: 8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_f2_4', pos: { x:  6.5, y: 5.5, z: 8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  // Floor 3
  walls.push({ id: 'win_f3_1', pos: { x: -6.5, y: 8.5, z: 8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_f3_2', pos: { x: -2.2, y: 8.5, z: 8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_f3_3', pos: { x:  2.2, y: 8.5, z: 8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_f3_4', pos: { x:  6.5, y: 8.5, z: 8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });

  // ── Windows: Back (north, z=-8.15) ──
  walls.push({ id: 'win_b1_1', pos: { x: -6.5, y: 2.5, z: -8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_b1_2', pos: { x: -2.2, y: 2.5, z: -8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_b1_3', pos: { x:  2.2, y: 2.5, z: -8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_b1_4', pos: { x:  6.5, y: 2.5, z: -8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_b2_1', pos: { x: -6.5, y: 5.5, z: -8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_b2_2', pos: { x: -2.2, y: 5.5, z: -8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_b2_3', pos: { x:  2.2, y: 5.5, z: -8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });
  walls.push({ id: 'win_b2_4', pos: { x:  6.5, y: 5.5, z: -8.15 }, size: { x: 2.2, y: 1.6, z: 0.25 }, color: winColor, emissive: true });

  // ── Perimeter Security Fence ──
  const fenceColor = '#7c8794';
  walls.push({ id: 'fence_n',   pos: { x: 0,   y: 1.5, z: -14 }, size: { x: 33, y: 3, z: 0.5 }, color: fenceColor });
  walls.push({ id: 'fence_s_w', pos: { x: -10, y: 1.5, z:  14 }, size: { x: 13, y: 3, z: 0.5 }, color: fenceColor });
  walls.push({ id: 'fence_s_e', pos: { x:  10, y: 1.5, z:  14 }, size: { x: 13, y: 3, z: 0.5 }, color: fenceColor });
  walls.push({ id: 'fence_w',   pos: { x: -16, y: 1.5, z:   0 }, size: { x: 0.5, y: 3, z: 28 }, color: fenceColor });
  walls.push({ id: 'fence_e',   pos: { x:  16, y: 1.5, z:   0 }, size: { x: 0.5, y: 3, z: 28 }, color: fenceColor });
  // Barbed wire top strips
  walls.push({ id: 'wire_n', pos: { x: 0,   y: 3.2, z: -14 }, size: { x: 33, y: 0.18, z: 0.18 }, color: '#b0bec5', emissive: true });
  walls.push({ id: 'wire_w', pos: { x: -16, y: 3.2, z:   0 }, size: { x: 0.18, y: 0.18, z: 28 }, color: '#b0bec5', emissive: true });
  walls.push({ id: 'wire_e', pos: { x:  16, y: 3.2, z:   0 }, size: { x: 0.18, y: 0.18, z: 28 }, color: '#b0bec5', emissive: true });

  // ── Guard Booth (south entrance) ──
  walls.push({ id: 'guard_booth',   pos: { x: 0, y: 1.5, z: 15.5 }, size: { x: 5, y: 3, z: 4 }, color: '#3d4a57' });
  walls.push({ id: 'guard_window',  pos: { x: 0, y: 2,   z: 17.6 }, size: { x: 3, y: 1.5, z: 0.2 }, color: '#bfdbfe', emissive: true });
  // Barrier arms (red)
  walls.push({ id: 'barrier_w', pos: { x: -5.5, y: 0.7, z: 14.2 }, size: { x: 4, y: 0.3, z: 0.3 }, color: '#ef4444', emissive: true });
  walls.push({ id: 'barrier_e', pos: { x:  5.5, y: 0.7, z: 14.2 }, size: { x: 4, y: 0.3, z: 0.3 }, color: '#ef4444', emissive: true });

  // ── Government Sign ──
  walls.push({ id: 'hl_sign_board', pos: { x: 0, y: 4.5, z: 17.8 }, size: { x: 12, y: 2.0, z: 0.5 }, color: '#1e3a5f' });
  walls.push({ id: 'hl_sign_glow',  pos: { x: 0, y: 4.5, z: 18.1 }, size: { x: 11, y: 1.4, z: 0.1 }, color: '#93c5fd', emissive: true });

  // ── Rooftop Communication Tower ──
  walls.push({ id: 'ant_base',  pos: { x: 3, y: 11.5, z: -4 }, size: { x: 1.2, y: 3,   z: 1.2 }, color: '#475569' });
  walls.push({ id: 'ant_shaft', pos: { x: 3, y: 15.5, z: -4 }, size: { x: 0.4, y: 9,   z: 0.4 }, color: '#64748b' });
  walls.push({ id: 'ant_bar',   pos: { x: 3, y: 15.5, z: -4 }, size: { x: 5,   y: 0.25, z: 0.25 }, color: '#64748b' });
  walls.push({ id: 'ant_light', pos: { x: 3, y: 20.1, z: -4 }, size: { x: 0.5, y: 0.5, z: 0.5 }, color: '#ef4444', emissive: true });

  // ── Security Floodlights (mounted on building corners) ──
  walls.push({ id: 'flood_fl', pos: { x: -11, y: 7, z:  8.5 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#fef9c3', emissive: true });
  walls.push({ id: 'flood_fr', pos: { x:  11, y: 7, z:  8.5 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#fef9c3', emissive: true });
  walls.push({ id: 'flood_bl', pos: { x: -11, y: 7, z: -8.5 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#fef9c3', emissive: true });
  walls.push({ id: 'flood_br', pos: { x:  11, y: 7, z: -8.5 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#fef9c3', emissive: true });

  // Elevated Outpost structures in corners
  // Top-left outpost
  walls.push({ id: 'outpost_tl', pos: { x: -28, y: 6, z: -28 }, size: { x: 14, y: 12, z: 14 }, color: '#1e293b' });
  walls.push({ id: 'outpost_tl_roof', pos: { x: -28, y: 12.5, z: -28 }, size: { x: 16, y: 1, z: 16 }, color: '#3b82f6' });
  // Top-right outpost
  walls.push({ id: 'outpost_tr', pos: { x: 28, y: 6, z: -28 }, size: { x: 14, y: 12, z: 14 }, color: '#1e293b' });
  walls.push({ id: 'outpost_tr_roof', pos: { x: 28, y: 12.5, z: -28 }, size: { x: 16, y: 1, z: 16 }, color: '#3b82f6' });
  // Bottom-left outpost
  walls.push({ id: 'outpost_bl', pos: { x: -28, y: 6, z: 28 }, size: { x: 14, y: 12, z: 14 }, color: '#1e293b' });
  walls.push({ id: 'outpost_bl_roof', pos: { x: -28, y: 12.5, z: 28 }, size: { x: 16, y: 1, z: 16 }, color: '#3b82f6' });
  // Bottom-right outpost
  walls.push({ id: 'outpost_br', pos: { x: 28, y: 6, z: 28 }, size: { x: 14, y: 12, z: 14 }, color: '#1e293b' });
  walls.push({ id: 'outpost_br_roof', pos: { x: 28, y: 12.5, z: 28 }, size: { x: 16, y: 1, z: 16 }, color: '#3b82f6' });

  // 3. JUMP PADS (Launch the player with vectors!)
  // Left jump pad shoots to Central Pillar Bridge
  jumpPads.push({
    id: 'jp_west',
    pos: { x: -25, y: 0.1, z: 0 },
    width: 6,
    depth: 6,
    force: { x: 32, y: 22, z: 0 },
  });
  // Right jump pad shoots to Central Pillar Bridge
  jumpPads.push({
    id: 'jp_east',
    pos: { x: 25, y: 0.1, z: 0 },
    width: 6,
    depth: 6,
    force: { x: -32, y: 22, z: 0 },
  });
  // Corner jump pads shooting upwards to outposts
  jumpPads.push({
    id: 'jp_tl',
    pos: { x: -32, y: 0.1, z: -15 },
    width: 5,
    depth: 5,
    force: { x: 0, y: 26, z: -18 },
  });
  jumpPads.push({
    id: 'jp_tr',
    pos: { x: 32, y: 0.1, z: -15 },
    width: 5,
    depth: 5,
    force: { x: 0, y: 26, z: -18 },
  });
  jumpPads.push({
    id: 'jp_bl',
    pos: { x: -32, y: 0.1, z: 15 },
    width: 5,
    depth: 5,
    force: { x: 0, y: 26, z: 18 },
  });
  jumpPads.push({
    id: 'jp_br',
    pos: { x: 32, y: 0.1, z: 15 },
    width: 5,
    depth: 5,
    force: { x: 0, y: 26, z: 18 },
  });

  // 4. POWER PICKUPS
  // Lab rooftop - Mega HP (hovering above roof ledge)
  pickups.push({ id: 'mega_hp', type: 'health_mega', pos: { x: 0, y: 12.5, z: 0 }, radius: 2, respawnTimer: 0, value: 100 });

  // Near fence corners - Mega Armor
  pickups.push({ id: 'mega_arm_1', type: 'armor_mega', pos: { x: -14, y: 1.5, z: -12 }, radius: 1.8, respawnTimer: 0, value: 100 });
  pickups.push({ id: 'mega_arm_2', type: 'armor_mega', pos: { x:  14, y: 1.5, z: -12 }, radius: 1.8, respawnTimer: 0, value: 100 });

  // Outpost rooftops - Weapon Pickups (Vaporizer, Rocket Launcher, and Grenades!)
  pickups.push({ id: 'pick_vapor', type: 'weapon_vaporizer', pos: { x: -28, y: 14, z: -28 }, radius: 1.5, respawnTimer: 0, value: 1 });
  pickups.push({ id: 'pick_rocket', type: 'weapon_rocket', pos: { x: 28, y: 14, z: 28 }, radius: 1.5, respawnTimer: 0, value: 1 });
  pickups.push({ id: 'pick_grenade_1', type: 'weapon_grenade', pos: { x: 28, y: 14, z: -28 }, radius: 1.5, respawnTimer: 0, value: 1 });
  pickups.push({ id: 'pick_grenade_2', type: 'weapon_grenade', pos: { x: -28, y: 14, z: 28 }, radius: 1.5, respawnTimer: 0, value: 1 });

  // Floor Level Spawns - Regular Ammo drops
  pickups.push({ id: 'ammo_1', type: 'ammo', pos: { x: -15, y: 1, z: -15 }, radius: 1, respawnTimer: 0, value: 20 });
  pickups.push({ id: 'ammo_2', type: 'ammo', pos: { x: 15, y: 1, z: -15 }, radius: 1, respawnTimer: 0, value: 20 });
  pickups.push({ id: 'ammo_3', type: 'ammo', pos: { x: -15, y: 1, z: 15 }, radius: 1, respawnTimer: 0, value: 20 });
  pickups.push({ id: 'ammo_4', type: 'ammo', pos: { x: 15, y: 1, z: 15 }, radius: 1, respawnTimer: 0, value: 20 });

  return { walls, jumpPads, pickups };
}
