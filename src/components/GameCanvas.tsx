/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { GameState } from '../game/types';

interface GameCanvasProps {
  state: GameState;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ state, onCanvasReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Constants mapping to GameEngine values
  const marginX = 80;
  const marginY = 80;
  const goalWidth = 200;

  useEffect(() => {
    if (canvasRef.current) {
      onCanvasReady(canvasRef.current);
    }
  }, [onCanvasReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Outer Stadium Surround (Outside of Pitch)
    ctx.fillStyle = '#1e293b'; // slate-800
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Pitch Grass (Within margins)
    ctx.fillStyle = '#15803d'; // green-700
    ctx.fillRect(marginX, marginY, canvas.width - marginX * 2, canvas.height - marginY * 2);

    // Draw Striped Grass pattern
    ctx.fillStyle = '#166534'; // green-800
    const stripeWidth = 60;
    for (let x = marginX; x < canvas.width - marginX; x += stripeWidth * 2) {
      ctx.fillRect(x, marginY, stripeWidth, canvas.height - marginY * 2);
    }

    // Centered Goal coordinate
    const goalX = (canvas.width - goalWidth) / 2;

    // 3. Draw Pitch Markings (White Lines)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;

    // Pitch Boundary Line
    ctx.beginPath();
    ctx.moveTo(marginX, marginY);
    ctx.lineTo(goalX, marginY);
    ctx.moveTo(goalX + goalWidth, marginY);
    ctx.lineTo(canvas.width - marginX, marginY);
    ctx.lineTo(canvas.width - marginX, canvas.height - marginY);
    ctx.lineTo(goalX + goalWidth, canvas.height - marginY);
    ctx.moveTo(goalX, canvas.height - marginY);
    ctx.lineTo(marginX, canvas.height - marginY);
    ctx.closePath();
    ctx.stroke();

    // Side Boundary Lines
    ctx.beginPath();
    ctx.moveTo(marginX, marginY);
    ctx.lineTo(marginX, canvas.height - marginY);
    ctx.moveTo(canvas.width - marginX, marginY);
    ctx.lineTo(canvas.width - marginX, canvas.height - marginY);
    ctx.stroke();

    // Center Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(marginX, canvas.height / 2);
    ctx.lineTo(canvas.width - marginX, canvas.height / 2);
    ctx.stroke();

    // Center Circle
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 100, 0, Math.PI * 2);
    ctx.stroke();

    // Penalty Arc / Area - TOP Goal
    ctx.beginPath();
    ctx.arc(canvas.width / 2, marginY, 120, 0, Math.PI);
    ctx.stroke();

    // Penalty Arc / Area - BOTTOM Goal
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height - marginY, 120, Math.PI, 0);
    ctx.stroke();

    // 4. DRAW GORGEOUS GOALS WITH NETS & POSTS
    // --- TOP GOAL (Enemy Goal - Red) ---
    // Net Fill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(goalX, marginY - 40, goalWidth, 40);

    // Net Pattern Group
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; // red-500
    ctx.lineWidth = 2;
    // Draw net checker grid
    for (let offset = 0; offset <= goalWidth; offset += 15) {
      ctx.beginPath();
      ctx.moveTo(goalX + offset, marginY);
      ctx.lineTo(goalX + offset, marginY - 40);
      ctx.stroke();
    }
    for (let offset = 0; offset <= 40; offset += 10) {
      ctx.beginPath();
      ctx.moveTo(goalX, marginY - offset);
      ctx.lineTo(goalX + goalWidth, marginY - offset);
      ctx.stroke();
    }

    // Goal Post Structures
    ctx.strokeStyle = '#ef4444'; // red goal frame
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(goalX, marginY);
    ctx.lineTo(goalX, marginY - 40);
    ctx.lineTo(goalX + goalWidth, marginY - 40);
    ctx.lineTo(goalX + goalWidth, marginY);
    ctx.stroke();

    // Thick physical 3D post indicators
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(goalX, marginY, 6, 0, Math.PI * 2);
    ctx.arc(goalX + goalWidth, marginY, 6, 0, Math.PI * 2);
    ctx.fill();

    // --- BOTTOM GOAL (Blue Player Goal - Blue) ---
    // Net Fill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(goalX, canvas.height - marginY, goalWidth, 40);

    // Net Grid
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'; // blue-500
    for (let offset = 0; offset <= goalWidth; offset += 15) {
      ctx.beginPath();
      ctx.moveTo(goalX + offset, canvas.height - marginY);
      ctx.lineTo(goalX + offset, canvas.height - marginY + 40);
      ctx.stroke();
    }
    for (let offset = 0; offset <= 40; offset += 10) {
      ctx.beginPath();
      ctx.moveTo(goalX, canvas.height - marginY + offset);
      ctx.lineTo(goalX + goalWidth, canvas.height - marginY + offset);
      ctx.stroke();
    }

    // Goal Post Structure
    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(goalX, canvas.height - marginY);
    ctx.lineTo(goalX, canvas.height - marginY + 40);
    ctx.lineTo(goalX + goalWidth, canvas.height - marginY + 40);
    ctx.lineTo(goalX + goalWidth, canvas.height - marginY);
    ctx.stroke();

    // Thick Blue goal post circles
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(goalX, canvas.height - marginY, 6, 0, Math.PI * 2);
    ctx.arc(goalX + goalWidth, canvas.height - marginY, 6, 0, Math.PI * 2);
    ctx.fill();

