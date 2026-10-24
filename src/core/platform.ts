/**
 * 平台层：唯一允许直接触碰 wx / DOM 的地方。
 * 小游戏里没有 document / window，浏览器预览里没有 wx —— 两边都从这里分叉，
 * 上层（core/shell/game）一律不写平台判断。
 */

const g = globalThis as any;

/** 微信小游戏运行时（浏览器预览时为 null） */
export const WX: any = typeof g.wx !== 'undefined' ? g.wx : null;
export const IS_WECHAT: boolean = !!(WX && typeof WX.getSystemInfoSync === 'function' && typeof WX.createCanvas === 'function');

export interface WindowInfo {
  /** CSS 像素宽高（小游戏里就是 windowWidth / windowHeight） */
  cssW: number;
  cssH: number;
  dpr: number;
  safeTop: number;
  safeBottom: number;
}

export function windowInfo(): WindowInfo {
  if (IS_WECHAT) {
    const info = typeof WX.getWindowInfo === 'function' ? WX.getWindowInfo() : WX.getSystemInfoSync();
    const cssW: number = info.windowWidth || info.screenWidth || 375;
    const cssH: number = info.windowHeight || info.screenHeight || 667;
    const safe = info.safeArea || {};
    const screenH: number = info.screenHeight || cssH;
    return {
      cssW,
      cssH,
      dpr: info.pixelRatio || 1,
      // 刘海 / 底部横条，统一换算成 CSS px
      safeTop: Math.max(0, (safe.top ?? 0)),
      safeBottom: Math.max(0, screenH - (safe.bottom ?? screenH)),
    };
  }
  return {
    cssW: window.innerWidth || 375,
    cssH: window.innerHeight || 667,
    dpr: Math.min(window.devicePixelRatio || 1, 3),
    safeTop: 0,
    safeBottom: 0,
  };
}

export function createCanvas(): any {
  if (IS_WECHAT) return WX.createCanvas();
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;display:block;width:100%;height:100%;touch-action:none';
  document.body.appendChild(canvas);
  return canvas;
}

export type TouchPhase = 'start' | 'move' | 'end';

/**
 * 触摸回调坐标是「CSS 像素」，由 Viewport 统一换算成逻辑坐标。
 * 小游戏和浏览器都只上报主触点，够模板用；要做多指再在这里扩。
 */
export function bindTouch(canvas: any, onTouch: (phase: TouchPhase, cssX: number, cssY: number) => void): void {
  if (IS_WECHAT) {
    WX.onTouchStart((e: any) => {
      const t = e.touches && e.touches[0];
      if (t) onTouch('start', t.clientX, t.clientY);
    });
    WX.onTouchMove((e: any) => {
      const t = e.touches && e.touches[0];
      if (t) onTouch('move', t.clientX, t.clientY);
    });
    WX.onTouchEnd((e: any) => {
      const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
      if (!t) return;
      onTouch('end', t.clientX, t.clientY);
    });
    WX.onTouchCancel(() => onTouch('end', -1, -1));
    return;
  }

  const pick = (e: PointerEvent) => onTouch(e.type === 'pointerdown' ? 'start' : e.type === 'pointerup' ? 'end' : 'move', e.clientX, e.clientY);
  canvas.addEventListener('pointerdown', pick);
  canvas.addEventListener('pointermove', pick);
  canvas.addEventListener('pointerup', pick);
  canvas.addEventListener('pointercancel', (e: PointerEvent) => onTouch('end', e.clientX, e.clientY));
}

export function raf(cb: (t: number) => void): void {
  requestAnimationFrame(cb);
}

export function haptic(): void {
  if (!IS_WECHAT) return;
  try {
    WX.vibrateShort({ type: 'light' });
  } catch {
    /* 部分机型不支持，忽略 */
  }
}

/** 网络：超时一律 reject，调用方自己兜底（远程配置、埋点都允许失败） */
export function httpJson(url: string, body?: unknown, timeoutMs = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('empty url'));
      return;
    }
    if (IS_WECHAT) {
      WX.request({
        url,
        method: body ? 'POST' : 'GET',
        data: body,
        timeout: timeoutMs,
        header: { 'content-type': 'application/json' },
        success: (res: any) => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
          else reject(new Error(`http ${res.statusCode}`));
        },
        fail: (err: any) => reject(new Error(err && err.errMsg ? err.errMsg : 'request failed')),
      });
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`http ${r.status}`))))
      .then((data) => resolve(data))
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}
