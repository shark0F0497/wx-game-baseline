import { IS_WECHAT, WX } from './platform';

/**
 * 隐私合规：微信要求「首次调用受隐私保护的接口前」拿到用户同意。
 * 小游戏里没有自定义组件按钮，标准做法是 onNeedPrivacyAuthorization + 自己弹窗，
 * 用户点同意后 resolve({ event: 'agree' })。
 *
 * 后台必须先在 mp 后台填好《用户隐私保护指引》，并声明广告用途，
 * 否则这里拿到了「同意」也照样审核不过。
 */
let settled: boolean | null = null;
let pending: Promise<boolean> | null = null;

export function privacySettled(): boolean | null {
  return settled;
}

export function ensurePrivacy(): Promise<boolean> {
  if (!IS_WECHAT || typeof WX.requirePrivacyAuthorize !== 'function') {
    settled = true;
    return Promise.resolve(true);
  }
  if (settled !== null) return Promise.resolve(settled);
  if (pending) return pending;

  pending = new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      settled = ok;
      pending = null;
      resolve(ok);
    };

    // 需要授权时会回调这里；resolve 之后微信才放行受保护接口
    WX.onNeedPrivacyAuthorization((res: any) => {
      WX.showModal({
        title: '隐私保护指引',
        content: '本游戏会收集设备信息用于展示广告，并保存你的游戏进度。详见《用户隐私保护指引》。',
        confirmText: '同意并继续',
        cancelText: '暂不同意',
        success: (r: any) => {
          const agree = !!r.confirm;
          if (typeof res.resolve === 'function') res.resolve({ event: agree ? 'agree' : 'disagree' });
          finish(agree);
        },
        fail: () => {
          if (typeof res.resolve === 'function') res.resolve({ event: 'disagree' });
          finish(false);
        },
      });
    });

    WX.requirePrivacyAuthorize({
      success: () => finish(true),
      fail: () => finish(false),
    });

    // 兜底：老版本 / 后台没配置时可能永远不回调，别把启动卡死
    setTimeout(() => finish(true), 8000);
  });

  return pending;
}

/** 设置页里打开官方隐私协议（微信后台配置的那份） */
export function openPrivacyContract(): void {
  if (!IS_WECHAT || typeof WX.openPrivacyContract !== 'function') return;
  WX.openPrivacyContract({ fail: () => WX.showToast({ title: '暂未配置隐私协议', icon: 'none' }) });
}