    // 5. DRAW ON-FIELD TEXT INSTRUCTIONS (VERY LARGE AND CLEAR)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Top Goal Label
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.fillText('🔴 ENEMY GOAL (적 골대)', canvas.width / 2, marginY + 30);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('공을 여기에 넣으세요! (SHOOT THE BALL HERE!)', canvas.width / 2, marginY + 55);

    // Bottom Goal Label
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.fillText('🔵 YOUR GOAL (우리 골대)', canvas.width / 2, canvas.height - marginY - 45);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('여기를 방어하세요! (DEFEND THIS ZONE!)', canvas.width / 2, canvas.height - marginY - 20);
    
    ctx.restore();

    // 6. Draw Obstacles (Walls)
    state.obstacles.forEach(obs => {
      if (obs.type === 'wall') {
        // Wooden/brawl-crate style shadow block
        ctx.fillStyle = '#78350f'; // amber-900 (wood base)
        ctx.fillRect(obs.pos.x, obs.pos.y, obs.width, obs.height);

        // Highlight top border
        ctx.fillStyle = '#b45309'; // amber-700
        ctx.fillRect(obs.pos.x, obs.pos.y, obs.width, 6);

        // Grid boundaries
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.pos.x, obs.pos.y, obs.width, obs.height);
      }
    });

    // 7. Draw Ball with Shadow
    const { ball } = state;
    // Ball Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(ball.pos.x + 4, ball.pos.y + 4, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Soccer Ball Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Distinct soccer pentagon textures
    ctx.fillStyle = '#1e293b'; // slate-900 pentagons
    ctx.beginPath();
    ctx.arc(ball.pos.x, ball.pos.y, ball.radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ball.pos.x - ball.radius, ball.pos.y);
    ctx.lineTo(ball.pos.x + ball.radius, ball.pos.y);
    ctx.moveTo(ball.pos.x, ball.pos.y - ball.radius);
    ctx.lineTo(ball.pos.x, ball.pos.y + ball.radius);
    ctx.stroke();

    // 8. Draw Particles
    state.particles.forEach(p => {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // 9. Draw Bullets
    state.bullets.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 12;
      ctx.shadowColor = b.color;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // 10. Draw Enemies
    state.enemies.forEach(e => {
      // Body Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(e.pos.x + 3, e.pos.y + 3, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // Enemy core
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#450a0a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Shooter details
      if (e.type === 'shooter') {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(e.pos.x - 12, e.pos.y + 8, 24, 6);
        // Yellow headband to identify shooters
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(e.pos.x - e.radius + 3, e.pos.y - 10, e.radius * 2 - 6, 5);
      }

      // Health Bar
      const barWidth = e.radius * 2;
      const barHeight = 4;
      ctx.fillStyle = '#374151';
      ctx.fillRect(e.pos.x - e.radius, e.pos.y - e.radius - 10, barWidth, barHeight);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(e.pos.x - e.radius, e.pos.y - e.radius - 10, barWidth * (e.health / e.maxHealth), barHeight);
    });

    // 11. Draw Player with Shadow & Facing Angle
    const { player } = state;
    // Player Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(player.pos.x + 3, player.pos.y + 3, player.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(player.pos.x, player.pos.y);
    ctx.rotate(player.angle);

    // Aim guide / direction indicator
    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(60, -12);
    ctx.lineTo(60, 12);
    ctx.closePath();
    ctx.fill();

    // Inner aim arrow
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(40, 0);
    ctx.lineTo(32, -6);
    ctx.moveTo(40, 0);
    ctx.lineTo(32, 6);
    ctx.stroke();

    // Player body
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    
    // Glowing crown/hair highlight to notice player
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    // Big Eyes facing aim direction
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(8, -6, 5, 0, Math.PI * 2);
    ctx.arc(8, 6, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(10, -6, 2.5, 0, Math.PI * 2);
    ctx.arc(10, 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();

    // 12. Player Health Bar
    const pBarWidth = player.radius * 3;
    const pBarHeight = 6;
    ctx.fillStyle = '#374151';
    ctx.fillRect(player.pos.x - pBarWidth/2, player.pos.y - player.radius - 20, pBarWidth, pBarHeight);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(player.pos.x - pBarWidth/2, player.pos.y - player.radius - 20, pBarWidth * (player.health / player.maxHealth), pBarHeight);

    // 13. Draw Bushes (Overlay - players and enemies are slightly visible under)
    state.obstacles.forEach(obs => {
      if (obs.type === 'bush') {
        ctx.fillStyle = 'rgba(21, 128, 61, 0.75)'; // green-700 semi-transparent
        ctx.beginPath();
        ctx.roundRect(obs.pos.x, obs.pos.y, obs.width, obs.height, 12);
        ctx.fill();
        
        // Detailed crosshatch texture for the bushes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(obs.pos.x + 6, obs.pos.y + 6, obs.width - 12, obs.height - 12);
        ctx.beginPath();
        ctx.moveTo(obs.pos.x, obs.pos.y);
        ctx.lineTo(obs.pos.x + obs.width, obs.pos.y + obs.height);
        ctx.moveTo(obs.pos.x + obs.width, obs.pos.y);
        ctx.lineTo(obs.pos.x, obs.pos.y + obs.height);
        ctx.stroke();
      }
    });

  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      className="bg-slate-900"
    />
  );
};
