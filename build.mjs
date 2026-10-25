// 构建：src/main.ts -> dist/game.js（IIFE，小游戏直接执行）
//   node build.mjs            生产包（minify，无 sourcemap）
//   node build.mjs --watch    监听重建
//   node build.mjs --serve    浏览器预览（http://localhost:8080），便于不做真机也能调 UI
import * as esbuild from 'esbuild';
import { mkdir, copyFile, rm, writeFile } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const serve = process.argv.includes('--serve');
const prod = !watch && !serve;

await mkdir('dist', { recursive: true });

// 这些文件直接随包，不需要打包
for (const file of ['game.json', 'project.config.json']) {
  await copyFile(file, `dist/${file}`);
}

const options = {
  entryPoints: ['src/main.ts'],
  outfile: 'dist/game.js',
  bundle: true,
  format: 'iife',
  target: 'es2019',
  platform: 'neutral',
  minify: prod,
  sourcemap: prod ? false : 'inline',
  legalComments: 'none',
  define: { __DEV__: String(!prod) },
  logLevel: 'info',
};

// 浏览器预览需要一个 index.html（微信开发者工具不会读它）
const PREVIEW_HTML = `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>minigame preview</title>
<style>html,body{margin:0;height:100%;background:#0b0a12;overflow:hidden}
canvas{display:block;width:100%;height:100%;touch-action:none}</style>
<script src="game.js"></script>`;

if (serve) {
  await writeFile('dist/index.html', PREVIEW_HTML);
  // 每次重建都补一次：避免 dev 期间跑 npm run build 把预览页删掉后 404
  const ensurePreview = {
    name: 'ensure-preview',
    setup(build) {
      build.onEnd(async () => {
        await writeFile('dist/index.html', PREVIEW_HTML);
      });
    },
  };
  const ctx = await esbuild.context({ ...options, plugins: [ensurePreview] });
  await ctx.watch();
  const server = await ctx.serve({ servedir: 'dist', port: 8080 });
  console.log(`\n浏览器预览: http://localhost:${server.port}\n`);
} else if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  // serve 模式生成的预览页不属于小游戏包，正式构建时清掉
  await rm('dist/index.html', { force: true });
  await esbuild.build(options);
  console.log('build: dist/game.js + game.json + project.config.json');
}
