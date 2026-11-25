/** 스테이지의 논리 해상도. 캔버스는 이 좌표계로 그린 뒤 CSS로 확대한다. */
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;
export const WORLD_WIDTH = 5600;
/** 바닥 위쪽 y 좌표 */
export const GROUND_Y = 470;

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 바닥은 중간중간 끊겨 있어 점프를 연습할 수 있다. */
export const PLATFORMS: Platform[] = [
  { x: 0, y: GROUND_Y, w: 1480, h: 70 },
  { x: 1540, y: GROUND_Y, w: 1440, h: 70 },
  { x: 3040, y: GROUND_Y, w: 1260, h: 70 },
  { x: 4360, y: GROUND_Y, w: 1240, h: 70 },
  { x: 430, y: 380, w: 180, h: 18 },
  { x: 900, y: 330, w: 150, h: 18 },
  { x: 1240, y: 395, w: 170, h: 18 },
  { x: 1750, y: 375, w: 190, h: 18 },
  { x: 2250, y: 320, w: 170, h: 18 },
  { x: 2700, y: 390, w: 190, h: 18 },
  { x: 3350, y: 360, w: 200, h: 18 },
  { x: 3850, y: 315, w: 170, h: 18 },
  { x: 4250, y: 385, w: 180, h: 18 },
  { x: 4720, y: 340, w: 170, h: 18 },
  { x: 5100, y: 390, w: 190, h: 18 },
];

export type EnemyKind = 'GRUNT' | 'MID' | 'BOSS';

export interface EnemySpawn {
  id: number;
  kind: EnemyKind;
  zone: number;
  x: number;
  y: number;
  patrolMin: number;
  patrolMax: number;
}

export const ENEMY_SPAWNS: EnemySpawn[] = [
  // 1구역 — 기본 빌런 3명
  { id: 1, kind: 'GRUNT', zone: 1, x: 560, y: GROUND_Y - 52, patrolMin: 430, patrolMax: 760 },
  { id: 2, kind: 'GRUNT', zone: 1, x: 1030, y: GROUND_Y - 52, patrolMin: 900, patrolMax: 1200 },
  { id: 3, kind: 'GRUNT', zone: 1, x: 1320, y: GROUND_Y - 52, patrolMin: 1240, patrolMax: 1410 },
  // 2구역 — 기본 빌런 3명 + 중간 보스
  { id: 4, kind: 'GRUNT', zone: 2, x: 1830, y: GROUND_Y - 52, patrolMin: 1700, patrolMax: 2020 },
  { id: 5, kind: 'GRUNT', zone: 2, x: 2280, y: GROUND_Y - 52, patrolMin: 2150, patrolMax: 2450 },
  { id: 6, kind: 'GRUNT', zone: 2, x: 2650, y: GROUND_Y - 52, patrolMin: 2510, patrolMax: 2790 },
  { id: 7, kind: 'MID', zone: 2, x: 2890, y: GROUND_Y - 72, patrolMin: 2820, patrolMax: 2960 },
  // 3구역 — 기본 빌런 4명 + 최종 보스
  { id: 8, kind: 'GRUNT', zone: 3, x: 3380, y: GROUND_Y - 52, patrolMin: 3250, patrolMax: 3560 },
  { id: 9, kind: 'GRUNT', zone: 3, x: 3900, y: GROUND_Y - 52, patrolMin: 3760, patrolMax: 4050 },
  { id: 10, kind: 'GRUNT', zone: 3, x: 4460, y: GROUND_Y - 52, patrolMin: 4350, patrolMax: 4620 },
  { id: 11, kind: 'GRUNT', zone: 3, x: 4900, y: GROUND_Y - 52, patrolMin: 4790, patrolMax: 5060 },
  { id: 12, kind: 'BOSS', zone: 3, x: 5270, y: GROUND_Y - 96, patrolMin: 5180, patrolMax: 5420 },
];

/** 구간 경계. 담당 구역의 빌런을 모두 처치해야 열린다. */
export interface Gate {
  x: number;
  zone: number;
  label: string;
}

export const GATES: Gate[] = [
  { x: 1450, zone: 1, label: '1구역' },
  { x: 2990, zone: 2, label: '2구역' },
];

export const ENEMY_STATS: Record<
  EnemyKind,
  { w: number; h: number; hp: number; speed: number; damage: number; range: number; cooldown: number; shotSpeed: number; name: string }
> = {
  GRUNT: { w: 46, h: 52, hp: 32, speed: 62, damage: 7, range: 260, cooldown: 1.7, shotSpeed: 250, name: '빌런' },
  MID: { w: 62, h: 72, hp: 100, speed: 78, damage: 11, range: 340, cooldown: 1.2, shotSpeed: 295, name: '중간 보스' },
  BOSS: { w: 84, h: 96, hp: 190, speed: 58, damage: 15, range: 460, cooldown: 1.0, shotSpeed: 330, name: '최종 보스' },
};
