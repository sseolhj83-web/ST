import { useId } from 'react';
import { HeroCharacter } from '../game/types';

interface CharacterPreviewProps {
  character: HeroCharacter;
  size?: number;
}

const INK = '#17171f'; // comic outline ink

/**
 * 2D 만화풍 캐릭터 렌더러.
 * 레이어 순서(뒤 → 앞): 배경 글로우 → 그림자 → 망토 → 후드(후디) → 뒷머리 →
 * 다리/부츠 → 몸통 → 의상 디테일 → 팔/장갑 → 목 → 얼굴 → 표정/가면 → 앞머리
 */
export function CharacterPreview({ character, size = 200 }: CharacterPreviewProps) {
  const { role, hairstyle, face, outfit, cape, colors } = character;
  const isHero = role === 'HERO';
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const glowId = `glow-${uid}`;
  const dotsId = `dots-${uid}`;
  const glowColor = isHero ? '#fbbf24' : '#ef4444';

  return (
    <svg
      width={size}
      height={size * 1.35}
      viewBox="0 0 200 270"
      className="drop-shadow-2xl select-none"
      role="img"
      aria-label={`${character.name} 캐릭터 미리보기`}
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor={glowColor} stopOpacity="0.35" />
          <stop offset="70%" stopColor={glowColor} stopOpacity="0.08" />
          <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
        </radialGradient>
        <pattern id={dotsId} width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="2.2" cy="2.2" r="1.3" fill="#334155" />
        </pattern>
      </defs>

      {/* ── 배경: 만화풍 하프톤 + 역할 글로우 ── */}
      <rect x="0" y="0" width="200" height="270" fill={`url(#${dotsId})`} opacity="0.18" />
      <ellipse cx="100" cy="120" rx="96" ry="110" fill={`url(#${glowId})`} />
      <ellipse cx="100" cy="240" rx="48" ry="9" fill="rgba(0,0,0,0.20)" />

      {/* ── 망토 (몸통 뒤) ── */}
      {cape === 'SHORT' && (
        <path
          d="M 76 108 Q 60 128 58 158 Q 57 166 66 166 L 134 166 Q 143 166 142 158 Q 140 128 124 108 Z"
          fill={colors.cape}
          stroke={INK}
          strokeWidth="3"
        />
      )}
      {cape === 'LONG' && (
        <path
          d="M 76 108 Q 52 140 50 200 Q 49 232 58 236 L 142 236 Q 151 232 150 200 Q 148 140 124 108 Z"
          fill={colors.cape}
          stroke={INK}
          strokeWidth="3"
        />
      )}
      {cape === 'FLOWING' && (
        <path
          d="M 76 108 Q 48 140 40 205 Q 36 238 30 252 Q 48 240 55 250 Q 68 236 80 248 Q 92 234 104 248 Q 116 234 128 248 Q 140 236 150 250 Q 157 240 170 252 Q 164 238 160 205 Q 152 140 124 108 Z"
          fill={colors.cape}
          stroke={INK}
          strokeWidth="3"
        />
      )}

      {/* ── 후드 (후디 의상 전용, 얼굴 뒤) ── */}
      {outfit === 'HOODIE' && (
        <path
          d="M 70 108 Q 62 48 100 40 Q 138 48 130 108 Q 116 76 100 74 Q 84 76 70 108 Z"
          fill={colors.outfit}
          stroke={INK}
          strokeWidth="3"
        />
      )}

      {/* ── 뒷머리 (긴 머리) ── */}
      {hairstyle === 'LONG' && (
        <>
          <path d="M 76 60 Q 70 105 66 148 Q 72 154 79 149 Q 79 105 85 72 Z" fill={colors.hair} stroke={INK} strokeWidth="2.5" />
          <path d="M 124 60 Q 130 105 134 148 Q 128 154 121 149 Q 121 105 115 72 Z" fill={colors.hair} stroke={INK} strokeWidth="2.5" />
        </>
      )}

      {/* ── 다리 ── */}
      <rect x="84" y="163" width="13" height="45" rx="6" fill={colors.outfit} stroke={INK} strokeWidth="3" />
      <rect x="103" y="163" width="13" height="45" rx="6" fill={colors.outfit} stroke={INK} strokeWidth="3" />
      {/* 부츠 */}
      <rect x="82" y="205" width="17" height="23" rx="6" fill="#23232f" stroke={INK} strokeWidth="3" />
      <rect x="101" y="205" width="17" height="23" rx="6" fill="#23232f" stroke={INK} strokeWidth="3" />
      <rect x="82" y="218" width="17" height="4" rx="2" fill={colors.accent} />
      <rect x="101" y="218" width="17" height="4" rx="2" fill={colors.accent} />

      {/* ── 몸통 ── */}
      <path
        d="M 72 118 Q 72 104 88 104 L 112 104 Q 128 104 128 118 L 128 158 Q 128 168 118 168 L 82 168 Q 72 168 72 158 Z"
        fill={colors.outfit}
        stroke={INK}
        strokeWidth="3"
      />

      {/* ── 의상 디테일 ── */}
      {outfit === 'CLASSIC' && (
        <g>
          {/* 가슴 문양: 번개 */}
          <path d="M 104 116 L 93 133 L 100 133 L 96 144 L 107 127 L 100 127 Z" fill={colors.accent} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          {/* 벨트 */}
          <rect x="74" y="149" width="52" height="9" rx="3" fill={colors.accent} stroke={INK} strokeWidth="2" />
          <rect x="95" y="147" width="10" height="13" rx="2" fill="#f1f5f9" stroke={INK} strokeWidth="2" />
        </g>
      )}
      {outfit === 'SUIT' && (
        <g>
          <path d="M 90 104 L 100 128 L 110 104 Z" fill="#e2e8f0" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M 100 108 L 95 116 L 100 138 L 105 116 Z" fill={colors.accent} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M 90 104 L 100 122 L 86 119 Z" fill="rgba(0,0,0,0.28)" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M 110 104 L 100 122 L 114 119 Z" fill="rgba(0,0,0,0.28)" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="104" cy="144" r="1.8" fill="rgba(0,0,0,0.45)" />
          <circle cx="104" cy="152" r="1.8" fill="rgba(0,0,0,0.45)" />
        </g>
      )}
      {outfit === 'ARMOR' && (
        <g>
          <rect x="82" y="110" width="36" height="34" rx="8" fill="rgba(255,255,255,0.16)" stroke={INK} strokeWidth="2.5" />
          <path d="M 88 124 L 112 124 M 100 110 L 100 144" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
          <circle cx="86" cy="116" r="1.6" fill="rgba(0,0,0,0.45)" />
          <circle cx="114" cy="116" r="1.6" fill="rgba(0,0,0,0.45)" />
          <circle cx="86" cy="138" r="1.6" fill="rgba(0,0,0,0.45)" />
          <circle cx="114" cy="138" r="1.6" fill="rgba(0,0,0,0.45)" />
          <rect x="74" y="149" width="52" height="9" rx="3" fill={colors.accent} stroke={INK} strokeWidth="2" />
        </g>
      )}
      {outfit === 'HOODIE' && (
        <g>
          <rect x="86" y="140" width="28" height="18" rx="6" fill="rgba(0,0,0,0.16)" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
          <path d="M 92 106 Q 91 118 92 126 M 108 106 Q 109 118 108 126" stroke={colors.accent} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="92" cy="128" r="2" fill={colors.accent} />
          <circle cx="108" cy="128" r="2" fill={colors.accent} />
        </g>
      )}
      {outfit === 'TACTICAL' && (
        <g>
          <path d="M 76 108 L 124 152 M 124 108 L 76 152" stroke="rgba(0,0,0,0.45)" strokeWidth="7" strokeLinecap="round" />
          <path d="M 76 108 L 124 152 M 124 108 L 76 152" stroke={colors.accent} strokeWidth="2" strokeLinecap="round" />
          <rect x="88" y="100" width="24" height="8" rx="3" fill="rgba(0,0,0,0.30)" />
          <rect x="74" y="149" width="52" height="9" rx="3" fill="rgba(0,0,0,0.55)" />
          <rect x="81" y="146" width="10" height="13" rx="2" fill="rgba(0,0,0,0.35)" stroke={INK} strokeWidth="1.5" />
          <rect x="95" y="146" width="10" height="13" rx="2" fill="rgba(0,0,0,0.35)" stroke={INK} strokeWidth="1.5" />
          <rect x="109" y="146" width="10" height="13" rx="2" fill="rgba(0,0,0,0.35)" stroke={INK} strokeWidth="1.5" />
        </g>
      )}

      {/* ── 팔 + 장갑 ── */}
      <path d="M 71 112 Q 62 140 63 166 Q 63 174 70 174 Q 77 174 76 166 Q 75 140 79 112 Z" fill={colors.outfit} stroke={INK} strokeWidth="3" />
      <path d="M 129 112 Q 138 140 137 166 Q 137 174 130 174 Q 123 174 124 166 Q 125 140 121 112 Z" fill={colors.outfit} stroke={INK} strokeWidth="3" />
      <circle cx="69" cy="179" r="8" fill={colors.accent} stroke={INK} strokeWidth="3" />
      <circle cx="131" cy="179" r="8" fill={colors.accent} stroke={INK} strokeWidth="3" />
      {/* 아머 어깨 패드 */}
      {outfit === 'ARMOR' && (
        <>
          <circle cx="72" cy="113" r="10" fill={colors.accent} stroke={INK} strokeWidth="3" />
          <circle cx="128" cy="113" r="10" fill={colors.accent} stroke={INK} strokeWidth="3" />
        </>
      )}

      {/* ── 목 ── */}
      <rect x="92" y="92" width="16" height="16" rx="5" fill={colors.skin} stroke={INK} strokeWidth="3" />

      {/* ── 얼굴 (형태별) ── */}
      {face === 'NORMAL' && (
        <path d="M 78 62 Q 78 46 100 46 Q 122 46 122 62 L 122 80 Q 122 98 100 102 Q 78 98 78 80 Z" fill={colors.skin} stroke={INK} strokeWidth="3" />
      )}
      {face === 'SQUARE' && (
        <path d="M 78 62 Q 78 46 100 46 Q 122 46 122 62 L 122 94 L 112 100 L 88 100 L 78 94 Z" fill={colors.skin} stroke={INK} strokeWidth="3" />
      )}
      {face === 'ROUND' && (
        <ellipse cx="100" cy="73" rx="24" ry="27" fill={colors.skin} stroke={INK} strokeWidth="3" />
      )}
      {face === 'ANGULAR' && (
        <path d="M 79 58 L 100 45 L 121 58 L 117 84 L 100 102 L 83 84 Z" fill={colors.skin} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      )}
      {face === 'SHARP' && (
        <path d="M 78 60 Q 82 46 100 46 Q 118 46 122 60 L 113 82 L 100 104 L 87 82 Z" fill={colors.skin} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      )}

      {/* ── 표정: 히어로는 맑은 눈, 빌런은 가면 + 빛나는 눈 ── */}
      {isHero ? (
        <g>
          <ellipse cx="88" cy="72" rx="5.5" ry="6.5" fill="#ffffff" stroke={INK} strokeWidth="2" />
          <ellipse cx="112" cy="72" rx="5.5" ry="6.5" fill="#ffffff" stroke={INK} strokeWidth="2" />
          <circle cx="88" cy="73" r="2.6" fill={INK} />
          <circle cx="112" cy="73" r="2.6" fill={INK} />
          <circle cx="89.5" cy="70.5" r="1" fill="#ffffff" />
          <circle cx="113.5" cy="70.5" r="1" fill="#ffffff" />
          <path d="M 82 61 Q 88 57 94 61" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 106 61 Q 112 57 118 61" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 100 76 L 98 82 Q 100 84 102 82" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 91 87 Q 100 95 109 87" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <path d="M 76 62 Q 100 55 124 62 L 124 78 Q 100 85 76 78 Z" fill="#1e293b" stroke={INK} strokeWidth="2.5" />
          <ellipse cx="88" cy="70" rx="6" ry="3.6" fill="#f8fafc" transform="rotate(-12 88 70)" />
          <ellipse cx="112" cy="70" rx="6" ry="3.6" fill="#f8fafc" transform="rotate(12 112 70)" />
          <path d="M 92 90 Q 101 93 108 86" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* ── 앞머리 ── */}
      {hairstyle === 'SHORT' && (
        <path d="M 74 66 Q 74 42 100 40 Q 126 42 126 66 Q 118 52 100 52 Q 82 52 74 66 Z" fill={colors.hair} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      )}
      {hairstyle === 'LONG' && (
        <path d="M 74 66 Q 74 42 100 40 Q 126 42 126 66 Q 120 50 104 50 Q 86 50 74 66 Z" fill={colors.hair} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      )}
      {hairstyle === 'SPIKY' && (
        <path
          d="M 73 62 L 78 42 L 84 55 L 90 36 L 96 52 L 102 34 L 108 52 L 114 36 L 120 55 L 126 42 L 127 62 Q 100 54 73 62 Z"
          fill={colors.hair}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      )}
      {hairstyle === 'CURLY' && (
        <g fill={colors.hair} stroke={INK} strokeWidth="2.5">
          <circle cx="82" cy="58" r="10" />
          <circle cx="94" cy="50" r="11" />
          <circle cx="106" cy="50" r="11" />
          <circle cx="118" cy="58" r="10" />
          <circle cx="88" cy="66" r="9" />
          <circle cx="112" cy="66" r="9" />
          <circle cx="100" cy="62" r="10" />
        </g>
      )}
      {hairstyle === 'MOHAWK' && (
        <g>
          <path d="M 93 62 Q 93 36 100 20 Q 107 36 107 62 Z" fill={colors.hair} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M 75 66 Q 76 48 100 46 Q 124 48 125 66 Q 100 58 75 66 Z" fill={colors.hair} opacity="0.35" stroke={INK} strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}
