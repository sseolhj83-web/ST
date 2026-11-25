import { useId } from 'react';
import { CANVAS_SIZE, DrawingStroke, HeroCharacter } from '../game/types';

interface DrawingPreviewProps {
  character: HeroCharacter;
  /** 드로잉 중에는 아직 커밋되지 않은 획을 직접 넘겨 실시간으로 보여준다. */
  strokes?: DrawingStroke[];
  size?: number;
  className?: string;
}

/** 점 사이를 부드러운 곡선으로 연결해 손그림처럼 보이게 한다. */
function pathFromPoints(stroke: DrawingStroke): string | null {
  const pts = stroke.points;
  if (pts.length < 2) return null;
  const fmt = (p: { x: number; y: number }) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  if (pts.length === 2) return `M ${fmt(pts[0])} L ${fmt(pts[1])}`;

  let d = `M ${fmt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${fmt(pts[i])} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${fmt(last)}`;
}

interface StrokeGroup {
  brushes: DrawingStroke[];
  /** 이 묶음의 획들보다 나중에 그려져서 실제로 지워야 하는 지우개 획 */
  erasers: DrawingStroke[];
}

/**
 * 지우개는 "자기보다 먼저 그린 획"만 지운다.
 * 획 순서대로 묶음을 만들고, 각 묶음 뒤에 나온 지우개만 마스크에 넣는다.
 * 이렇게 하면 지운 자리 위에 다시 그린 획은 그대로 보인다.
 */
function groupStrokes(strokes: DrawingStroke[]): StrokeGroup[] {
  const groups: StrokeGroup[] = [];
  let brushes: DrawingStroke[] = [];
  let fromIndex = 0;

  strokes.forEach((s, i) => {
    if (s.tool === 'ERASER') {
      if (brushes.length) {
        groups.push({
          brushes,
          erasers: strokes.filter(
            (e, ei) => e.tool === 'ERASER' && ei >= fromIndex,
          ),
        });
        brushes = [];
      }
      fromIndex = i + 1;
    } else {
      brushes.push(s);
    }
  });

  if (brushes.length) {
    groups.push({
      brushes,
      erasers: strokes.filter(
        (e, ei) => e.tool === 'ERASER' && ei >= fromIndex,
      ),
    });
  }
  return groups;
}

function eraserShape(s: DrawingStroke, key: number) {
  const d = pathFromPoints(s);
  const size = Math.max(s.width + 2, 4);
  return d ? (
    <path
      key={key}
      d={d}
      fill="none"
      stroke="black"
      strokeWidth={size}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ) : (
    <circle
      key={key}
      cx={s.points[0].x}
      cy={s.points[0].y}
      r={size / 2}
      fill="black"
    />
  );
}

/**
 * 사용자가 그린 획을 그대로 렌더링하는 미리보기.
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
  const groups = groupStrokes(strokes ?? character.drawing);

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
        {groups.map((group, gi) =>
          group.erasers.length > 0 ? (
            <mask key={gi} id={`${maskId}-${gi}`}>
              <rect x="0" y="0" width={c} height={c} fill="white" />
              {group.erasers.map(eraserShape)}
            </mask>
          ) : null,
        )}
      </defs>

      {/* 만화 원고지 느낌의 밝은 배경 */}
      <rect x="0" y="0" width={c} height={c} rx="18" fill="#fbfaf6" />
      <rect x="0" y="0" width={c} height={c} rx="18" fill={`url(#${dotsId})`} opacity="0.35" />
      <rect x="0" y="0" width={c} height={c} rx="18" fill={`url(#${glowId})`} />

      {/* 사용자가 그린 그림: 그린 순서대로, 뒤에 나온 지우개만 적용 */}
      {groups.map((group, gi) => (
        <g
          key={gi}
          mask={
            group.erasers.length > 0 ? `url(#${maskId}-${gi})` : undefined
          }
        >
          {group.brushes.map((s, si) => {
            const d = pathFromPoints(s);
            return d ? (
              <path
                key={si}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <circle
                key={si}
                cx={s.points[0].x}
                cy={s.points[0].y}
                r={Math.max(s.width / 2, 1.5)}
                fill={s.color}
              />
            );
          })}
        </g>
      ))}

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
