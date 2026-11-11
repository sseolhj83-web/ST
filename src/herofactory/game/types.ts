export type Role = 'HERO' | 'VILLAIN';

export type Hairstyle = 'SHORT' | 'LONG' | 'SPIKY' | 'CURLY' | 'MOHAWK';
export type Face = 'NORMAL' | 'SQUARE' | 'ROUND' | 'ANGULAR' | 'SHARP';
export type Outfit = 'CLASSIC' | 'SUIT' | 'ARMOR' | 'HOODIE' | 'TACTICAL';
export type Cape = 'NONE' | 'SHORT' | 'LONG' | 'FLOWING';

export interface CharacterColors {
  skin: string;
  hair: string;
  outfit: string;
  cape: string;
  accent: string;
}

export interface HeroCharacter {
  name: string;
  role: Role;
  hairstyle: Hairstyle;
  face: Face;
  outfit: Outfit;
  cape: Cape;
  colors: CharacterColors;
}

export const DEFAULT_COLORS: CharacterColors = {
  skin: '#f4c2a1',
  hair: '#4a3728',
  outfit: '#2563eb',
  cape: '#dc2626',
  accent: '#fbbf24',
};

export const HAIRSTYLE_LABELS: Record<Hairstyle, string> = {
  SHORT: '짧은 머리',
  LONG: '긴 머리',
  SPIKY: '뾰족한 머리',
  CURLY: '곱슬머리',
  MOHAWK: '모히칸',
};

export const FACE_LABELS: Record<Face, string> = {
  NORMAL: '보통',
  SQUARE: '각진 얼굴',
  ROUND: '둥근 얼굴',
  ANGULAR: '날카로운 얼굴',
  SHARP: '예리한 얼굴',
};

export const OUTFIT_LABELS: Record<Outfit, string> = {
  CLASSIC: '클래식',
  SUIT: '슈트',
  ARMOR: '아머',
  HOODIE: '후디',
  TACTICAL: '전술복',
};

export const CAPE_LABELS: Record<Cape, string> = {
  NONE: '없음',
  SHORT: '짧은 망토',
  LONG: '긴 망토',
  FLOWING: '흐르는 망토',
};

export const SKIN_COLORS = ['#f4c2a1', '#e6a57e', '#d4945c', '#8b4513', '#654321'];
export const HAIR_COLORS = ['#4a3728', '#2d1810', '#000000', '#8b4513', '#ffd700', '#dc2626', '#9333ea'];
export const OUTFIT_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#1f2937'];
export const CAPE_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#9333ea', '#fbbf24', '#1f2937', '#000000'];
export const ACCENT_COLORS = ['#fbbf24', '#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#ffffff'];
