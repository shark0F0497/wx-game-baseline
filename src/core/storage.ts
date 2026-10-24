import { IS_WECHAT, WX } from './platform';

/**
 * 存档：所有 key 带前缀，值统一 JSON 序列化，读写失败一律降级为内存值 ——
 * 存档坏掉不能影响玩下去。
 */
const PREFIX = 'wmt:';

export function get<T>(key: string, fallback: T): T {
  const full = PREFIX + key;
  try {
    if (IS_WECHAT) {
      const raw = WX.getStorageSync(full);
      if (raw === '' || raw === null || raw === undefined) return fallback;
      return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
    }
    const raw = localStorage.getItem(full);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function set<T>(key: string, value: T): void {
  const full = PREFIX + key;
  try {
    const raw = JSON.stringify(value);
    if (IS_WECHAT) WX.setStorageSync(full, raw);
    else localStorage.setItem(full, raw);
  } catch (err) {
    console.warn('[storage] write failed', key, err);
  }
}

export function remove(key: string): void {
  const full = PREFIX + key;
  try {
    if (IS_WECHAT) WX.removeStorageSync(full);
    else localStorage.removeItem(full);
  } catch {
    /* ignore */
  }
}

/** 今天（本地时区）的日期键，用于每日限次 */
export function dayKey(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
