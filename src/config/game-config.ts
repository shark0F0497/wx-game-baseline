import { AD_SLOTS } from './ad-slots';
import type { AdSlot } from '../core/ad/types';

/**
 * 全局配置。改这里就能改整套模板的行为，不要把这些散落到场景里。
 *
 * unitId 留空 = 该广告位不可用：
 *   - dev / 浏览器预览 → 走 mock 广告（shell 里画的那个假广告页）
 *   - 线上 mode: 'real'  → 按 fallbackGrant 直接发奖
 * 填上微信后台申请的 adunit-xxxxx 才会拉真广告。
 */
export interface GameConfig {
  version: string;
  /** 单局时长（秒） */
  roundSeconds: number;
  /** 1 分换多少金币 */
  coinsPerScore: number;
  /** 双倍奖励倍数 */
  doubleMultiplier: number;
  /** 复活加多少秒 */
  reviveSeconds: number;
  /** 远程配置 JSON 地址，留空 = 不拉 */
  remoteConfigUrl: string;
  /** 埋点上报地址，留空 = 只打 console */
  telemetryUrl: string;
  ads: {
    mode: 'auto' | 'mock' | 'real';
    fallbackGrant: boolean;
    enabled: boolean;
    slots: Record<string, AdSlot>;
  };
}

export const CONFIG: GameConfig = {
  version: '0.1.0',
  roundSeconds: 20,
  coinsPerScore: 1,
  doubleMultiplier: 2,
  reviveSeconds: 8,
  remoteConfigUrl: '',
  telemetryUrl: '',

  ads: {
    mode: 'auto',
    fallbackGrant: true,
    enabled: true,
    slots: AD_SLOTS,
  },
};
