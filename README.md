# 微信小游戏壳模板（M0）

原生 Canvas + TypeScript + esbuild。**只做壳**：启动、广告调度、存档、隐私、结算、设置；
玩法通过 6 个钩子插拔，换游戏时原则上只改 `src/game/` 和 `src/config/ad-slots.ts`。

```
src/
  core/            与引擎无关的基础设施（也不碰 UI）
    platform.ts    唯一允许直接调 wx / DOM 的地方
    viewport.ts    逻辑坐标：宽固定 375，高按屏幕比例
    ad/            manager（频控/降级/埋点）+ wx 适配 + mock 回调
    audio.ts       音效（WebAudio 合成，零音频资源）
    share.ts       主动分享 + 右上角转发菜单（不给奖励）
    privacy.ts     onNeedPrivacyAuthorization 流程
    remote.ts      远程配置（带本地缓存，失败不阻塞）
    storage.ts     JSON 存档，key 前缀 wmt:
    telemetry.ts   攒批上报，永不阻塞玩法
  shell/           壳 UI（Canvas 立即模式）
    app.ts         循环 / 场景栈 / mock 广告层 / toast
    draw.ts        硬边面板、按钮、进度条
    scenes/        home · play · settle · settings
  game/            玩法，只实现 types.ts 里的接口
    demo.ts        M0 示例「点星」
  config/
    ad-slots.ts    广告位表（每开新游戏必改）
    game-config.ts 全局数值与开关
```

## 命令

```powershell
npm install
npm run dev        # 浏览器预览 http://localhost:8080 （?round=3 把单局压到 3 秒）
npm run build      # 产出 dist/game.js + game.json + project.config.json
npm run typecheck
```

浏览器预览时控制台有 `window.__app`（仅 dev），可以直接调
`__app.ad.showReward('revive')` 这类接口做手动验证，不用点进结算页喵。

微信开发者工具：导入本仓库根目录（`miniprogramRoot: dist/`）。
若工具提示找不到 `game.js`，把 `dist/` 目录本身当作项目根目录导入即可。

## 接真广告（5 步）

1. 小游戏后台开通流量主（累计独立访客 ≥ 1000，以官方当期规则为准）。
2. 广告位管理里为「激励视频 / 插屏 / Banner」各建一个广告位，拿到 `adunit-xxxx`。
3. 填进 `src/config/ad-slots.ts` 对应 slot 的 `unitId`。
4. `src/config/game-config.ts` 里 `ads.mode` 改成 `'real'`（`'auto'` 时「有 unitId 就真广告」）。
5. mp 后台填《用户隐私保护指引》，声明**设备信息用于广告**，否则审核不过；
   首次启动时 `core/privacy.ts` 会用 `wx.showModal` 拿同意。

开发期不用等流量主：`unitId` 留空即走 mock 广告（`shell/app.ts` 里的假广告页，带倒计时和
「领取 / 放弃」两个按钮），可以直接测完播、放弃、频控、复活整条链路。

## 广告位与频控

| slot | 类型 | 默认策略 |
|---|---|---|
| `revive` | 激励视频 | 每日 5 次，复活不加时但保留分数 |
| `doubleCoins` | 激励视频 | 冷却 10s，每日 20 次 |
| `levelEnd` | 插屏 | 前 2 局不弹，冷却 45s，结算页延迟 700ms |
| `homeBanner` | Banner | 只在首页，进游戏 `hide()` |

频控状态存本地（`wmt:ad:freq:<slot>`，按自然日重置）。降级规则：

- `unitId` 为空 → mock（开发）或直接发奖（`mode: 'real'` + `fallbackGrant: true`）
- 加载失败 / 用户中途关闭 → 返回 `skipped`，调用方照常处理，绝不卡住玩法
- 插屏没有广告位时直接跳过，不用假弹窗打扰玩家
- 激励视频 / 插屏**串行化**：正在播放时另一条广告直接返回 `blocked: busy`，不会互相打断；
  所以「结算页 700ms 后弹插屏」和「玩家立刻点复活」撞车时，插屏让位给激励视频

## 音效与分享

- 音效不打包任何音频文件：`core/audio.ts` 用 WebAudio 合成 `tap / hit / reward / error` 四个短音，
  首包零增重、也不用等美术。要换采样音效时只改 `Sfx.play()` 内部，调用方 `app.sfx('hit')` 不变。
- 分享只做两件事：`app.share()` 主动拉起面板、右上角菜单「转发」的默认文案。
  **分享不返回成功与否，也不发任何奖励** —— 用分享发奖是审核红线。
- 分享标题 / 5:4 分享图在 `config.shareTitle` / `shareImageUrl` 配。

## 远程配置

`config.remoteConfigUrl` 指向一个 JSON（云开发静态托管 / 自己的 CDN 都行），
启动时拉一次、缓存 10 分钟，失败用上次缓存：

```json
{
  "roundSeconds": 20,
  "coinsPerScore": 1,
  "adsEnabled": true,
  "rewardMultiplier": 2,
  "features": { "share": false },
  "notice": ""
}
```

`adsEnabled: false` 是紧急刹车：出问题时不用发版就能停掉所有广告。

## 换玩法

1. 新建 `src/game/xxx.ts`，实现 `GameModule`（`start / update / render / onDown / stats / destroy`）。
2. `src/shell/scenes/play.ts` 里把 `createDemoGame` 换成你的工厂函数。
3. 觉得奖励位置不够就加 slot —— 只改 `ad-slots.ts`，玩法里调 `app.ad.showReward('xxx')` 的语义名。

玩法层不 import `wx`、不 import `AdManager`、不读写 storage，这是模板能复用的前提。

## 审核红线

- 不能「必须分享才能继续」，不能「分享到 N 个群解锁」；广告换奖励必须用户主动点击。
- 插屏不要盖住按钮、不要紧贴「再来一局」这类操作；本模板放在结算页出现后 700ms。
- `onShareAppMessage` 拿不到分享成功与否，不要拿它发奖。
- 游戏类目资质（软著 / 版号）以微信后台当期要求为准；纯广告无内购一般只要软著。

## M0 已知边界

- 没有分包 / CDN 资源加载、没有云存档、没有真人榜 —— 这些等品类定了再补。
- 音效是合成音，分享图用的是系统截图；正式项目换成美术资源即可。
- 游戏内 HUD 与场景切换是手写立即模式，不是 UI 框架；复杂 UI 建议直接在 `shell/` 里加场景。
- 浏览器预览只是调试用，广告、隐私、震动都走降级分支；真机行为要在开发者工具 + 真机上复核。
