import { AD_SLOTS } from '../config/ad-slots';
import { CONFIG, type GameConfig } from '../config/game-config';
import { AdManager } from '../core/ad/manager';
import { Sfx, type SfxName } from '../core/audio';
import type { MockAdRequest } from '../core/ad/types';
import { DEV } from '../core/env';
import { IS_WECHAT, WX, bindTouch, createCanvas, raf } from '../core/platform';
import { ensurePrivacy } from '../core/privacy';
import { activeShare, setupShareMenu } from '../core/share';
import * as remote from '../core/remote';
import * as store from '../core/storage';
import { Telemetry } from '../core/telemetry';
import { Viewport } from '../core/viewport';
import { C, font } from './theme';
import { badge, button, clear, hit, panel, rect, scrim, text } from './draw';
import { HomeScene } from './scenes/home';
import { PlayScene } from './scenes/play';
import { SettingsScene } from './scenes/settings';
import { SettleScene } from './scenes/settle';
import type { AppApi, RunResult, RunState, Scene, TouchPhase } from './types';

interface MockState {
  req: MockAdRequest;
  left: number;
  total: number;
  resolve: (completed: boolean) => void;
}

const SAVE_KEY = 'save:v1';

function freshState(): RunState {
  return { coins: 0, best: 0, runs: 0, haptics: true, sound: true };
}

/**
 * 应用壳：唯一持有 canvas、循环、场景栈的类。
 * 场景只通过 AppApi 说话，所以换 UI / 换玩法都不用动这里。
 */
export class App implements AppApi {
  vp!: Viewport;
  canvas: any = null;
  g!: CanvasRenderingContext2D;
  ad!: AdManager;
  config: GameConfig = CONFIG;
  state: RunState = freshState();

  private telemetry!: Telemetry;
  private audio = new Sfx(true);
  private scene: Scene | null = null;
  private overlay: Scene | null = null;
  private mock: MockState | null = null;
  private toastMsg = '';
  private toastUntil = 0;
  private last = 0;

