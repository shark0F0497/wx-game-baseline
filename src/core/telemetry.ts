import { DEV } from './env';
import { httpJson } from './platform';

export interface TrackEvent {
  name: string;
  ts: number;
  sid: string;
  [key: string]: unknown;
}

/**
 * 埋点：只做「攒批 + 尽力上报」，永不阻塞玩法。
 * 广告相关事件名已固定（ad_show / ad_complete / ad_blocked / ad_error），
 * 后台分析按这几类聚合就能算完播率与人均广告次数。
 */
export class Telemetry {
  private queue: TrackEvent[] = [];
  private sid = Math.random().toString(36).slice(2, 10);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private url: string) {}

  start(flushMs = 10000): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), flushMs);
  }

  track(name: string, props: Record<string, unknown> = {}): void {
    const event: TrackEvent = { name, ts: Date.now(), sid: this.sid, ...props };
    this.queue.push(event);
    if (DEV) console.log('[track]', name, props);
    if (this.queue.length >= 20) void this.flush();
  }

  async flush(): Promise<void> {
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, this.queue.length);
    if (!this.url) return;
    try {
      await httpJson(this.url, { events: batch }, 4000);
    } catch {
      // 埋点丢就丢了，不重试也不补发，避免离线时无限堆积
    }
  }
}
