import { CONFIG } from './config/game-config';
import { IS_WECHAT } from './core/platform';
import { boot } from './shell/app';

// 浏览器预览专用：?round=3 把单局压到 3 秒，方便快速走完 首页→游戏→结算→广告 流程
if (!IS_WECHAT && typeof location !== 'undefined') {
  const m = /[?&]round=(\d+)/.exec(location.search);
  if (m) CONFIG.roundSeconds = Math.max(1, Number(m[1]));
}

// 小游戏里 game.js 由运行时直接执行；浏览器预览则等 DOM ready
if (IS_WECHAT || document.readyState !== 'loading') boot();
else document.addEventListener('DOMContentLoaded', boot);
