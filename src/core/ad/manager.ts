import { IS_WECHAT } from '../platform';
import * as store from '../storage';
import { dayKey } from '../storage';
import type { Telemetry } from '../telemetry';
import type { AdSlot, MockAdRequest, RewardOutcome } from './types';
import { WxBanner, WxInterstitial, WxRewardAd } from './wx-ads';

export interface AdManagerOptions {
  slots: Record<string, AdSlot>;
  /** auto: 配了 unitId 走真广告，没配就走 mock */
  mode: 'auto' | 'mock' | 'real';
  /** 真广告不可用（没流量主 / 加载失败）时是否直接发奖 */
  fallbackGrant: boolean;
  telemetry: Telemetry;
  /** 由 shell 提供：画一个假的广告页，返回用户是否看完 */
  presentMock: (req: MockAdRequest) => Promise<boolean>;
}

interface FreqState {
  day: string;
  count: number;
  lastAt: number;
}

/**
 * 广告调度：上层只认语义化的 slot 名字，不碰 wx API。
 *
 * 三件事必须由它统一负责，否则每个游戏都会写歪：
 *   1. 频控（冷却 / 每日上限 / 前 N 局不弹）— 存本地，跨启动生效
 *   2. 降级（没流量主、加载失败、用户中途关闭）— 永远不卡住玩法
 *   3. 埋点（show / complete / skip / blocked）— 调 eCPM 的唯一依据
 */
export class AdManager {
  private rewardAds = new Map<string, WxRewardAd>();
  private interstitials = new Map<string, WxInterstitial>();
  private banner: WxBanner | null = null;
  private bannerSlot = '';

  constructor(private opts: AdManagerOptions) {}

  /** 预热激励视频：首次点击就命中缓存的概率高很多 */
  init(): void {
    for (const [name, slot] of Object.entries(this.opts.slots)) {
      if (slot.kind !== 'reward') continue;
      const unit = this.unitFor(slot);
      if (!unit || !IS_WECHAT) continue;
      this.rewardAds.set(name, new WxRewardAd(unit)).get(name)!.preload();
    }
  }

  /** 该 slot 会不会走真广告（给 UI 打「广告不可用」提示用） */
  isLive(name: string): boolean {
    const slot = this.opts.slots[name];
    return !!(slot && IS_WECHAT && this.unitFor(slot));
  }

  async showReward(name: string): Promise<RewardOutcome> {
    const slot = this.opts.slots[name];
    if (!slot || slot.kind !== 'reward') return { slot: name, status: 'unavailable', reason: 'no-slot' };

    const blocked = this.checkFreq(name, slot, 0);
    if (blocked) {
      this.opts.telemetry.track('ad_blocked', { slot: name, reason: blocked });
      return { slot: name, status: 'blocked', reason: blocked };
    }

    const unit = this.unitFor(slot);
    let completed = false;
    let reason: string | undefined;

    if (unit) {
      this.opts.telemetry.track('ad_show', { slot: name, kind: 'reward', live: true });
      const ad = this.rewardAds.get(name) ?? new WxRewardAd(unit);
      this.rewardAds.set(name, ad);
      completed = await ad.show();
    } else if (this.opts.mode === 'real') {
      // 明确要求真广告但没有广告位：没开流量主的线上体验
      this.opts.telemetry.track('ad_show', { slot: name, kind: 'reward', live: false });
      reason = 'fallback';
      completed = this.opts.fallbackGrant;
    } else {
      this.opts.telemetry.track('ad_show', { slot: name, kind: 'reward', live: false });
      completed = await this.opts.presentMock({ slot: name, kind: 'reward' });
    }

    this.commit(name, slot, completed);
    this.opts.telemetry.track(completed ? 'ad_complete' : 'ad_skip', { slot: name, reason });
    return { slot: name, status: completed ? 'completed' : 'skipped', reason };
  }

