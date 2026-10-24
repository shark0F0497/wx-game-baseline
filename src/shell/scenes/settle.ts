import { C } from '../theme';
import { badge, button, hit, panel, rect, text } from '../draw';
import type { AppApi, Rect, RunResult, Scene, TouchPhase } from '../types';
import { HomeScene } from './home';

/**
 * 结算页：模板里唯一放广告的地方。
 * 顺序按 eCPM 排：复活 > 双倍奖励 > 再来一局。
 */
export class SettleScene implements Scene {
  private alive = true;
  private busy = false;
  private doubled = false;

  constructor(private app: AppApi, private result: RunResult) {}

  enter(): void {
    this.app.track('settle_show', { score: this.result.score, coins: this.result.coins, revived: this.result.revived });
    // 稍微延迟再弹插屏：让玩家先看到本局成绩，转化率和留存都更好
    setTimeout(() => {
      if (!this.alive) return;
      void this.app.ad.showInterstitial('levelEnd', this.app.state.runs);
    }, 700);
  }

  exit(): void {
    this.alive = false;
  }

  /** 按钮从底部往上堆，缺哪个就不占位（0 金币时不该留一个空洞） */
  private layout(): { back: Rect; revive: Rect | null; double: Rect | null; replay: Rect } {
    const vp = this.app.vp;
    const w = vp.w - 64;
    let y = vp.h - vp.safeBottom - 96;
    const replay = rect(32, y, w, 60);
    y -= 78;
    const showDouble = this.result.coins > 0 || this.doubled;
    const double = showDouble ? rect(32, y, w, 60) : null;
    if (showDouble) y -= 78;
    const revive = this.result.revived ? null : rect(32, y, w, 60);
    return { back: rect(24, vp.safeTop + 14, 82, 30), revive, double, replay };
  }

  update(): void {
    /* 静态页 */
  }

  render(g: CanvasRenderingContext2D): void {
    const vp = this.app.vp;
    const { back, revive, double, replay } = this.layout();
    const panelTop = vp.safeTop + 96;

    panel(g, rect(32, panelTop, vp.w - 64, 172), { fill: C.panel });
    text(g, 'SETTLEMENT', vp.w / 2, panelTop + 34, { size: 10, color: C.acid, mono: true, align: 'center' });
    text(g, '本局结束', vp.w / 2, panelTop + 62, { size: 14, color: C.dim, align: 'center' });
    text(g, String(this.result.score), vp.w / 2, panelTop + 128, { size: 62, weight: 800, align: 'center', color: C.paper });
    text(g, '得分', vp.w / 2, panelTop + 152, { size: 11, color: C.dim, align: 'center' });

    if (this.result.record) {
      // 放左上角，避免和居中的 SETTLEMENT 标签叠字
      badge(g, 44, panelTop + 12, 'NEW BEST', C.warn);
    }

    const coinsLine = `金币 +${this.result.coins}   总计 ${this.app.state.coins}`;
    text(g, coinsLine, vp.w / 2, panelTop + 200, { size: 14, color: C.acid, align: 'center', weight: 700 });
    text(g, this.result.record ? '刷新最高分' : '再来一局冲更高分', vp.w / 2, panelTop + 224, {
      size: 11,
      color: C.dim,
      align: 'center',
    });

    if (revive) {
      button(g, revive, `复活 +${this.app.config.reviveSeconds} 秒`, {
        variant: 'warn',
        size: 18,
        disabled: this.busy,
        note: '看视频 · 保留本局分数继续',
      });
    }
    // 本局 0 金币时双倍没有意义，直接不展示（避免「再得 0 金币」这种尴尬文案）
    if (double) {
      button(g, double, this.doubled ? '已领取双倍' : '双倍金币 ×2', {
        variant: 'primary',
        size: 18,
        disabled: this.busy || this.doubled,
        note: this.doubled ? '' : `看视频 · 再得 ${this.result.coins} 金币`,
      });
    }
    button(g, replay, '再来一局', { variant: 'ghost', size: 20 });
    button(g, back, '← 首页', { variant: 'ghost', size: 12 });
  }

  onTouch(phase: TouchPhase, x: number, y: number): void {
    if (phase !== 'start') return;
    const { back, revive, double, replay } = this.layout();

    if (hit(back, x, y)) {
      this.app.setScene(new HomeScene(this.app));
      return;
    }
    if (hit(replay, x, y)) {
      this.app.startRun();
      return;
    }
    if (revive && hit(revive, x, y)) {
      void this.claimRevive();
      return;
    }
    if (double && hit(double, x, y) && !this.doubled) {
      void this.claimDouble();
    }
  }

  private async claimDouble(): Promise<void> {
    if (this.busy || this.doubled) return;
    this.busy = true;
    const out = await this.app.ad.showReward('doubleCoins');
    this.busy = false;
    if (out.status === 'completed') {
      const extra = Math.max(0, this.result.coins * (this.app.config.doubleMultiplier - 1));
      this.app.addCoins(extra);
      this.doubled = true;
      this.app.track('reward_claim', { slot: 'doubleCoins', value: extra });
      this.app.toast(`+${extra} 金币`);
      return;
    }
    this.app.toast(this.reasonText(out));
  }

  private async claimRevive(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const out = await this.app.ad.showReward('revive');
    this.busy = false;
    if (out.status === 'completed') {
      this.app.track('reward_claim', { slot: 'revive', score: this.result.score });
      this.app.reviveRun(this.result.score);
      return;
    }
    this.app.toast(this.reasonText(out));
  }

  private reasonText(out: { status: string; reason?: string }): string {
    if (out.status === 'blocked') {
      if (out.reason === 'cooldown') return '稍等几秒再试';
      if (out.reason === 'daily-limit') return '今天的次数用完了';
      if (out.reason === 'skip-first-n') return '再玩几局吧';
      return '暂时不可用';
    }
    if (out.status === 'unavailable') return '广告暂不可用';
    return '看完视频才能领奖哦';
  }
}
