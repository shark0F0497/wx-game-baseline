import type { AdSlot } from '../core/ad/types';

/**
 * 广告位表 —— 每开一个新游戏，这份文件是必改项之一。
 *
 * 命名建议用「位置 + 奖励语义」，不要用「广告类型」：
 *   好：revive / doubleCoins / levelEnd / homeBanner
 *   差：rewardAd1 / interstitial2
 * 这样玩法层调用时读起来就是业务语义，换广告实现也不影响调用点。
 */
export const AD_SLOTS: Record<string, AdSlot> = {
  /** 结算页复活：eCPM 最高的位置，每日限 5 次 */
  revive: { kind: 'reward', unitId: '', dailyLimit: 5 },

  /** 结算页双倍金币 */
  doubleCoins: { kind: 'reward', unitId: '', cooldown: 10, dailyLimit: 20 },

  /** 关卡结束插屏：前 2 局不弹，冷却 45s */
  levelEnd: { kind: 'interstitial', unitId: '', skipFirstN: 2, cooldown: 45 },

  /** 首页底部 banner，进游戏立刻 hide() */
  homeBanner: { kind: 'banner', unitId: '', bannerWidth: 300 },
};
