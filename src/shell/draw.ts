import { C, font, mono } from './theme';
import type { Rect } from './types';

type G = CanvasRenderingContext2D;

export function clear(g: G, w: number, h: number, color = C.bg): void {
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
}

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

export function hit(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export interface TextOpts {
  size?: number;
  color?: string;
  weight?: number | string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  mono?: boolean;
  letterSpacing?: number;
}

export function text(g: G, value: string, x: number, y: number, o: TextOpts = {}): void {
  g.font = o.mono ? mono(o.size ?? 14, o.weight ?? 700) : font(o.size ?? 16, o.weight ?? 400);
  g.fillStyle = o.color ?? C.paper;
  g.textAlign = o.align ?? 'left';
  g.textBaseline = o.baseline ?? 'alphabetic';
  g.fillText(value, x, y);
}

/** 硬边面板：黑色实心投影 + 2px 描边，跟笔记库同一套语言 */
export function panel(g: G, r: Rect, o: { fill?: string; stroke?: string; shadow?: boolean } = {}): void {
  const fill = o.fill ?? C.panel;
  const stroke = o.stroke ?? C.paper;
  if (o.shadow !== false) {
    g.fillStyle = C.black;
    g.fillRect(r.x + 5, r.y + 5, r.w, r.h);
  }
  g.fillStyle = fill;
  g.fillRect(r.x, r.y, r.w, r.h);
  if (stroke !== 'none') {
    g.strokeStyle = stroke;
    g.lineWidth = 2;
    g.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  }
}

export type ButtonVariant = 'primary' | 'warn' | 'ghost';

export interface ButtonOpts {
  variant?: ButtonVariant;
  disabled?: boolean;
  size?: number;
  note?: string;
}

const VARIANTS: Record<ButtonVariant, { fill: string; text: string; stroke: string }> = {
  primary: { fill: C.acid, text: C.ink, stroke: C.ink },
  warn: { fill: C.warn, text: C.ink, stroke: C.ink },
  ghost: { fill: C.bgDeep, text: C.paper, stroke: C.paper },
};

export function button(g: G, r: Rect, label: string, o: ButtonOpts = {}): void {
  const v = VARIANTS[o.variant ?? 'primary'];
  const disabled = !!o.disabled;
  const fill = disabled ? '#2b2740' : v.fill;
  const stroke = disabled ? C.faint : v.stroke;
  const color = disabled ? 'rgba(242,237,228,0.38)' : v.text;

  if (!disabled) {
    g.fillStyle = C.black;
    g.fillRect(r.x + 4, r.y + 4, r.w, r.h);
  }
  g.fillStyle = fill;
  g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeStyle = stroke;
  g.lineWidth = 2;
  g.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);

  const size = o.size ?? 20;
  const cy = o.note ? r.y + r.h / 2 - 7 : r.y + r.h / 2;
  text(g, label, r.x + r.w / 2, cy, { size, color, weight: 700, align: 'center', baseline: 'middle' });
  if (o.note) {
    text(g, o.note, r.x + r.w / 2, r.y + r.h / 2 + 15, { size: 11, color, align: 'center', baseline: 'middle' });
  }
}

/** 顶部小标签，用于 AD: MOCK 这类状态角标 */
export function badge(g: G, x: number, y: number, label: string, color = C.warn): number {
  g.font = mono(11, 700);
  const w = g.measureText(label).width + 16;
  g.fillStyle = color;
  g.fillRect(x, y, w, 20);
  text(g, label, x + 8, y + 10, { size: 11, color: C.ink, mono: true, baseline: 'middle' });
  return w;
}

export function bar(g: G, r: Rect, ratio: number, color = C.acid): void {
  g.fillStyle = 'rgba(11,10,18,0.7)';
  g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = color;
  g.fillRect(r.x, r.y, Math.max(0, Math.min(1, ratio)) * r.w, r.h);
  g.strokeStyle = C.faint;
  g.lineWidth = 1;
  g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
}

export function scrim(g: G, w: number, h: number, alpha = 0.72): void {
  g.fillStyle = `rgba(11, 10, 18, ${alpha})`;
  g.fillRect(0, 0, w, h);
}

/** 输入提示（点一下 / 手指），简单圆圈 + 圆环，够 M0 用 */
export function tapHint(g: G, x: number, y: number, r = 14): void {
  g.strokeStyle = C.dim;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(x, y, r * 0.35, 0, Math.PI * 2);
  g.fillStyle = C.dim;
  g.fill();
}
