export type Role = 'HERO' | 'VILLAIN';

/** 드로잉 좌표계(CANVAS_SIZE × CANVAS_SIZE) 위의 한 점 */
export interface DrawingPoint {
  x: number;
  y: number;
}

/** 사용자가 그린 한 획. 수정은 획 단위 되돌리기로만 한다. */
export interface DrawingStroke {
  points: DrawingPoint[];
  color: string;
  width: number;
}

/** 그린 그림 자체가 캐릭터의 외형이다. */
export interface HeroCharacter {
  name: string;
  role: Role;
  drawing: DrawingStroke[];
}

/** 드로잉/미리보기에서 공통으로 쓰는 정사각 기준 좌표계 */
export const CANVAS_SIZE = 400;

/** 만화풍 팔레트: 잉크/회색 + 12색 + 피부/머리 색 */
export const DRAWING_COLORS = [
  '#17171f', // 잉크 블랙
  '#ffffff',
  '#94a3b8',
  '#ef4444',
  '#f97316',
  '#fbbf24',
  '#84cc16',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#f4c2a1',
  '#d4945c',
  '#8b4513',
];
