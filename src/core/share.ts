import { IS_WECHAT, WX } from './platform';

/**
 * 分享：只做「主动分享」，**不给任何奖励**。
 * 微信早就不返回分享成功与否（onShareAppMessage 的回调只代表拉起），
 * 用分享发奖是审核红线，模板里不提供这种能力。
 */
export interface SharePayload {
  title: string;
  /** 5:4 比例的分享图，留空用截图 */
  imageUrl?: string;
  query?: string;
}

/** 点按钮主动拉起分享面板 */
export function activeShare(payload: SharePayload): void {
  if (!IS_WECHAT) {
    console.log('[share]', payload.title);
    return;
  }
  WX.shareAppMessage({
    title: payload.title,
    imageUrl: payload.imageUrl || undefined,
    query: payload.query ?? '',
  });
}

/** 右上角菜单「转发」用的默认内容 */
export function setupShareMenu(payload: () => SharePayload): void {
  if (!IS_WECHAT) return;
  try {
    WX.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
    WX.onShareAppMessage(() => {
      const p = payload();
      return { title: p.title, imageUrl: p.imageUrl || undefined, query: p.query ?? '' };
    });
  } catch (err) {
    console.warn('[share] setup failed', err);
  }
}
