/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Thin dispatcher that hands the engine and the canvas the right map generator, spawn points and
// dimensions for whichever Backrooms level a run is in. Level 1 is the original yellow maze
// (xonoticMap.ts); Level 2 is the endless hotel (xonoticMapLevel2.ts) and is only reachable after
// escaping Level 1 (see game/localStats.ts level gating + the lobby level picker).

import { MapWall, JumpPad, PickupItem } from './xonoticTypes';
import {
  getXonoticMap,
  generateStreamedChunk,
  isHubChunk,
  chunkKey as sharedChunkKey,
  CHUNK_SIZE as L1_CHUNK_SIZE,
  CHUNK_LOAD_RADIUS as L1_CHUNK_LOAD_RADIUS,
  ESCAPE_WALL_ID as L1_ESCAPE_WALL_ID,
  ESCAPE_WALL_POS as L1_ESCAPE_WALL_POS,
  SPAWN_POINT as L1_SPAWN_POINT,
  WALL_H as L1_WALL_H,
  getPuddles,
  getMannequins,
} from './xonoticMap';
import {
  getLevel2Map,
  generateLevel2Chunk,
  isLevel2HubChunk,
  getLevel2Puddles,
  getLevel2Mannequins,
  L2_CHUNK_SIZE,
  L2_CHUNK_LOAD_RADIUS,
  L2_ESCAPE_WALL_ID,
  L2_ESCAPE_WALL_POS,
  L2_SPAWN_POINT,
  L2_MONSTER_SPAWN,
  L2_WALL_H,
} from './xonoticMapLevel2';

type XYZ = { x: number; y: number; z: number };

export interface LevelModule {
  level: 1 | 2;
  CHUNK_SIZE: number;
  CHUNK_LOAD_RADIUS: number;
  WALL_H: number;
  SPAWN_POINT: XYZ;
  MONSTER_SPAWN: XYZ;
  ESCAPE_WALL_ID: string;
  ESCAPE_WALL_POS: XYZ;
  getMap: () => { walls: MapWall[]; jumpPads: JumpPad[]; pickups: PickupItem[] };
  generateChunk: (cx: number, cz: number) => MapWall[];
  isHubChunk: (cx: number, cz: number) => boolean;
  getPuddles: () => { x: number; z: number; radius: number }[];
  getMannequins: () => { x: number; z: number; rotationY: number }[];
}

export const chunkKey = sharedChunkKey;

const LEVEL_1: LevelModule = {
  level: 1,
  CHUNK_SIZE: L1_CHUNK_SIZE,
  CHUNK_LOAD_RADIUS: L1_CHUNK_LOAD_RADIUS,
  WALL_H: L1_WALL_H,
  SPAWN_POINT: L1_SPAWN_POINT,
  MONSTER_SPAWN: { x: 0, y: 2, z: -70 },
  ESCAPE_WALL_ID: L1_ESCAPE_WALL_ID,
  ESCAPE_WALL_POS: L1_ESCAPE_WALL_POS,
  getMap: getXonoticMap,
  generateChunk: generateStreamedChunk,
  isHubChunk,
  getPuddles,
  getMannequins,
};

const LEVEL_2: LevelModule = {
  level: 2,
  CHUNK_SIZE: L2_CHUNK_SIZE,
  CHUNK_LOAD_RADIUS: L2_CHUNK_LOAD_RADIUS,
  WALL_H: L2_WALL_H,
  SPAWN_POINT: L2_SPAWN_POINT,
  MONSTER_SPAWN: L2_MONSTER_SPAWN,
  ESCAPE_WALL_ID: L2_ESCAPE_WALL_ID,
  ESCAPE_WALL_POS: L2_ESCAPE_WALL_POS,
  getMap: getLevel2Map,
  generateChunk: generateLevel2Chunk,
  isHubChunk: isLevel2HubChunk,
  getPuddles: getLevel2Puddles,
  getMannequins: getLevel2Mannequins,
};

export function getLevelModule(level: number): LevelModule {
  return level === 2 ? LEVEL_2 : LEVEL_1;
}
