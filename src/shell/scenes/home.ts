import { C } from '../theme';
import { badge, button, hit, panel, rect, text } from '../draw';
import type { AppApi, Rect, Scene, TouchPhase } from '../types';

export class HomeScene implements Scene {
  constructor(private app: AppApi) {}

  private layout(): { start: Rect; settings: Rect } {
    const vp = this.app.vp;
    return {
      start: rect(40, vp.h - vp.safeBottom - 214, vp.w - 80, 62),
      settings: rect(vp.w - 78, vp.safeTop + 14, 62, 28),
    };
  }

  enter(): void {
    // banner 只在首页出现；进游戏必须 hide，否则会挡住操作区
    this.app.ad.showBanner('homeBanner');
    this.app.track('home_show', { runs: this.app.state.runs });
  }

  exit(): void {
    this.app.ad.hideBanner();
  }

  update(): void {
    /* 静态页 */
  }

  render(g: CanvasRenderingContext2D): void {
    const vp = this.app.vp;
    const { start, settings } = this.layout();

    // 背景装饰：大圆 + 斜线，纯代码不占包体
    g.strokeStyle = 'rgba(242,237,228,0.06)';
    g.lineWidth = 1;
    for (let i = -vp.h; i < vp.w; i += 28) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + vp.h, vp.h);
      g.stroke();
    }
    g.strokeStyle = 'rgba(139,212,80,0.18)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(vp.w / 2, vp.safeTop + 236, 118, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(245,192,36,0.12)';
    g.beginPath();
    g.arc(vp.w / 2, vp.safeTop + 236, 152, 0, Math.PI * 2);
    g.stroke();

    text(g, 'MINIGAME SHELL · M0', 24, vp.safeTop + 60, { size: 11, color: C.acid, mono: true });
    text(g, '点 星', 24, vp.safeTop + 124, { size: 54, weight: 800 });
    text(g, '点掉星星，20 秒看你能点多少个', 24, vp.safeTop + 154, { size: 13, color: C.dim });
    text(g, '原生 Canvas + TS · 广告壳模板', 24, vp.safeTop + 176, { size: 11, color: C.dim, mono: true });

    // 数据条
    const statsY = vp.safeTop + 212;
    panel(g, rect(24, statsY, vp.w - 48, 74), { shadow: true });
    const half = (vp.w - 48) / 2;
    text(g, '最高分', 44, statsY + 24, { size: 11, color: C.dim });
    text(g, String(this.app.state.best), 44, statsY + 56, { size: 26, weight: 800, color: C.warn });
    text(g, '金币', 44 + half, statsY + 24, { size: 11, color: C.dim });
    text(g, String(this.app.state.coins), 44 + half, statsY + 56, { size: 26, weight: 800, color: C.acid });
    g.strokeStyle = C.faint;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(24 + half + 10, statsY + 14);
    g.lineTo(24 + half + 10, statsY + 60);
    g.stroke();

    button(g, start, '开始游戏', { size: 24, note: `已玩 ${this.app.state.runs} 局` });
    text(g, '结算后会弹广告位（前 2 局不弹插屏）', vp.w / 2, start.y + start.h + 28, {
      size: 11,
      color: C.dim,
      align: 'center',
    });

    // 玩法说明：把首页中段的空白填掉，顺便告诉玩家广告在哪出现
    const stepsY = statsY + 74 + 32;
    panel(g, rect(24, stepsY, vp.w - 48, 118), { fill: C.bgDeep, shadow: false });
    const steps = [
      ['01', '点掉星星，每颗 +1 分'],
      ['02', '20 秒倒计时，时间到自动结算'],
      ['03', '结算页看视频可复活 / 双倍金币'],
    ];
    steps.forEach(([no, line], i) => {
      text(g, no, 44, stepsY + 32 + i * 30, { size: 11, color: C.warn, mono: true });
      text(g, line, 76, stepsY + 32 + i * 30, { size: 12, color: C.dim });
    });

    badge(g, 24, settings.y + 4, `AD ${this.app.adsLabel()}`);
    button(g, settings, '设置', { variant: 'ghost', size: 12 });

    text(g, `v${this.app.config.version} · minigame shell`, vp.w / 2, vp.h - vp.safeBottom - 24, {
      size: 10,
      color: 'rgba(242,237,228,0.3)',
      align: 'center',
      mono: true,
    });
  }

  onTouch(phase: TouchPhase, x: number, y: number): void {
    if (phase !== 'start') return;
    const { start, settings } = this.layout();
    if (hit(start, x, y)) {
      this.app.startRun();
      return;
    }
    if (hit(settings, x, y)) this.app.openSettings();
  }
}
