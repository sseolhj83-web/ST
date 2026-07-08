/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Player3D, FragLog, Weapon } from '../game/xonoticTypes';
import { Shield, Heart } from 'lucide-react';

interface XonoticHUDProps {
  player: Player3D;
  fragFeed: FragLog[];
  matchTime: number;
  activeKeys?: { w: boolean; a: boolean; s: boolean; d: boolean; space: boolean };
  isFrozen?: boolean;
  monsterWarning?: boolean;
}

export const XonoticHUD: React.FC<XonoticHUDProps> = ({
  player,
  fragFeed,
  matchTime,
  activeKeys,
  isFrozen,
  monsterWarning,
}) => {
  const [showFrozenBanner, setShowFrozenBanner] = useState(false);

  useEffect(() => {
    if (isFrozen) {
      setShowFrozenBanner(true);
      const timer = setTimeout(() => {
        setShowFrozenBanner(false);
      }, 7000);
      return () => clearTimeout(timer);
    } else {
      setShowFrozenBanner(false);
    }
  }, [isFrozen]);

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

        {/* Center: Match clock */}
        <div className="text-center font-mono pointer-events-auto flex flex-col gap-2">
          <div className="bg-slate-900/80 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">남은 시간</span>
            <span className="text-2xl font-black text-rose-500 glow-rose">{formatTime(matchTime)}</span>
          </div>
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
                {frag.weapon === 'vaporizer' ? '증발시킴 ⚡' : frag.weapon === 'rocket' ? '폭사시킴 💥' : '처치함 💀'}
              </span>
              <span className={frag.victim === 'You' ? 'text-red-400 font-bold' : 'text-slate-200'}>
                {frag.victim === 'You' ? '플레이어' : frag.victim}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. MIDDLE VIEW SPACE WITH ELGENT TIME FREEZE NOTIFICATION */}
      <div className="flex-1 flex items-center justify-center">
        {showFrozenBanner && (
          <div className="bg-purple-950/80 backdrop-blur-md border border-purple-500/50 rounded-2xl px-12 py-5 text-center shadow-[0_0_50px_rgba(139,92,246,0.3)] animate-pulse max-w-sm pointer-events-auto">
            <h2 className="text-xl font-black text-purple-300 tracking-wider font-sans uppercase mb-1">
              ⚡ 시간 일시정지 (Time Frozen)
            </h2>
            <p className="text-xs text-purple-200/80">
              다른 모든 적들과 발사체가 정지했습니다.<br />플레이어는 자유롭게 이동 및 처치가 가능합니다.
            </p>
            <p className="text-[10px] text-purple-400 font-bold uppercase mt-2.5 tracking-widest">
              F키를 누르면 시간 정지 해제
            </p>
          </div>
        )}
      </div>

      {/* 3. BOTTOM PANEL STATS (HEALTH, WEAPONS, SHIELD) */}
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

        {/* Right Bottom corner: Futuristic Weapon Grid & Ammo counters */}
        <div className="flex gap-2 bg-slate-900/85 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 shadow-3xl pointer-events-auto">
          {(Object.values(player.weapons) as Weapon[]).map((w, index) => {
            const isActive = player.currentWeapon === w.type;
            const keyNum = index + 1;

            return (
              <div
                key={w.type}
                className={`relative px-4 py-3 rounded-xl border flex flex-col items-center justify-center min-w-[70px] select-none cursor-pointer transition-all ${
                  isActive
                    ? 'border-cyan-500/40 bg-cyan-500/15 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                    : 'border-white/5 hover:border-white/10 hover:bg-white/5'
                }`}
              >
                {/* Weapon index overlay */}
                <span className="absolute top-1 left-1.5 text-[9px] font-mono text-white/40 block font-bold">
                  {keyNum}
                </span>

                <span className={`text-[11px] font-bold uppercase font-sans tracking-wide block ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {w.name}
                </span>

                {/* Ammo numbers */}
                <div className="flex items-baseline gap-0.5 mt-1">
                  <span className={`font-mono text-lg font-bold leading-none ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}>
                    {w.ammo === Infinity ? '∞' : w.ammo}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
