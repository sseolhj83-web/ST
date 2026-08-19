/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Player3D {
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  onGround: boolean;
  score: number;
  deaths: number;
}

export interface Bot {
  id: string;
  name: string;
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  color: string;
  radius: number;
  lastMeleeTime: number;
  targetPos: { x: number; y: number; z: number } | null;
  state: 'wandering' | 'hunting' | 'jumping'; // for the monster: 'wandering' = lurking/hidden, 'hunting' = ambushing the player
  stateTimer: number;
  isTeammate?: boolean;
  isRemotePlayer?: boolean; // true = real online player (not AI)
  isMonster?: boolean;      // the single, unkillable Backrooms entity
  invulnerable?: boolean;   // damage is ignored entirely
  isHidden?: boolean;       // true while lurking — not rendered, doesn't announce itself
}

export interface JumpPad {
  id: string;
  pos: { x: number; y: number; z: number };
  width: number;
  depth: number;
  force: { x: number; y: number; z: number };
}

export interface PickupItem {
  id: string;
  type: 'health_mega' | 'armor_mega';
  pos: { x: number; y: number; z: number };
  radius: number;
  respawnTimer: number; // 0 if active, > 0 if inactive
  value: number;
}

export interface MapWall {
  id: string;
  pos: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  color: string;
  emissive?: boolean;
  collisionOnly?: boolean;
  flicker?: boolean; // the one severely-flickering escape wall — visual hint only
  puddle?: boolean;  // decorative murky floor puddle — visual only, no collision
  lightDecor?: boolean; // extra tube alongside a lit cell's primary fixture — visual density only,
                         // excluded from the roaming light-pool's target list (see XonoticCanvas.tsx)
}

export interface FragLog {
  id: string;
  killer: string;
  victim: string;
  timestamp: number;
}

export interface XonoticGameState {
  player: Player3D;
  bots: Bot[];
  pickups: PickupItem[];
  fragFeed: FragLog[];
  matchTime: number;
  isFrozen?: boolean;
  monsterWarning?: boolean; // the monster is within 7m of the player right now
  escaped?: boolean;        // found and dove through the flickering wall — the run is won
}
