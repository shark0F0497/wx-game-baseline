import { openPrivacyContract } from '../../core/privacy';
import { C } from '../theme';
import { button, hit, panel, rect, scrim, text } from '../draw';
import type { AppApi, Rect, Scene, TouchPhase } from '../types';

type RowKey = 'sound' | 'haptics' | 'privacy' | 'clear';

interface Row {
  key: RowKey;
  r: Rect;
}

/** 设置层：画在当前场景之上，不销毁底层场景 */
export class SettingsScene implements Scene {
  private confirmClear = false;

  constructor(private app: AppApi) {}

  private layout(): { panel: Rect; close: Rect; rows: Row[] } {
    const vp = this.app.vp;
    const slots = this.app.ad.describe().length;
    const keys: RowKey[] = ['sound', 'haptics', 'privacy', 'clear'];
    const h = 96 + keys.length * 52 + slots * 20 + 76;
    const w = vp.w - 48;
    const y = Math.max(vp.safeTop + 30, (vp.h - h) / 2);
    const p = rect(24, y, w, h);
    const rows: Row[] = keys.map((key, i) => ({
      key,
      r: rect(p.x + 12, p.y + 88 + i * 52, p.w - 24, 48),
    }));
    return { panel: p, close: rect(p.x + 24, p.y + h - 60, p.w - 48, 44), rows };
  }

  update(): void {
    /* 静态层 */
  }

  render(g: CanvasRenderingContext2D): void {
    const vp = this.app.vp;
    const { panel: p, close, rows } = this.layout();
    scrim(g, vp.w, vp.h, 0.78);
    panel(g, p, { fill: C.panel });

    text(g, '设置', p.x + 24, p.y + 42, { size: 26, weight: 800 });
    text(g, 'SETTINGS', p.x + 24, p.y + 62, { size: 10, color: C.acid, mono: true });

    const onOff = (on: boolean): [string, string] => [on ? '开' : '关', on ? C.acid : C.dim];
    const value = (row: Row): [string, string] => {
      if (row.key === 'sound') return onOff(this.app.state.sound);
      if (row.key === 'haptics') return onOff(this.app.state.haptics);
      if (row.key === 'privacy') return ['查看 →', C.paper];
      return [this.confirmClear ? '再点一次确认' : '清除', this.confirmClear ? C.orange : C.dim];
    };
    const label: Record<RowKey, string> = {
      sound: '音效',
      haptics: '震动反馈',
      privacy: '用户隐私保护指引',
      clear: '清空本地进度',
    };

    for (const row of rows) {
      const [v, color] = value(row);
      text(g, label[row.key], row.r.x + 12, row.r.y + 20, { size: 14 });
      text(g, v, row.r.x + row.r.w - 12, row.r.y + 20, { size: 13, color, align: 'right' });
      g.strokeStyle = C.faint;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(row.r.x, row.r.y + 40);
      g.lineTo(row.r.x + row.r.w, row.r.y + 40);
      g.stroke();
    }

    let y = p.y + 88 + rows.length * 52 + 16;
    text(g, 'AD SLOTS', p.x + 24, y, { size: 10, color: C.dim, mono: true });
    y += 20;
    for (const s of this.app.ad.describe()) {
      text(g, `${s.slot} · ${s.kind}`, p.x + 24, y, { size: 11, color: C.paper, mono: true });
      text(g, `${s.live ? 'LIVE' : 'MOCK'}${s.left >= 0 ? ` · 剩 ${s.left}` : ''}`, p.x + p.w - 24, y, {
        size: 11,
        align: 'right',
        mono: true,
        color: s.live ? C.acid : C.warn,
      });
      y += 20;
    }

    button(g, close, '关闭', { variant: 'ghost', size: 16 });
  }

  onTouch(phase: TouchPhase, x: number, y: number): void {
    if (phase !== 'start') return;
    const { close, rows } = this.layout();
    if (hit(close, x, y)) {
      this.app.closeOverlay();
      return;
    }
    for (const row of rows) {
      if (!hit(row.r, x, y)) continue;
      if (row.key === 'sound') {
        const on = !this.app.state.sound;
        this.app.setSound(on);
        this.app.toast(on ? '音效已开启' : '音效已关闭');
      } else if (row.key === 'haptics') {
        this.app.state.haptics = !this.app.state.haptics;
        this.app.saveState();
        this.app.toast(this.app.state.haptics ? '震动已开启' : '震动已关闭');
      } else if (row.key === 'privacy') {
        openPrivacyContract();
      } else if (row.key === 'clear') {
        if (!this.confirmClear) {
          this.confirmClear = true;
          this.app.toast('再点一次确认清空');
        } else {
          this.app.state.coins = 0;
          this.app.state.best = 0;
          this.app.state.runs = 0;
          this.app.saveState();
          this.confirmClear = false;
          this.app.toast('本地进度已清空');
        }
      }
      return;
    }
  }
}
