/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';

interface JoystickProps {
  onMove: (angle: number | null, force: number) => void;
}

export const Joystick: React.FC<JoystickProps> = ({ onMove }) => {
  const [active, setActive] = useState(false);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleSize = 35; // px radius
  const maxLimit = 60; // px max distance

  const processDrag = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      setStickPos({ x: 0, y: 0 });
      onMove(null, 0);
      return;
    }

    const angle = Math.atan2(dy, dx);
    const cappedDistance = Math.min(distance, maxLimit);
    const force = cappedDistance / maxLimit;

    const stickX = Math.cos(angle) * cappedDistance;
    const stickY = Math.sin(angle) * cappedDistance;

    setStickPos({ x: stickX, y: stickY });
    onMove(angle, force);
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setActive(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    processDrag(clientX, clientY);
  };

  useEffect(() => {
    if (!active) return;

    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      processDrag(clientX, clientY);
    };

    const handleGlobalEnd = () => {
      setActive(false);
      setStickPos({ x: 0, y: 0 });
      onMove(null, 0);
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchmove', handleGlobalMove, { passive: false });
    window.addEventListener('touchend', handleGlobalEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [active, onMove]);

  return (
    <div className="fixed bottom-12 left-12 z-50 pointer-events-auto flex flex-col items-center">
      {/* Label guide */}
      <span className="text-[10px] text-white/50 tracking-wider font-bold mb-2 uppercase select-none">
        DRAG TO MOVE (드래그하여 이동)
      </span>
      <div
        ref={containerRef}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        className="w-32 h-32 bg-black/60 backdrop-blur-md rounded-full border-4 border-white/20 shadow-2xl flex items-center justify-center cursor-grab active:cursor-grabbing hover:border-white/40 transition-colors"
      >
        <div
          className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-2 border-white/40 shadow-lg flex items-center justify-center transition-transform duration-75"
          style={{
            transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
          }}
        >
          {/* Inner groove design */}
          <div className="w-6 h-6 bg-blue-700/50 rounded-full border border-white/20"></div>
        </div>
      </div>
    </div>
  );
};
