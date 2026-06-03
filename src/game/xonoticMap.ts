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

  // 2. INTERIOR FLOATS & PLATFORMS (VERTICAL DESIGN IS KEY TO XONOTIC)
  // Center Pillar / Spire
  walls.push({
    id: 'center_spire',
    pos: { x: 0, y: 12, z: 0 },
    size: { x: 8, y: 24, z: 8 },
    color: '#0f172a',
  });
  // Floating bridges radiating from center
  walls.push({
    id: 'bridge_north',
    pos: { x: 0, y: 10, z: -20 },
    size: { x: 6, y: 1, z: 24 },
    color: '#334155',
  });
  walls.push({
    id: 'bridge_south',
    pos: { x: 0, y: 10, z: 20 },
    size: { x: 6, y: 1, z: 24 },
    color: '#334155',
  });
  walls.push({
    id: 'bridge_west',
    pos: { x: -20, y: 10, z: 0 },
    size: { x: 24, y: 1, z: 6 },
    color: '#334155',
  });
  walls.push({
    id: 'bridge_east',
    pos: { x: 20, y: 10, z: 0 },
    size: { x: 24, y: 1, z: 6 },
    color: '#334155',
  });

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
  // Central high floor - Mega HP
  pickups.push({ id: 'mega_hp', type: 'health_mega', pos: { x: 0, y: 14.5, z: 0 }, radius: 2, respawnTimer: 0, value: 100 });
  
  // Outer wings - Mega Armor (Shields power)
  pickups.push({ id: 'mega_arm_1', type: 'armor_mega', pos: { x: 0, y: 11.5, z: -28 }, radius: 1.8, respawnTimer: 0, value: 100 });
  pickups.push({ id: 'mega_arm_2', type: 'armor_mega', pos: { x: 0, y: 11.5, z: 28 }, radius: 1.8, respawnTimer: 0, value: 100 });

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
