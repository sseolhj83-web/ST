import { CANVAS_SIZE, DrawingStroke } from './types';

/**
 * 드로잉 스트로크를 offscreen canvas에 그린다.
 * 지우개는 destination-out으로 처리해 "자기보다 먼저 그린 획"만 지운다.
 * DrawingPreview의 SVG 마스크와 같은 규칙이라 미리보기와 전투 스프라이트가 일치한다.
 */
export function rasterizeDrawing(
  strokes: DrawingStroke[],
  size = 256,
): HTMLCanvasElement | null {
  if (strokes.length === 0) return null;
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const scale = size / CANVAS_SIZE;
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    const isEraser = stroke.tool === 'ERASER';
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = isEraser ? '#000000' : stroke.color;
    ctx.fillStyle = isEraser ? '#000000' : stroke.color;
    ctx.lineWidth = isEraser ? Math.max(stroke.width + 2, 4) : stroke.width;

    const [first, ...rest] = stroke.points;
    ctx.beginPath();
    if (rest.length === 0) {
      ctx.arc(
        first.x,
        first.y,
        Math.max(ctx.lineWidth / 2, 1.5),
        0,
        Math.PI * 2,
      );
      ctx.fill();
      continue;
    }

    ctx.moveTo(first.x, first.y);
    if (rest.length === 1) {
      ctx.lineTo(rest[0].x, rest[0].y);
    } else {
      for (let i = 0; i < rest.length - 1; i++) {
        const p = rest[i];
        const next = rest[i + 1];
        ctx.quadraticCurveTo(
          p.x,
          p.y,
          (p.x + next.x) / 2,
          (p.y + next.y) / 2,
        );
      }
      const last = rest[rest.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}
