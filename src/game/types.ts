/**
 * 玩法契约：模板只认这 6 个方法。
 * 新游戏 = 新写一个 createXxxGame()，别的方法都不用改。
 */
export interface GameCtx {
  w: number;
  h: number;
  safeTop: number;
}

export interface GameStats {
  score: number;
  combo: number;
}

export interface GameModule {
  start(): void;
  update(dt: number): void;
  render(g: CanvasRenderingContext2D): void;
  /** 返回 true 表示这次点击吃到了（shell 用它触发震动/音效） */
  onDown(x: number, y: number): boolean;
  stats(): GameStats;
  destroy(): void;
}