  async boot(): Promise<void> {
    this.canvas = createCanvas();
    this.resize();
    if (!IS_WECHAT) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      window.addEventListener('resize', () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => this.resize(), 120);
      });
    }
    bindTouch(this.canvas, (phase, x, y) => this.dispatchTouch(phase, x, y));

    // 远程配置失败不阻塞启动，只是用包内默认值
    try {
      await remote.load(this.config.remoteConfigUrl);
      this.applyRemote();
    } catch (err) {
      console.warn('[boot] remote config skipped', err);
    }

    const agreed = await ensurePrivacy();
    if (!agreed) this.toast('未同意隐私协议，广告将无法展示');

    this.telemetry = new Telemetry(this.config.telemetryUrl);
    this.telemetry.start();
    this.track('app_launch', { version: this.config.version, dev: DEV, wx: IS_WECHAT });

    this.ad = new AdManager({
      slots: this.config.ads.slots,
      mode: this.config.ads.mode,
      fallbackGrant: this.config.ads.fallbackGrant,
      telemetry: this.telemetry,
      presentMock: (req) => this.presentMock(req),
    });
    if (this.config.ads.enabled) this.ad.init();

    // 旧存档可能没有新字段，用默认值补齐
    this.state = { ...freshState(), ...store.get<RunState>(SAVE_KEY, freshState()) };
    this.audio = new Sfx(this.state.sound !== false);
    setupShareMenu(() => ({ title: this.config.shareTitle, imageUrl: this.config.shareImageUrl }));
    this.bindLifecycle();
    this.setScene(new HomeScene(this));

    raf(this.loop);
  }

  // ------------------------------------------------------------ AppApi

  saveState(): void {
    store.set(SAVE_KEY, this.state);
  }

  toast(msg: string): void {
    this.toastMsg = msg;
    this.toastUntil = Date.now() + 1800;
  }

  track(name: string, props: Record<string, unknown> = {}): void {
    if (this.telemetry) this.telemetry.track(name, props);
  }

  setScene(scene: Scene): void {
    if (this.scene && this.scene !== scene) this.scene.exit?.();
    this.scene = scene;
    this.overlay = null;
    scene.enter?.();
  }

  startRun(): void {
    this.track('run_start', { runs: this.state.runs + 1 });
    this.setScene(new PlayScene(this));
  }

  finishRun(result: RunResult): void {
    const record = result.score > this.state.best;
    this.track('run_end', { ...result, record });
    this.state.best = Math.max(this.state.best, result.score);
    // 复活续局不重复计一局（否则插屏的「前 N 局」会被刷掉）
    if (!result.revived) this.state.runs += 1;
    this.state.coins += result.coins;
    this.saveState();
    this.setScene(new SettleScene(this, { ...result, record }));
  }

  reviveRun(score: number): void {
    this.setScene(new PlayScene(this, { revive: true, score }));
  }

  addCoins(n: number): void {
    const add = Math.max(0, Math.round(n));
    if (!add) return;
    this.state.coins += add;
    this.saveState();
  }

  openSettings(): void {
    this.overlay = new SettingsScene(this);
  }

  sfx(name: SfxName): void {
    this.audio.play(name);
  }

  setSound(on: boolean): void {
    this.state.sound = on;
    this.audio.setEnabled(on);
    this.saveState();
  }

  share(): void {
    this.track('share_tap');
    activeShare({ title: this.config.shareTitle, imageUrl: this.config.shareImageUrl });
  }

  closeOverlay(): void {
    this.overlay = null;
  }

  adsLabel(): string {
    if (!this.config.ads.enabled) return 'OFF';
    if (!this.ad) return 'BOOT';
    return this.ad.isLive('revive') ? 'LIVE' : 'MOCK';
  }

  // ------------------------------------------------------------ 内部

  private resize(): void {
    this.vp = new Viewport();
    this.canvas.width = Math.round(this.vp.cssW * this.vp.dpr);
    this.canvas.height = Math.round(this.vp.cssH * this.vp.dpr);
    const g = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    g.setTransform(this.vp.scale, 0, 0, this.vp.scale, 0, 0);
    this.g = g;
  }

  private applyRemote(): void {
    const r = remote.current();
    if (typeof r.roundSeconds === 'number' && r.roundSeconds > 0) this.config.roundSeconds = r.roundSeconds;
    if (typeof r.coinsPerScore === 'number') this.config.coinsPerScore = r.coinsPerScore;
    if (typeof r.rewardMultiplier === 'number') this.config.doubleMultiplier = r.rewardMultiplier;
    if (typeof r.adsEnabled === 'boolean') this.config.ads.enabled = r.adsEnabled;
  }

  private bindLifecycle(): void {
    if (!IS_WECHAT) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) void this.telemetry.flush();
      });
      return;
    }
    WX.onHide(() => {
      this.ad.hideBanner();
      this.track('app_hide');
      void this.telemetry.flush();
    });
    WX.onShow(() => this.track('app_show'));
  }

  private loop = (t: number): void => {
    const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0.016;
    this.last = t;
    this.update(dt);
    this.render();
    raf(this.loop);
  };

  private update(dt: number): void {
    if (this.mock) {
      this.mock.left -= dt;
      if (this.mock.req.kind !== 'reward' && this.mock.left <= 0) this.finishMock(true);
    }
    this.scene?.update(dt);
    this.overlay?.update(dt);
  }

  private render(): void {
    const g = this.g;
    clear(g, this.vp.w, this.vp.h, C.bg);
    this.scene?.render(g);
    if (this.overlay) {
      scrim(g, this.vp.w, this.vp.h, 0.55);
      this.overlay.render(g);
    }
    this.renderMock(g);
    this.renderToast(g);
  }

  private renderToast(g: CanvasRenderingContext2D): void {
    if (!this.toastMsg || Date.now() > this.toastUntil) return;
    const vp = this.vp;
    g.font = font(13, 700);
    const w = Math.min(vp.w - 48, g.measureText(this.toastMsg).width + 36);
    // 放在屏幕 42% 处：首页/结算页那里是空白区，不会压住按钮
    const y = Math.max(vp.safeTop + 150, vp.h * 0.42);
    panel(g, rect((vp.w - w) / 2, y, w, 38), { fill: C.ink, stroke: C.paper });
    text(g, this.toastMsg, vp.w / 2, y + 19, { size: 13, color: C.paper, align: 'center', baseline: 'middle' });
  }

  // ------------------------------------------------------------ mock 广告

  private presentMock(req: MockAdRequest): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const total = req.kind === 'reward' ? 3 : 1.5;
      this.mock = { req, left: total, total, resolve };
    });
  }

  private finishMock(completed: boolean): void {
    const m = this.mock;
    if (!m) return;
    this.mock = null;
    this.track('ad_mock_close', { slot: m.req.slot, completed });
    m.resolve(completed);
  }

  private mockRects(): { panel: ReturnType<typeof rect>; claim: ReturnType<typeof rect>; close: ReturnType<typeof rect> } {
    const vp = this.vp;
    const panel = rect(24, vp.safeTop + 70, vp.w - 48, vp.h - vp.safeTop - 140);
    const close = rect(44, panel.y + panel.h - 58, vp.w - 88, 42);
    const claim = rect(44, close.y - 74, vp.w - 88, 56);
    return { panel, claim, close };
  }

  private renderMock(g: CanvasRenderingContext2D): void {
    const m = this.mock;
    if (!m) return;
    const vp = this.vp;
    const { panel: p, claim, close } = this.mockRects();
    const isReward = m.req.kind === 'reward';

    scrim(g, vp.w, vp.h, 0.94);
    panel(g, p, { fill: C.violet });

    text(g, isReward ? '模拟激励视频' : '模拟插屏广告', vp.w / 2, vp.safeTop + 124, {
      size: 24,
      weight: 800,
      align: 'center',
    });
    badge(g, 40, vp.safeTop + 144, 'MOCK · 未接真广告', C.warn);
    text(g, `slot: ${m.req.slot}`, vp.w / 2, vp.safeTop + 186, {
      size: 11,
      color: C.acid,
      mono: true,
      align: 'center',
    });

    const remain = Math.max(0, m.left);
    text(g, remain.toFixed(1), vp.w / 2, vp.safeTop + 300, {
      size: 72,
      weight: 800,
      color: C.warn,
      align: 'center',
      baseline: 'middle',
    });
    text(g, isReward ? '秒后可领取' : '秒后自动关闭', vp.w / 2, vp.safeTop + 336, {
      size: 11,
      color: C.dim,
      align: 'center',
    });

    text(g, isReward ? '真机上的内容是 wx.createRewardedVideoAd 播放的' : '插屏只在关卡切换出现，且不盖住按钮', vp.w / 2, vp.safeTop + 380, {
      size: 11,
      color: C.dim,
      align: 'center',
    });

    if (isReward) {
      button(g, claim, remain > 0 ? '模拟播放中…' : '领取奖励', { variant: 'primary', size: 18, disabled: remain > 0 });
    }
    button(g, close, isReward ? '关闭（放弃奖励）' : '关闭广告', { variant: 'ghost', size: 14 });
  }

  // ------------------------------------------------------------ 输入

  private dispatchTouch(phase: TouchPhase, cssX: number, cssY: number): void {
    if (cssX < 0 || cssY < 0) return;
    const x = this.vp.toX(cssX);
    const y = this.vp.toY(cssY);
    if (this.mock) {
      if (phase !== 'start') return;
      const { claim, close } = this.mockRects();
      if (this.mock.req.kind === 'reward' && this.mock.left <= 0 && hit(claim, x, y)) {
        this.finishMock(true);
        return;
      }
      if (hit(close, x, y)) this.finishMock(false);
      return;
    }
    if (this.overlay) {
      this.overlay.onTouch(phase, x, y);
      return;
    }
    this.scene?.onTouch(phase, x, y);
  }
}

export function boot(): void {
  const app = new App();
  void app.boot().catch((err) => {
    console.error('[boot] failed', err);
  });
}
