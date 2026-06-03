/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Heart, Zap } from 'lucide-react';

interface HUDProps {
  score: { blue: number; red: number };
  health: number;
  maxHealth: number;
}

export const HUD: React.FC<HUDProps> = ({ score, health, maxHealth }) => {
  const healthPercent = Math.max(0, (health / maxHealth) * 100);

  return (
    <div className="fixed inset-0 pointer-events-none p-6 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10">
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap className="text-white fill-white" size={24} />
          </div>
          <div>
            <div className="text-xs text-white/50 font-bold uppercase tracking-wider">Health</div>
            <div className="w-48 h-3 bg-gray-800 rounded-full mt-1 overflow-hidden border border-white/5">
              <motion.div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                initial={{ width: '100%' }}
                animate={{ width: `${healthPercent}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              />
            </div>
          </div>
        </div>

        {/* Team Score */}
        <div className="flex items-center gap-6 bg-black/60 backdrop-blur-xl px-8 py-4 rounded-3xl border border-white/10 shadow-2xl">
          <div className="text-center">
            <div className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em] mb-1">Blue</div>
            <div className="text-4xl font-display text-white">{score.blue}</div>
          </div>
          <div className="text-2xl font-display text-white/20">:</div>
          <div className="text-center">
            <div className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em] mb-1">Red</div>
            <div className="text-4xl font-display text-white">{score.red}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10 opacity-0">
          {/* Placeholder for symmetry */}
        </div>
      </div>

      {/* Bottom Controls Help */}
      <div className="flex justify-center">
        <div className="bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-white/60 text-sm font-medium">
          WASD to Move • Mouse to Aim • Click to Shoot
        </div>
      </div>
    </div>
  );
};
