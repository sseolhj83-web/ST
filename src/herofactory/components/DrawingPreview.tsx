import { useId } from 'react';
import { CANVAS_SIZE, DrawingStroke, HeroCharacter } from '../game/types';

interface DrawingPreviewProps {
  character: HeroCharacter;
  /** 드로잉 중에는 아직 커밋되지 않은 획을 직접 넘겨 실시간으로 보여준다. */
  strokes?: DrawingStroke[];
  size?: number;
  className?: string;
}

function pathFromPoints(stroke: DrawingStroke): string | null {
  if (stroke.points.length < 2) return null;
  return stroke.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

/**
 * 사용자가 그린 획을 그대로 렌더링하는 미리보기.
 * 브러시 획 위에 지우개 획을 SVG mask로 얹어 실제로 지워진 것처럼 보이게 한다.
 * 드로잉 캔버스(읽기 전용 레이어)와 완성 화면에서 함께 사용한다.
 */
export function DrawingPreview({
  character,
  strokes,
  size = 200,
  className = '',
}: DrawingPreviewProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const maskId = `erase-${uid}`;
  const dotsId = `dots-${uid}`;
  const glowId = `glow-${uid}`;
  const c = CANVAS_SIZE;
  const isHero = character.role === 'HERO';
  const allStrokes = strokes ?? character.drawing;
  const brushes = allStrokes.filter((s) => s.tool === 'BRUSH');
  const erasers = allStrokes.filter((s) => s.tool === 'ERASER');

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${c} ${c}`}
      className={`select-none ${className}`}
      role="img"
      aria-label={`${character.name} 캐릭터 그림`}
    >
      <defs>
        <pattern id={dotsId} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="#64748b" />
        </pattern>
        <radialGradient id={glowId} cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor={isHero ? '#fbbf24' : '#ef4444'} stopOpacity="0.18" />
          <stop offset="100%" stopColor={isHero ? '#fbbf24' : '#ef4444'} stopOpacity="0" />
        </radialGradient>
        <mask id={maskId}>
          <rect x="0" y="0" width={c} height={c} fill="white" />
          {erasers.map((s, i) => {
            const d = pathFromPoints(s);
            const eraserWidth = s.width + 8;
            return d ? (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="black"
                strokeWidth={eraserWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <circle
                key={i}
                cx={s.points[0].x}
                cy={s.points[0].y}
                r={eraserWidth / 2}
                fill="black"
              />
            );
          })}
        </mask>
      </defs>

      {/* 만화 원고지 느낌의 밝은 배경 */}
      <rect x="0" y="0" width={c} height={c} rx="18" fill="#fbfaf6" />
      <rect x="0" y="0" width={c} height={c} rx="18" fill={`url(#${dotsId})`} opacity="0.35" />
      <rect x="0" y="0" width={c} height={c} rx="18" fill={`url(#${glowId})`} />

      {/* 사용자가 그린 그림 */}
      <g mask={`url(#${maskId})`}>
        {brushes.map((s, i) => {
          const d = pathFromPoints(s);
          return d ? (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <circle
              key={i}
              cx={s.points[0].x}
              cy={s.points[0].y}
              r={Math.max(s.width / 2, 1.5)}
              fill={s.color}
            />
          );
        })}
      </g>

      {/* 역할별 액자 */}
      <rect
        x="2"
        y="2"
        width={c - 4}
        height={c - 4}
        rx="18"
        fill="none"
        stroke={isHero ? '#fbbf24' : '#ef4444'}
        strokeWidth="4"
        opacity="0.8"
      />
    </svg>
  );
}
