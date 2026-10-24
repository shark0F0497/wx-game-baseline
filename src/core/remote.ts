import { httpJson } from './platform';
import * as store from './storage';

/**
 * 远程配置：一个 JSON 就能在线关广告、调频次、关功能，不用发版。
 * 拿不到就用上一次成功的缓存，再拿不到就用包内默认值 —— 永远不阻塞启动。
 */
export interface RemoteConfig {
  roundSeconds?: number;
  coinsPerScore?: number;
  adsEnabled?: boolean;
  rewardMultiplier?: number;
  features?: Record<string, boolean>;
  notice?: string;
}

const CACHE_KEY = 'remote:v1';
const TTL_MS = 10 * 60 * 1000;

let state: RemoteConfig = {};
let fetchedAt = 0;

export function current(): RemoteConfig {
  return state;
}

export async function load(url: string): Promise<RemoteConfig> {
  if (!url) return state;
  if (fetchedAt && Date.now() - fetchedAt < TTL_MS) return state;

  const cached = store.get<RemoteConfig | null>(CACHE_KEY, null);
  if (cached) state = cached;

  try {
    const data = await httpJson(url, undefined, 3000);
    if (data && typeof data === 'object') {
      state = data as RemoteConfig;
      store.set(CACHE_KEY, state);
      fetchedAt = Date.now();
    }
  } catch (err) {
    console.warn('[remote] fallback to cache', err);
  }
  return state;
}

export function feature(name: string, fallback = false): boolean {
  const flags = state.features;
  return flags && typeof flags[name] === 'boolean' ? flags[name] : fallback;
}
