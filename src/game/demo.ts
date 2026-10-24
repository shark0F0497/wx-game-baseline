import { C } from '../shell/theme';
import type { GameCtx, GameModule, GameStats } from './types';

/**
 * M0 示例玩法「点星」：20 秒内点爆星星。
 * 它唯一的作用是证明「壳 + 广告 + 结算」闭环能跑通，正式项目直接换掉这个文件。
 */

interface Star {
  x: number;
  y: number;
  r: number;
  age: number;
  life: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
}

const COLORS = [C.acid, C.warn, '#965fd4'];

export function createDemoGame(ctx: GameCtx): GameModule {
  const stars: Star[] = [];
  const particles: Particle[] = [];
  const top = ctx.safeTop + 104;
  const bottom = ctx.h - 96;
  let score = 0;
  let hits = 0;

  const spawn = (): void => {
    const r = 24 + Math.random() * 10;
    stars.push({
      x: r + Math.random() * (ctx.w - r * 2),
      y: top + r + Math.random() * (bottom - top - r * 2),
      r,
      age: 0,
      life: 3.2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
  };

  const burst = (x: number, y: number, color: string): void => {
    for (let i = 0; i < 10; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        age: 0,
        life: 0.45,
        color,
      });
    }
  };

  return {
    start(): void {
      stars.length = 0;
      for (let i = 0; i < 3; i += 1) spawn();
    },

    update(dt: number): void {
      for (let i = stars.length - 1; i >= 0; i -= 1) {
        const s = stars[i];
        s.age += dt;
        if (s.age >= s.life) {
          stars.splice(i, 1);
          spawn();
        }
      }
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 320 * dt;
        if (p.age >= p.life) particles.splice(i, 1);
      }
      while (stars.length < 3) spawn();
    },

    render(g: CanvasRenderingContext2D): void {
      // 淡淡的网格，避免纯色背景太空
      g.strokeStyle = 'rgba(242,237,228,0.055)';
      g.lineWidth = 1;
      for (let x = 0; x < ctx.w; x += 40) {
        g.beginPath();
        g.moveTo(x + 0.5, top - 40);
        g.lineTo(x + 0.5, bottom + 20);
        g.stroke();
      }
      for (let y = top - 40; y < bottom + 20; y += 40) {
        g.beginPath();
        g.moveTo(0, y + 0.5);
        g.lineTo(ctx.w, y + 0.5);
        g.stroke();
      }

      for (const s of stars) {
        const fade = Math.min(1, (s.life - s.age) / 0.4);
        const pulse = 1 + Math.sin(s.age * 6) * 0.06;
        g.globalAlpha = Math.max(0, fade);
        g.strokeStyle = s.color;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(s.x, s.y, s.r * pulse, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = s.color;
        g.beginPath();
        g.arc(s.x, s.y, s.r * 0.32, 0, Math.PI * 2);
        g.fill();
        // 剩余寿命：外圈缺口
        g.strokeStyle = 'rgba(242,237,228,0.5)';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(s.x, s.y, s.r + 6, -Math.PI / 2, -Math.PI / 2 + (1 - s.age / s.life) * Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;

      for (const p of particles) {
        const k = 1 - p.age / p.life;
        g.globalAlpha = Math.max(0, k);
        g.fillStyle = p.color;
        g.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      g.globalAlpha = 1;
    },

    onDown(x: number, y: number): boolean {
      for (let i = stars.length - 1; i >= 0; i -= 1) {
        const s = stars[i];
        const dx = x - s.x;
        const dy = y - s.y;
        if (dx * dx + dy * dy <= (s.r + 10) * (s.r + 10)) {
          burst(s.x, s.y, s.color);
          stars.splice(i, 1);
          spawn();
          score += 1;
          hits += 1;
          return true;
        }
      }
      return false;
    },

    stats(): GameStats {
      return { score, combo: hits };
    },

    destroy(): void {
      stars.length = 0;
      particles.length = 0;
    },
  };
}
