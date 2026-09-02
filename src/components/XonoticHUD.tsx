/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Player3D, FragLog } from '../game/xonoticTypes';
import { Shield, Heart } from 'lucide-react';

interface XonoticHUDProps {
  player: Player3D;
  fragFeed: FragLog[];
  matchTime: number;
  level?: 1 | 2;
  exitPos?: { x: number; y: number; z: number } | null;
  activeKeys?: { w: boolean; a: boolean; s: boolean; d: boolean; space: boolean };
  monsterWarning?: boolean;
}

export const XonoticHUD: React.FC<XonoticHUDProps> = ({
  player,
  fragFeed,
  matchTime,
  level = 1,
  exitPos,
  activeKeys,
  monsterWarning,
}) => {
  // Exit compass — in Level 2's endless identical grid you need a heading. Arrow rotates so "up" =
  // straight ahead. Forward = (sin yaw, -cos yaw); right = (cos yaw, sin yaw) — matches the engine.
  let exitBearing: number | null = null;
  let exitDist = 0;
  if (exitPos) {
    const dx = exitPos.x - player.pos.x;
    const dz = exitPos.z - player.pos.z;
    exitDist = Math.sqrt(dx * dx + dz * dz);
    if (exitDist > 0.001) {
      const fwd = (dx * Math.sin(player.yaw) + dz * -Math.cos(player.yaw)) / exitDist;
      const rgt = (dx * Math.cos(player.yaw) + dz * Math.sin(player.yaw)) / exitDist;
      exitBearing = Math.atan2(rgt, fwd); // 0 = dead ahead, +right
    }
  }
  // Translate seconds to format mm:ss (countdown from 7 minutes)
  const formatTime = (seconds: number) => {
    const remaining = Math.max(0, 420 - seconds);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Speedometer maths (length of x & z velocity vector, scaled for high numbers!)
  const speed = Math.round(Math.sqrt(player.vel.x * player.vel.x + player.vel.z * player.vel.z) * 35);

  return (
    <div className="absolute inset-0 pointer-events-none z-40 flex flex-col justify-between p-6 select-none font-sans">

      {/* The monster is close — this is the only warning the player gets */}
      {!!monsterWarning && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
          <span className="text-4xl font-black text-red-600 tracking-[0.3em] uppercase animate-pulse drop-shadow-[0_0_18px_rgba(220,38,38,0.9)]">
            경고
          </span>
        </div>
      )}

      {/* 1. TOP STATS (TIME AND KILLFEED) */}
      <div className="w-full flex items-start justify-between">
        
        {/* Left Side: Score Rankings (Removed as requested) */}
        <div className="w-60" />

        {/* Center: Match clock + (Level 2) exit compass */}
        <div className="text-center font-mono pointer-events-auto flex flex-col gap-2 items-center">
          <div className="bg-slate-900/80 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              남은 시간 · {level === 2 ? 'LV.2 호텔' : 'LV.1 미로'}
            </span>
            <span className="text-2xl font-black text-rose-500 glow-rose">{formatTime(matchTime)}</span>
          </div>

          {exitBearing !== null && (
            <div className="bg-emerald-950/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-emerald-500/40 shadow-2xl flex items-center gap-3">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                  style={{ transform: `rotate(${exitBearing}rad)` }}
                >
                  <path d="M12 2 L19 20 L12 15 L5 20 Z" fill="currentColor" />
                </svg>
              </div>
              <div className="text-left leading-tight">
                <span className="block text-[9px] text-emerald-500/80 font-bold uppercase tracking-wider">출구</span>
                <span className="block text-sm font-black text-emerald-300">
                  {exitDist < 3 ? '바로 앞!' : `${Math.round(exitDist)}m`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Kill Frag Feed Actions logs */}
        <div className="flex flex-col gap-2 w-72 text-right">
          {fragFeed.slice(-4).map(frag => (
            <div
              key={frag.id}
              className="bg-black/70 backdrop-blur-sm border border-red-500/20 rounded-xl px-4 py-2 text-xs flex items-center justify-between shadow-lg text-white font-mono animate-slide-left"
            >
              <span className={frag.killer === 'You' ? 'text-cyan-400 font-bold' : 'text-slate-200'}>
                {frag.killer === 'You' ? '플레이어' : frag.killer}
              </span>
              <span className="text-rose-400 text-[10px] font-bold uppercase bg-rose-500/10 px-1.5 py-0.5 rounded mx-2 border border-rose-500/25">
                처치함 💀
              </span>
              <span className={frag.victim === 'You' ? 'text-red-400 font-bold' : 'text-slate-200'}>
                {frag.victim === 'You' ? '플레이어' : frag.victim}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. BOTTOM PANEL STATS (HEALTH, SHIELD) */}
      <div className="w-full flex items-end justify-between">
        
        {/* Left Bottom corner: HP / Armour values */}
        <div className="flex gap-4">
          
          {/* Health Gauge Box */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-4 w-40 flex items-center gap-3 shadow-2xl relative overflow-hidden pointer-events-auto">
            <div className="absolute top-0 left-0 bottom-0 bg-emerald-500/5 transition-all duration-200" style={{ width: `${(player.health / player.maxHealth) * 100}%` }} />
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Heart className="w-6 h-6 fill-current" />
            </div>
            <div>
              <span className="text-[10px] text-emerald-400/80 font-bold tracking-wider uppercase block">체력 (Health)</span>
              <span className="text-3xl font-black text-white font-mono tracking-tight">{Math.round(player.health)}</span>
            </div>
          </div>

          {/* Armor / Shield Guage Box */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-blue-500/20 rounded-2xl p-4 w-40 flex items-center gap-3 shadow-2xl relative overflow-hidden pointer-events-auto">
            <div className="absolute top-0 left-0 bottom-0 bg-blue-500/5 transition-all duration-200" style={{ width: `${(player.armor / player.maxArmor) * 100}%` }} />
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Shield className="w-6 h-6 fill-current" />
            </div>
            <div>
              <span className="text-[10px] text-blue-400/80 font-bold tracking-wider uppercase block">보호막 (Shield)</span>
              <span className="text-3xl font-black text-white font-mono tracking-tight">{Math.round(player.armor)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
