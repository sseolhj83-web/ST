/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Play, Shield, Swords } from 'lucide-react';

interface MainMenuProps {
  onStart: () => void;
  highScore: number;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStart, highScore }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-500/20 rounded-full"
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight 
            }}
            animate={{
              y: [null, -100],
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: Math.random() * 5 + 5,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
        >
          <h1 className="text-8xl font-display text-white mb-2 tracking-tighter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
            STAR<br/>
            <span className="text-blue-500">BRAWLER</span>
          </h1>
          <p className="text-white/40 font-medium tracking-widest uppercase mb-12">Survival Arena Shooter</p>
        </motion.div>

        <div className="flex flex-col items-center gap-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStart}
            className="group relative bg-blue-600 hover:bg-blue-500 text-white px-12 py-6 rounded-3xl font-display text-3xl shadow-[0_10px_0_rgb(37,99,235)] active:shadow-none active:translate-y-[10px] transition-all flex items-center gap-4"
          >
            <Play className="fill-white" size={32} />
            BRAWL!
          </motion.button>

          <div className="flex gap-4">
            <div className="bg-gray-800/50 backdrop-blur-md p-4 rounded-2xl border border-white/5 flex items-center gap-3">
              <Shield className="text-blue-400" size={20} />
              <div className="text-left">
                <div className="text-[10px] text-white/40 uppercase font-bold">High Score</div>
                <div className="text-xl font-display text-white">{highScore.toLocaleString()}</div>
              </div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-md p-4 rounded-2xl border border-white/5 flex items-center gap-3">
              <Swords className="text-red-400" size={20} />
              <div className="text-left">
                <div className="text-[10px] text-white/40 uppercase font-bold">Mode</div>
                <div className="text-xl font-display text-white">SURVIVAL</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
