import type { AdManager } from '../core/ad/manager';
import type { SfxName } from '../core/audio';
import type { GameConfig } from '../config/game-config';
import type { Viewport } from '../core/viewport';

export type TouchPhase = 'start' | 'move' | 'end';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RunResult {
  score: number;
  coins: number;
  /** 这一局是否由复活续上的（决定要不要弹插屏 / 计局数） */
  revived: boolean;
  /** 是否刷新最高分，由 App.finishRun 写入 */
  record?: boolean;
}

export interface RunState {
  coins: number;
  best: number;
  runs: number;
  haptics: boolean;
  sound: boolean;
}

export interface Scene {
  enter?(): void;
  exit?(): void;
  update(dt: number): void;
  render(g: CanvasRenderingContext2D): void;
  onTouch(phase: TouchPhase, x: number, y: number): void;
}

/**
 * 场景能看到的全部能力。玩法 / UI 都只依赖这个接口，
 * 不直接 import AdManager 的内部实现，也不直接读 storage。
 */
export interface AppApi {
  vp: Viewport;
  ad: AdManager;
  config: GameConfig;
  state: RunState;

  saveState(): void;
  toast(msg: string): void;
  track(name: string, props?: Record<string, unknown>): void;

  setScene(scene: Scene): void;
  startRun(): void;
  finishRun(result: RunResult): void;
  reviveRun(score: number): void;
  addCoins(n: number): void;

  openSettings(): void;
  closeOverlay(): void;

  sfx(name: SfxName): void;
  setSound(on: boolean): void;
  share(): void;

  /** 'MOCK' / 'LIVE' / 'OFF'，给 UI 一个诚实的角标 */
  adsLabel(): string;
}
