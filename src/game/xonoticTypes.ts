/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WeaponType = 'laser' | 'vaporizer' | 'rocket' | 'electro' | 'grenade';

export interface Weapon {
  type: WeaponType;
  name: string;
  ammo: number;
  maxAmmo: number;
  fireRate: number; // ms
  lastFireTime: number;
  damage: number;
  color: string;
}

export interface Player3D {
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  weapons: Record<WeaponType, Weapon>;
  currentWeapon: WeaponType;
  onGround: boolean;
  score: number;
  deaths: number;
  isAiming?: boolean;
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
  currentWeapon: WeaponType;
  lastShootTime: number;
  lastMeleeTime: number;
  targetPos: { x: number; y: number; z: number } | null;
  state: 'wandering' | 'hunting' | 'jumping';
  stateTimer: number;
  isTeammate?: boolean;
  isRemotePlayer?: boolean; // true = real online player (not AI)
}

export interface Projectile {
  id: string;
  type: 'rocket' | 'plasma' | 'grenade';
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  radius: number;
  damage: number;
  color: string;
  ownerId: 'player' | string;
  bounces?: number;
  lifeTime?: number;
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
  type: 'health_mega' | 'armor_mega' | 'weapon_vaporizer' | 'weapon_rocket' | 'weapon_grenade' | 'ammo';
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
}

export interface PeacefulNpc {
  id: string;
  name: string;
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  angle: number;
  gender: 'man' | 'woman' | 'child' | 'elder';
  clothesColor: string;
  wanderTimer: number;
}

export interface FragLog {
  id: string;
  killer: string;
  victim: string;
  weapon: WeaponType;
  timestamp: number;
}

export interface XonoticGameState {
  player: Player3D;
  bots: Bot[];
  npcs?: PeacefulNpc[];
  projectiles: Projectile[];
  pickups: PickupItem[];
  fragFeed: FragLog[];
  matchTime: number;
  isFrozen?: boolean;
  dimension?: 'upside_down' | 'peaceful';
}