  async showInterstitial(name: string, runs: number): Promise<boolean> {
    const slot = this.opts.slots[name];
    if (!slot || slot.kind !== 'interstitial') return false;

    const blocked = this.checkFreq(name, slot, runs);
    if (blocked) {
      this.opts.telemetry.track('ad_blocked', { slot: name, reason: blocked });
      return false;
    }

    const unit = this.unitFor(slot);
    let shown = false;
    if (unit) {
      const ad = this.interstitials.get(name) ?? new WxInterstitial(unit);
      this.interstitials.set(name, ad);
      this.opts.telemetry.track('ad_show', { slot: name, kind: 'interstitial', live: true });
      shown = await ad.show();
      if (!shown) this.opts.telemetry.track('ad_error', { slot: name, kind: 'interstitial' });
    } else if (this.opts.mode !== 'real') {
      this.opts.telemetry.track('ad_show', { slot: name, kind: 'interstitial', live: false });
      shown = await this.opts.presentMock({ slot: name, kind: 'interstitial' });
    } else {
      // 没广告位：插屏直接跳过，不要用假弹窗打扰玩家
      this.opts.telemetry.track('ad_blocked', { slot: name, reason: 'no-unit' });
      return false;
    }

    this.commit(name, slot, true);
    return shown;
  }

  /** 返回是否真的展示了微信 banner（false 时 shell 可以画占位条） */
  showBanner(name: string): boolean {
    const slot = this.opts.slots[name];
    if (!slot || slot.kind !== 'banner') return false;
    const unit = this.unitFor(slot);
    if (!unit) return false;
    if (this.banner && this.bannerSlot === name) {
      this.banner.show();
      return true;
    }
    this.hideBanner();
    this.banner = new WxBanner(unit, slot.bannerWidth ?? 300);
    this.bannerSlot = name;
    this.banner.show();
    this.opts.telemetry.track('ad_show', { slot: name, kind: 'banner', live: true });
    return true;
  }

  hideBanner(): void {
    if (!this.banner) return;
    this.banner.hide();
    this.banner.destroy();
    this.banner = null;
    this.bannerSlot = '';
  }

  /** 设置页调试用 */
  describe(): Array<{ slot: string; kind: string; live: boolean; left: number }> {
    return Object.entries(this.opts.slots).map(([name, slot]) => {
      const freq = this.freqFor(name);
      const today = dayKey();
      const used = freq.day === today ? freq.count : 0;
      return {
        slot: name,
        kind: slot.kind,
        live: this.isLive(name),
        left: slot.dailyLimit ? Math.max(0, slot.dailyLimit - used) : -1,
      };
    });
  }

  // ---------------------------------------------------------------- 内部

  private unitFor(slot: AdSlot): string {
    if (this.opts.mode === 'mock') return '';
    if (!IS_WECHAT) return ''; // 浏览器预览永远不走真广告
    return slot.unitId || '';
  }

  private freqKey(name: string): string {
    return `ad:freq:${name}`;
  }

  private freqFor(name: string): FreqState {
    const today = dayKey();
    const saved = store.get<FreqState>(this.freqKey(name), { day: today, count: 0, lastAt: 0 });
    if (saved.day !== today) return { day: today, count: 0, lastAt: 0 };
    return saved;
  }

  /** 返回 null 表示允许展示 */
  private checkFreq(name: string, slot: AdSlot, runs: number): string | null {
    if (slot.kind === 'interstitial' && slot.skipFirstN && runs < slot.skipFirstN) return 'skip-first-n';
    const freq = this.freqFor(name);
    if (slot.dailyLimit && freq.count >= slot.dailyLimit) return 'daily-limit';
    if (slot.cooldown && freq.lastAt && Date.now() - freq.lastAt < slot.cooldown * 1000) return 'cooldown';
    return null;
  }

  private commit(name: string, _slot: AdSlot, _completed: boolean): void {
    const freq = this.freqFor(name);
    store.set<FreqState>(this.freqKey(name), { day: freq.day, count: freq.count + 1, lastAt: Date.now() });
  }
}
