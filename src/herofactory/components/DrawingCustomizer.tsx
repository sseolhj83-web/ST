import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, Brush, Eraser, Undo2, Trash2 } from 'lucide-react';
import { DrawingPreview } from './DrawingPreview';
import {
  CANVAS_SIZE,
  DRAWING_COLORS,
  DrawingStroke,
  HeroCharacter,
} from '../game/types';

interface DrawingCustomizerProps {
  character: HeroCharacter;
  onUpdate: (updates: Partial<HeroCharacter>) => void;
  onComplete: () => void;
  onBack: () => void;
}

type Tool = 'BRUSH' | 'ERASER';

export function DrawingCustomizer({
  character,
  onUpdate,
  onComplete,
  onBack,
}: DrawingCustomizerProps) {
  const [strokes, setStrokes] = useState<DrawingStroke[]>(character.drawing);
  const strokesRef = useRef<DrawingStroke[]>(character.drawing);
  const [tool, setTool] = useState<Tool>('BRUSH');
  const [color, setColor] = useState(DRAWING_COLORS[0]);
  const [brushWidth, setBrushWidth] = useState(8);
  const drawingRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // 획을 그리는 중에는 로컬 상태만 갱신해 전체 화면 리렌더링을 막고,
  // 획이 끝날 때 한 번만 캐릭터 데이터에 반영한다. (그리는 동안 끊김 방지)
  const applyStrokes = (next: DrawingStroke[], commit = false) => {
    strokesRef.current = next;
    setStrokes(next);
    if (commit) onUpdate({ drawing: next });
  };
  const commitStrokes = () => onUpdate({ drawing: strokesRef.current });

  const pointFromEvent = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const clamp = (v: number) =>
      Math.round(Math.max(0, Math.min(CANVAS_SIZE, v)) * 10) / 10;
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * CANVAS_SIZE),
      y: clamp(((e.clientY - rect.top) / rect.height) * CANVAS_SIZE),
    };
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    drawingRef.current = true;
    // 합성 이벤트나 일부 브라우저에서는 활성 포인터가 없어 캡처가 실패할 수 있다.
    // 캡처가 안 되어도 그 자체로 획은 정상적으로 기록되어야 한다.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 포인터 캡처는 최적화일 뿐, 드로잉 동작에 필수는 아니다.
    }
    const stroke: DrawingStroke = {
      points: [pointFromEvent(e)],
      color: tool === 'BRUSH' ? color : '#000000',
      width: brushWidth,
      tool,
    };
    applyStrokes([...strokesRef.current, stroke]);
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const point = pointFromEvent(e);
    const prev = strokesRef.current;
    if (prev.length === 0) return;
    const last = prev[prev.length - 1];
    const prevPoint = last.points[last.points.length - 1];
    // 같은 자리 근처의 중복 점은 버려 용량이 커지는 걸 막는다.
    if (Math.abs(point.x - prevPoint.x) + Math.abs(point.y - prevPoint.y) < 0.8) return;
    applyStrokes([
      ...prev.slice(0, -1),
      { ...last, points: [...last.points, point] },
    ]);
  };

  const handlePointerEnd = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // 캡처가 없었으면 해제할 것도 없다.
    }
    // 드로잉 중에는 부모에 알리지 않았으므로 획이 끝날 때 반영한다.
    commitStrokes();
  };

  const undo = () => applyStrokes(strokesRef.current.slice(0, -1), true);
  const clearAll = () => applyStrokes([], true);
  const isHero = character.role === 'HERO';

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white flex flex-col lg:flex-row overflow-x-hidden">
      {/* ── 뒤로가기 (고정) ── */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 z-30 flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 border border-white/10 rounded-xl text-sm font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        뒤로가기
      </button>

      {/* ── 왼쪽: 실시간 미리보기 ── */}
      <aside className="w-full lg:w-[330px] xl:w-[380px] shrink-0 bg-slate-900/40 border-b lg:border-b-0 lg:border-r border-slate-700/60 backdrop-blur-sm flex flex-col items-center justify-center gap-5 p-6 pt-20 lg:pt-6">
        <p className="text-xs font-bold tracking-[0.3em] text-cyan-300/80 uppercase">
          Live Preview
        </p>
        <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600/50 shadow-2xl">
          <DrawingPreview
            character={character}
            strokes={strokes}
            size={230}
            className="rounded-2xl"
          />
        </div>
        <h3 className="text-3xl font-black text-center break-words">{character.name}</h3>
        <span
          className={`px-4 py-1 rounded-full text-sm font-bold border ${
            isHero
              ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
              : 'bg-red-500/20 text-red-300 border-red-400/40'
          }`}
        >
          {isHero ? '히어로' : '빌런'}
        </span>
        <p className="text-xs text-slate-400 text-center">
          {strokes.length === 0
            ? '아직 그림이 없습니다. 캔버스에 첫 획을 그려보세요!'
            : `${strokes.length}개의 획으로 만들어진 나만의 캐릭터`}
        </p>
      </aside>

      {/* ── 오른쪽: 드로잉 캔버스 + 도구 ── */}
      <main className="flex-1 min-w-0 flex flex-col gap-4 px-4 md:px-8 pt-20 lg:pt-16 pb-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              캐릭터 직접 그리기
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              마우스나 손가락으로 그린 그림이 그대로 캐릭터가 됩니다
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={undo}
              disabled={strokes.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 rounded-lg text-sm font-bold transition-colors"
            >
              <Undo2 className="w-4 h-4" />
              실행 취소
            </button>
            <button
              onClick={clearAll}
              disabled={strokes.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 rounded-lg text-sm font-bold transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              전체 지우기
            </button>
          </div>
        </header>

        {/* 도구 모음 */}
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-700/60">
          <div className="flex gap-1 p-1 bg-slate-800 rounded-xl">
            <button
              onClick={() => setTool('BRUSH')}
              aria-pressed={tool === 'BRUSH'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                tool === 'BRUSH' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Brush className="w-4 h-4" />
              브러시
            </button>
            <button
              onClick={() => setTool('ERASER')}
              aria-pressed={tool === 'ERASER'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                tool === 'ERASER' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Eraser className="w-4 h-4" />
              지우개
            </button>
          </div>

          <div className="h-8 w-px bg-slate-700" />

          {/* 색상 스왓 */}
          <div className="flex flex-wrap gap-1.5">
            {DRAWING_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`색상 ${c}`}
                aria-pressed={tool === 'BRUSH' && color === c}
                onClick={() => {
                  setColor(c);
                  setTool('BRUSH');
                }}
                style={{ backgroundColor: c }}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                  tool === 'BRUSH' && color === c
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-slate-600 hover:border-slate-300 hover:scale-105'
                }`}
              />
            ))}
          </div>

          <div className="h-8 w-px bg-slate-700" />

          {/* 굵기 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">굵기</span>
            <input
              type="range"
              min={3}
              max={28}
              value={brushWidth}
              onChange={(e) => setBrushWidth(Number(e.target.value))}
              aria-label="브러시 굵기"
              className="w-24 md:w-32 accent-cyan-400"
            />
            <span
              className="w-5 h-5 rounded-full bg-white border border-slate-500 shrink-0"
              style={{ transform: `scale(${Math.max(0.35, brushWidth / 16)})` }}
            />
            <span className="text-xs text-slate-400 w-9">{brushWidth}px</span>
          </div>
        </div>

        {/* 드로잉 영역: 아래는 그림 렌더링, 위는 입력 전용 투명 레이어 */}
        <div className="relative w-full max-w-[560px] mx-auto aspect-square rounded-2xl overflow-hidden shadow-2xl">
          <DrawingPreview
            character={character}
            strokes={strokes}
            className="absolute inset-0 w-full h-full rounded-2xl"
          />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
            className={`absolute inset-0 w-full h-full touch-none ${
              tool === 'ERASER' ? 'cursor-cell' : 'cursor-crosshair'
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onLostPointerCapture={handlePointerEnd}
            aria-label="캐릭터 그리기 캔버스"
          />
          {strokes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="px-5 py-3 rounded-xl bg-slate-900/70 text-slate-200 text-sm md:text-base font-bold text-center">
                여기에 캐릭터를 그려보세요!
              </p>
            </div>
          )}
        </div>

        {/* 완성 버튼 */}
        <div className="flex justify-center mt-auto pt-2">
          <button
            onClick={onComplete}
            className="w-full max-w-[560px] py-4 text-lg font-black rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:shadow-lg hover:shadow-blue-500/40 transition-all"
          >
            캐릭터 완성
          </button>
        </div>
      </main>
    </div>
  );
}
