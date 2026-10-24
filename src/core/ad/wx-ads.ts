import { IS_WECHAT, WX, windowInfo } from '../platform';

/**
 * wx 广告组件的薄适配：把回调风格包成 Promise，并把所有异常吞掉换成 false。
 * 上层（AdManager）不需要知道 wx 的 errCode 长什么样。
 */

export class WxRewardAd {
  private ad: any;
  private waiter: ((completed: boolean) => void) | null = null;

  constructor(private unitId: string) {
    this.ad = WX.createRewardedVideoAd({ adUnitId: unitId, multiton: true });
    this.ad.onClose((res: any) => {
      // 老基础库没有 isEnded，按「关了就算看完」处理，否则老机型永远发不出奖励
      this.settle(res && res.isEnded !== false);
    });
    this.ad.onError((err: any) => {
      console.warn('[ad] reward error', err && (err.errCode ?? err.errMsg));
      this.settle(false);
    });
  }

  private settle(completed: boolean): void {
    const w = this.waiter;
    this.waiter = null;
    if (w) w(completed);
  }

  preload(): void {
    try {
      this.ad.load().catch(() => undefined);
    } catch {
      /* 预热失败无所谓，show 时还会再 load 一次 */
    }
  }

  async show(): Promise<boolean> {
    if (this.waiter) return false; // 已在展示中，防重入
    const done = new Promise<boolean>((resolve) => {
      this.waiter = resolve;
    });
    try {
      await this.ad.show();
    } catch {
      try {
        await this.ad.load();
        await this.ad.show();
      } catch (err) {
        console.warn('[ad] reward show failed', err);
        this.settle(false);
      }
    }
    return done;
  }

  destroy(): void {
    try {
      this.ad.destroy && this.ad.destroy();
    } catch {
      /* ignore */
    }
  }
}

export class WxInterstitial {
  private ad: any = null;

  constructor(private unitId: string) {}

  async show(): Promise<boolean> {
    try {
      if (!this.ad) this.ad = WX.createInterstitialAd({ adUnitId: this.unitId });
      await this.ad.show();
      return true;
    } catch (err) {
      console.warn('[ad] interstitial failed', err);
      return false;
    }
  }

  destroy(): void {
    try {
      this.ad && this.ad.destroy && this.ad.destroy();
    } catch {
      /* ignore */
    }
  }
}

export class WxBanner {
  private ad: any = null;

  constructor(private unitId: string, private width = 300) {}

  show(): void {
    if (!IS_WECHAT) return;
    if (this.ad) {
      try {
        this.ad.show();
      } catch {
        /* ignore */
      }
      return;
    }
    const win = windowInfo();
    const w = Math.min(Math.max(300, this.width), win.cssW);
    try {
      this.ad = WX.createBannerAd({
        adUnitId: this.unitId,
        adIntervals: 30,
        style: { left: (win.cssW - w) / 2, top: win.cssH - 120, width: w },
      });
      // 真实高度要等 onResize 才知道，这时再把它顶到底部安全区上方
      this.ad.onResize((size: any) => {
        if (!this.ad) return;
        this.ad.style.top = win.cssH - size.height - win.safeBottom;
        this.ad.style.left = (win.cssW - size.width) / 2;
      });
      this.ad.onError((err: any) => console.warn('[ad] banner error', err && (err.errCode ?? err.errMsg)));
      Promise.resolve(this.ad.show()).catch(() => undefined);
    } catch (err) {
      console.warn('[ad] banner create failed', err);
    }
  }

  hide(): void {
    try {
      this.ad && this.ad.hide && this.ad.hide();
    } catch {
      /* ignore */
    }
  }

  destroy(): void {
    try {
      this.ad && this.ad.destroy && this.ad.destroy();
    } catch {
      /* ignore */
    }
    this.ad = null;
  }
}
