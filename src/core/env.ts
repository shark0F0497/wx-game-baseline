/** 构建期注入：node build.mjs --serve/--watch 为 true，生产包为 false */
export const DEV: boolean = typeof __DEV__ === 'undefined' ? true : __DEV__;
