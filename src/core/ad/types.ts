export type AdKind = 'reward' | 'interstitial' | 'banner';

export interface AdSlot {
  kind: AdKind;
  /** 微信后台申请的广告位 ID；留空 = 该位置不可用（会走 mock 或降级） */
  unitId: string;
  /** 同一广告位两次展示的最小间隔（秒） */
  cooldown?: number;
  /** 每人每天最多展示次数，0 / 不填 = 不限 */
  dailyLimit?: number;
  /** 插屏：前 N 局不弹（用「已玩局数」判断） */
  skipFirstN?: number;
  /** banner 宽度（微信要求 >= 300） */
  bannerWidth?: number;
}

export type RewardStatus = 'completed' | 'skipped' | 'unavailable' | 'blocked';

export interface RewardOutcome {
  slot: string;
  status: RewardStatus;
  /** blocked 时说明原因；fallback 表示广告不可用但按配置直接发奖 */
  reason?: string;
}

export interface MockAdRequest {
  slot: string;
  kind: AdKind;
}

export interface AdModeOption {
  /** auto: 有 unitId 走真广告，没有就走 mock（默认，开发期最省事） */
  mode: 'auto' | 'mock' | 'real';
  /** 真广告不可用时是否直接发奖（没开流量主时必须 true，否则玩家永远拿不到奖励） */
  fallbackGrant: boolean;
}
