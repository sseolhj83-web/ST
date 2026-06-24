import { useRef, useCallback } from 'react';

interface MobileControlsProps {
  keysRef: React.MutableRefObject<{ w: boolean; s: boolean; a: boolean; d: boolean; space: boolean; }>;
  mouseDeltaRef: React.MutableRefObject<{ dx: number; dy: number }>;
  isMouseDownRef: React.MutableRefObject<boolean>;
}

const JOYSTICK_RADIUS = 52;
const DEADZONE = 12;
const LOOK_SENSITIVITY = 0.005;

type JoystickState = {
  active: boolean;
  touchId: number;
  startX: number;
  startY: number;
};

type LookState = {
  active: boolean;
  touchId: number;
  lastX: number;
  lastY: number;
};

export function MobileControls({ keysRef, mouseDeltaRef, isMouseDownRef }: MobileControlsProps) {
  const joystickState = useRef<JoystickState>({ active: false, touchId: -1, startX: 0, startY: 0 });
  const lookState = useRef<LookState>({ active: false, touchId: -1, lastX: 0, lastY: 0 });

  // Joystick base visual (shows where thumb landed)
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickHandleRef = useRef<HTMLDivElement>(null);

  const releaseMovementKeys = useCallback(() => {
    keysRef.current.w = false;
    keysRef.current.s = false;
    keysRef.current.a = false;
    keysRef.current.d = false;
  }, [keysRef]);

  const applyJoystick = useCallback((dx: number, dy: number) => {
    releaseMovementKeys();
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < DEADZONE) return;
    const threshold = JOYSTICK_RADIUS * 0.28;
    if (dy < -threshold) keysRef.current.w = true;
    if (dy > threshold) keysRef.current.s = true;
    if (dx < -threshold) keysRef.current.a = true;
    if (dx > threshold) keysRef.current.d = true;
  }, [keysRef, releaseMovementKeys]);

  // ── Left side: joystick ──────────────────────────────────────────
  const onLeftTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const js = joystickState.current;
    if (js.active) return;
    const t = e.changedTouches[0];
    js.active = true;
    js.touchId = t.identifier;
    js.startX = t.clientX;
    js.startY = t.clientY;

    if (joystickBaseRef.current) {
      joystickBaseRef.current.style.display = 'block';
      joystickBaseRef.current.style.left = `${t.clientX - JOYSTICK_RADIUS}px`;
      joystickBaseRef.current.style.top = `${t.clientY - JOYSTICK_RADIUS}px`;
    }
    if (joystickHandleRef.current) {
      joystickHandleRef.current.style.transform = 'translate(0px,0px)';
    }
  }, []);

  const onLeftTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const js = joystickState.current;
    if (!js.active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== js.touchId) continue;
      let dx = t.clientX - js.startX;
      let dy = t.clientY - js.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > JOYSTICK_RADIUS) {
        dx = (dx / dist) * JOYSTICK_RADIUS;
        dy = (dy / dist) * JOYSTICK_RADIUS;
      }
      if (joystickHandleRef.current) {
        joystickHandleRef.current.style.transform = `translate(${dx}px,${dy}px)`;
      }
      applyJoystick(dx, dy);
    }
  }, [applyJoystick]);

  const onLeftTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const js = joystickState.current;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === js.touchId) {
        js.active = false;
        releaseMovementKeys();
        if (joystickBaseRef.current) joystickBaseRef.current.style.display = 'none';
        if (joystickHandleRef.current) joystickHandleRef.current.style.transform = 'translate(0px,0px)';
      }
    }
  }, [releaseMovementKeys]);

  // ── Right side: look drag ─────────────────────────────────────────
  const onRightTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const ls = lookState.current;
    if (ls.active) return;
    const t = e.changedTouches[0];
    ls.active = true;
    ls.touchId = t.identifier;
    ls.lastX = t.clientX;
    ls.lastY = t.clientY;
  }, []);

  const onRightTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const ls = lookState.current;
    if (!ls.active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== ls.touchId) continue;
      mouseDeltaRef.current.dx += (t.clientX - ls.lastX) * LOOK_SENSITIVITY;
      mouseDeltaRef.current.dy += (t.clientY - ls.lastY) * LOOK_SENSITIVITY;
      ls.lastX = t.clientX;
      ls.lastY = t.clientY;
    }
  }, [mouseDeltaRef]);

  const onRightTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const ls = lookState.current;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === ls.touchId) {
        ls.active = false;
      }
    }
  }, []);

  return (
    <div
      className="absolute inset-0 z-40 pointer-events-none"
      style={{ touchAction: 'none' }}
    >
      {/* ── Left area: movement joystick ───────────────────────── */}
      <div
        className="absolute left-0 top-0 bottom-0 pointer-events-auto"
        style={{ width: '45%', touchAction: 'none' }}
        onTouchStart={onLeftTouchStart}
        onTouchMove={onLeftTouchMove}
        onTouchEnd={onLeftTouchEnd}
        onTouchCancel={onLeftTouchEnd}
      >
        {/* Hint label */}
        <div className="absolute top-3 left-3 text-white/25 text-xs font-mono pointer-events-none select-none">
          이동
        </div>

        {/* Jump button – fixed bottom-left, above joystick layer */}
        <button
          className="absolute bottom-6 left-6 pointer-events-auto select-none flex items-center justify-center font-bold text-sm rounded-full text-white"
          style={{
            width: 56,
            height: 56,
            background: 'rgba(59,130,246,0.65)',
            border: '2px solid rgba(147,197,253,0.7)',
            touchAction: 'none',
          }}
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); keysRef.current.space = true; }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); keysRef.current.space = false; }}
          onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); keysRef.current.space = false; }}
        >
          JUMP
        </button>
      </div>

      {/* ── Floating joystick visual (absolute, follows touch) ─── */}
      <div
        ref={joystickBaseRef}
        className="pointer-events-none"
        style={{
          position: 'absolute',
          width: JOYSTICK_RADIUS * 2,
          height: JOYSTICK_RADIUS * 2,
          display: 'none',
          zIndex: 50,
        }}
      >
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.25)' }}
        />
        {/* Handle */}
        <div
          ref={joystickHandleRef}
          className="absolute rounded-full"
          style={{
            width: 38,
            height: 38,
            left: JOYSTICK_RADIUS - 19,
            top: JOYSTICK_RADIUS - 19,
            background: 'rgba(255,255,255,0.45)',
            border: '2px solid rgba(255,255,255,0.8)',
          }}
        />
      </div>

      {/* ── Right area: look drag + fire button ────────────────── */}
      <div
        className="absolute right-0 top-0 bottom-0 pointer-events-auto"
        style={{ width: '55%', touchAction: 'none' }}
        onTouchStart={onRightTouchStart}
        onTouchMove={onRightTouchMove}
        onTouchEnd={onRightTouchEnd}
        onTouchCancel={onRightTouchEnd}
      >
        {/* Hint label */}
        <div className="absolute top-3 right-3 text-white/25 text-xs font-mono pointer-events-none select-none">
          시점
        </div>

        {/* Fire button */}
        <button
          className="absolute bottom-6 right-6 pointer-events-auto select-none flex items-center justify-center font-bold text-base rounded-full text-white"
          style={{
            width: 80,
            height: 80,
            background: 'rgba(220,38,38,0.75)',
            border: '3px solid rgba(252,165,165,0.7)',
            touchAction: 'none',
          }}
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); isMouseDownRef.current = true; }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); isMouseDownRef.current = false; }}
          onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); isMouseDownRef.current = false; }}
        >
          발사
        </button>
      </div>
    </div>
  );
}
