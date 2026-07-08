/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WeaponType = 'laser' | 'vaporizer' | 'rocket' | 'electro' | 'grenade' | 'flamethrower';

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
  state: 'wandering' | 'hunting' | 'jumping'; // for the monster: 'wandering' = lurking/hidden, 'hunting' = ambushing the player
  stateTimer: number;
  isTeammate?: boolean;
  isRemotePlayer?: boolean; // true = real online player (not AI)
  isMonster?: boolean;      // the single, unkillable Backrooms entity
  invulnerable?: boolean;   // damage is ignored entirely
  isHidden?: boolean;       // true while lurking — not rendered, doesn't announce itself
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
  flicker?: boolean; // the one severely-flickering escape wall — visual hint only
  puddle?: boolean;  // decorative murky floor puddle — visual only, no collision
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
  projectiles: Projectile[];
  pickups: PickupItem[];
  fragFeed: FragLog[];
  matchTime: number;
  isFrozen?: boolean;
  monsterWarning?: boolean; // the monster is within 7m of the player right now
  inRedRoom?: boolean;      // permanent once true — found the Red Room, there is no way back out
  escaped?: boolean;        // found and dove through the flickering wall — the run is won
}
