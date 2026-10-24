import { windowInfo } from './platform';

/**
 * 逻辑坐标系：宽固定 375，高按屏幕比例（竖屏）。
 * 所有绘制 / 命中判定都用逻辑坐标，设备适配只发生在 canvas 尺寸与 ctx 变换上。
 */
export class Viewport {
  readonly w = 375;
  readonly cssW: number;
  readonly cssH: number;
  readonly dpr: number;
  readonly h: number;
  /** 逻辑单位 -> canvas 像素 */
  readonly scale: number;
  readonly safeTop: number;
  readonly safeBottom: number;

  constructor() {
    const info = windowInfo();
    this.cssW = info.cssW;
    this.cssH = info.cssH;
    this.dpr = info.dpr;
    this.h = Math.max(480, Math.round((info.cssW > 0 ? info.cssH / info.cssW : 1.78) * this.w));
    this.scale = (info.cssW * info.dpr) / this.w;
    this.safeTop = (info.safeTop * this.w) / info.cssW;
    this.safeBottom = (info.safeBottom * this.w) / info.cssW;
  }

  toX(cssX: number): number {
    return (cssX * this.w) / this.cssW;
  }

  toY(cssY: number): number {
    return (cssY * this.h) / this.cssH;
  }
}
