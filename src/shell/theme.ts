/** 视觉常量：沿用笔记库的 EVA 赛璐璐配色，纯色 + 硬边，不用圆角卡片 */
export const C = {
  bg: '#1d1a2f',
  bgDeep: '#0f0d1a',
  panel: '#241f38',
  ink: '#0b0a12',
  paper: '#f2ede4',
  dim: 'rgba(242, 237, 228, 0.55)',
  faint: 'rgba(242, 237, 228, 0.16)',
  acid: '#8bd450',
  warn: '#f5c024',
  violet: '#5f2a62',
  orange: '#f47a16',
  black: '#000000',
};

export function font(size: number, weight: number | string = 400): string {
  // 小游戏环境只有系统字体，别指望 webfont
  return `${weight} ${size}px "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif`;
}

export function mono(size: number, weight: number | string = 700): string {
  return `${weight} ${size}px "SF Mono", "Cascadia Mono", Consolas, monospace`;
}
