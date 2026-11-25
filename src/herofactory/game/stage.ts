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

/** 폐허가 된 미래 도시의 5개 구역. 경계는 모두 월드 좌표다. */
export interface StageSection {
  from: number;
  to: number;
  name: string;
  skyTop: string;
  skyBottom: string;
  accent: string;
}

export const STAGE_SECTIONS: StageSection[] = [
  { from: 0, to: 420, name: '시작 구역', skyTop: '#171336', skyBottom: '#5b356d', accent: '#38bdf8' },
  { from: 420, to: 1480, name: '무너진 도심 구역', skyTop: '#151734', skyBottom: '#4d355e', accent: '#a78bfa' },
  { from: 1480, to: 2700, name: '일반 적 전투 구역', skyTop: '#1b1233', skyBottom: '#592c5e', accent: '#f472b6' },
  { from: 2700, to: 3050, name: '중간 보스 구역', skyTop: '#25102e', skyBottom: '#6b2445', accent: '#fb7185' },
  { from: 3050, to: WORLD_WIDTH, name: '최종 보스 구역', skyTop: '#1b0a20', skyBottom: '#4b142f', accent: '#fbbf24' },
];

export function sectionAt(x: number): StageSection {
  return (
    STAGE_SECTIONS.find((section) => x < section.to) ??
    STAGE_SECTIONS[STAGE_SECTIONS.length - 1]
  );
}

/** 구역 이름 표지판의 고정 월드 좌표. */
export const SECTION_MARKERS = [
  { x: 70, name: '시작 구역', accent: '#38bdf8' },
  { x: 470, name: '무너진 도심', accent: '#a78bfa' },
  { x: 1580, name: '전투 구역', accent: '#f472b6' },
  { x: 2760, name: '중간 보스', accent: '#fb7185' },
  { x: 3120, name: '최종 보스 구역', accent: '#fbbf24' },
  { x: 5020, name: '보스의 성채', accent: '#fbbf24' },
];

/** 바닥 위의 고정 좌표 장애물. PLATFORMS와 함께 충돌 처리한다. */
export interface Obstacle extends Platform {
  style: 'CONCRETE' | 'CAR' | 'PIPE';
}

export const OBSTACLES: Obstacle[] = [
  { x: 800, y: GROUND_Y - 26, w: 38, h: 26, style: 'CONCRETE' },
  { x: 2090, y: GROUND_Y - 30, w: 44, h: 30, style: 'CAR' },
  { x: 3620, y: GROUND_Y - 24, w: 34, h: 24, style: 'PIPE' },
  { x: 4700, y: GROUND_Y - 28, w: 40, h: 28, style: 'CONCRETE' },
];

/** 보스전에서는 카메라를 고정해 전장 밖으로 시점이 새지 않게 한다. */
export interface CameraArena {
  name: string;
  from: number;
  to: number;
  cameraX: number;
}

export const CAMERA_ARENAS: CameraArena[] = [
  { name: '중간 보스', from: 2700, to: 2990, cameraX: 2410 },
  { name: '최종 보스', from: 5000, to: WORLD_WIDTH, cameraX: WORLD_WIDTH - VIEW_WIDTH },
];
