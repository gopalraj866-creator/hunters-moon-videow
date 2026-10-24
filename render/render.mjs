#!/usr/bin/env node
// Deterministic frame-by-frame renderer: headless Chrome (WebGL via SwiftShader or a real GPU) -> ffmpeg.
//
//   node render/render.mjs --res 1080p [--shard 0 --shards 20] [--fps 30] [--publish 2026-10-22]
//   node render/render.mjs --res 4k
//   node render/render.mjs --res shorts            (1080x1920, 58 s, 9:16)
//   node render/render.mjs --res 1080p --still 12,60,150 --out build/stills
//   node render/render.mjs --res 1080p --limit 10   (render only first 10 s - quick smoke test)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startServer } from './serve.mjs';
import puppeteer from 'puppeteer';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => {
  if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return a;
}, []));

const RES = { '1080p': [1920, 1080, 'full'], '4k': [3840, 2160, 'full'], '720p': [1280, 720, 'full'], '540p': [960, 540, 'full'], shorts: [1080, 1920, 'short'], thumb: [1920, 1080, 'thumb'], thumb4k: [3840, 2160, 'thumb'] };
const resName = args.res || '1080p';
if (!RES[resName]) throw new Error('unknown --res ' + resName);
const [W, H, defaultProfile] = RES[resName];
const profile = args.profile || defaultProfile;
const fps = parseInt(args.fps || (resName === '4k' ? '30' : '30'));
const publish = args.publish || new Date().toISOString().slice(0, 10);
const daysLeft = Math.round((Date.parse('2026-10-26T00:00:00Z') - Date.parse(publish + 'T00:00:00Z')) / 86400000);
const outDir = path.resolve(args.out || 'build');
const fmt = args.format || (Math.max(W, H) >= 3000 ? 'jpeg' : 'png');
fs.mkdirSync(outDir, { recursive: true });

const { srv, port } = await startServer(0);
const launch = {
  headless: process.env.HEADLESS === 'new' ? true : 'shell',
  executablePath: process.env.CHROME_PATH || undefined,
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio',
    '--use-gl=angle', '--use-angle=' + (process.env.GL_BACKEND || 'swiftshader'), '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--enable-webgl', '--enable-gpu-rasterization', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--window-size=${W},${H}`,
  ],
  protocolTimeout: 0,
};
const browser = await puppeteer.launch(launch);
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[page error]', e.message));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || /error|warn/i.test(t)) console.error('[page]', t.slice(0, 300)); });
const samples = args.samples ?? 0;
await page.goto(`http://127.0.0.1:${port}/?profile=${profile}&w=${W}&h=${H}&fps=${fps}&days=${daysLeft}&samples=${samples}&capture=1`, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
const info = await page.evaluate(() => window.__init());
console.log(`[render] ${resName} ${W}x${H} profile=${profile} fps=${fps} frames=${info.frames} (${info.total}s) daysLeft=${daysLeft}`);

const snap = async () => page.screenshot({ type: fmt === 'jpeg' ? 'jpeg' : 'png', quality: fmt === 'jpeg' ? 96 : undefined, optimizeForSpeed: true, captureBeyondViewport: false, clip: { x: 0, y: 0, width: W, height: H } });

if (args.still) {
  // --still 12,60,150 = seconds
  for (const s of String(args.still).split(',').map(Number)) {
    await page.evaluate((f) => window.__frame(f), Math.round(s * fps));
    const f = path.join(outDir, `still_${resName}_${String(s).padStart(5, '0')}s.png`);
    fs.writeFileSync(f, await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } }));
    console.log('[still]', f);
  }
  await browser.close(); srv.close(); process.exit(0);
}

if (profile === 'thumb') {
  await page.evaluate(() => window.__frame(0));
  const f = path.join(outDir, `thumbnail_${W}x${H}.png`);
  fs.writeFileSync(f, await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } }));
  console.log('[thumb]', f);
  await browser.close(); srv.close(); process.exit(0);
}

let total = info.frames;
if (args.limit) total = Math.min(total, Math.round(parseFloat(args.limit) * fps));
const shards = parseInt(args.shards || '1'), shard = parseInt(args.shard || '0');
const per = Math.ceil(total / shards);
const f0 = shard * per, f1 = Math.min(total, f0 + per);
const segFile = path.join(outDir, shards > 1 ? `seg_${String(shard).padStart(3, '0')}.mp4` : `video_${resName}.mp4`);
console.log(`[render] shard ${shard + 1}/${shards}: frames ${f0}..${f1 - 1} -> ${segFile}`);

const crf = args.crf || (resName === '4k' ? '15' : '16');
const ff = spawn('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', fmt === 'jpeg' ? 'mjpeg' : 'png', '-i', '-',
  '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', args.preset || (resName === '4k' ? 'medium' : 'slow'), '-crf', crf,
  '-profile:v', 'high', '-level', resName === '4k' ? '5.1' : '4.2', '-g', String(fps * 2), '-keyint_min', String(fps * 2), '-sc_threshold', '0',
  '-x264-params', 'open-gop=0', '-bf', '2', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-movflags', '+faststart', '-an', segFile,
], { stdio: ['pipe', 'inherit', 'inherit'] });
ff.on('error', (e) => { console.error('ffmpeg failed to start', e); process.exit(2); });
const ffDone = new Promise((res) => ff.on('close', res));

const t0 = Date.now();
for (let i = f0; i < f1; i++) {
  await page.evaluate((f) => window.__frame(f), i);
  const buf = await snap();
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  const done = i - f0 + 1;
  if (done % 10 === 0 || i === f1 - 1) {
    const el = (Date.now() - t0) / 1000, rate = done / el, eta = (f1 - f0 - done) / rate;
    console.log(`[render] ${done}/${f1 - f0}  ${rate.toFixed(2)} fps  elapsed ${(el / 60).toFixed(1)}m  eta ${(eta / 60).toFixed(1)}m`);
  }
}
ff.stdin.end();
const code = await ffDone;
await browser.close(); srv.close();
if (code !== 0) { console.error('ffmpeg exit', code); process.exit(code); }
console.log('[render] done', segFile);
