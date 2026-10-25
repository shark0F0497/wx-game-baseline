import { createDemoGame } from '../../game/demo';
import type { GameModule } from '../../game/types';
import { C } from '../theme';
import { bar, rect, text } from '../draw';
import { haptic } from '../../core/platform';
import type { AppApi, Scene, TouchPhase } from '../types';

/**
 * 游戏中：计时、HUD、把点击转发给玩法模块。
 * 这里不含任何广告逻辑 —— 广告只在结算页出现，玩法层完全不知道广告存在。
 */
export class PlayScene implements Scene {
  private game: GameModule;
  private timeLeft: number;
  private readonly total: number;
  private readonly startScore: number;
  private readonly revived: boolean;
  private ended = false;

  constructor(private app: AppApi, opts: { revive?: boolean; score?: number } = {}) {
    this.revived = !!opts.revive;
    this.startScore = opts.score ?? 0;
    // 复活只买 8 秒，不能把整局时长再加一遍（否则复活一次 = 白送 28 秒）
    this.total = this.revived ? app.config.reviveSeconds : app.config.roundSeconds;
    this.timeLeft = this.total;
    this.game = createDemoGame({ w: app.vp.w, h: app.vp.h, safeTop: app.vp.safeTop });
    this.game.start();
  }

  enter(): void {
    this.app.track('play_enter', { revived: this.revived, startScore: this.startScore });
  }

  exit(): void {
    this.game.destroy();
  }

  update(dt: number): void {
    if (this.ended) return;
    this.game.update(dt);
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) this.finish();
  }

  render(g: CanvasRenderingContext2D): void {
    const vp = this.app.vp;
    this.game.render(g);

    text(g, '得分', vp.w / 2, vp.safeTop + 34, { size: 11, color: C.dim, align: 'center' });
    text(g, String(this.startScore + this.game.stats().score), vp.w / 2, vp.safeTop + 76, {
      size: 42,
      weight: 800,
      align: 'center',
    });

    const ratio = Math.max(0, this.timeLeft / this.total);
    const color = this.timeLeft <= 5 ? C.orange : C.acid;
    bar(g, rect(24, vp.safeTop + 88, vp.w - 48, 8), ratio, color);
    text(g, `${Math.ceil(Math.max(0, this.timeLeft))}s`, vp.w - 24, vp.safeTop + 118, {
      size: 11,
      color,
      align: 'right',
      mono: true,
    });

    if (this.revived) {
      text(g, `复活 +${this.app.config.reviveSeconds}s`, 24, vp.safeTop + 118, {
        size: 11,
        color: C.warn,
        mono: true,
      });
    }
  }

  onTouch(phase: TouchPhase, x: number, y: number): void {
    if (phase !== 'start' || this.ended) return;
    // 命中反馈放在 shell，玩法保持纯逻辑
    if (!this.game.onDown(x, y)) return;
    this.app.sfx('hit');
    if (this.app.state.haptics) haptic();
  }

  private finish(): void {
    this.ended = true;
    const gained = this.game.stats().score;
    const total = this.startScore + gained;
    const coins = Math.floor(gained * this.app.config.coinsPerScore);
    this.app.finishRun({ score: total, coins, revived: this.revived });
  }
}
