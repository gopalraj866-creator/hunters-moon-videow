// Per-scene frame-time profiler:  node render/profile.mjs [--res 1080p] [--samples 4]
import puppeteer from 'puppeteer';
import { startServer } from './serve.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1]]); return a; }, []));
const [W, H] = ({ '1080p': [1920, 1080], '540p': [960, 540], '4k': [3840, 2160], shorts: [1080, 1920] })[args.res || '540p'];
const { srv, port } = await startServer(0);
const b = await puppeteer.launch({ headless: 'shell', executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=' + (process.env.GL_BACKEND || 'swiftshader'), '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], protocolTimeout: 0 });
const p = await b.newPage(); await p.setViewport({ width: W, height: H });
await p.goto(`http://127.0.0.1:${port}/?profile=${args.profile || (H > W ? 'short' : 'full')}&w=${W}&h=${H}&samples=${args.samples ?? 0}&capture=1`);
await p.waitForFunction('window.__ready'); await p.evaluate(() => window.__init());
const tl = await p.evaluate(() => window.__timeline); const fps = 30;
for (const e of tl.entries) {
  const t = e.start + e.dur * 0.4, f = Math.round(t * fps);
  await p.evaluate((f) => window.__frame(f), f);
  const t0 = Date.now(); for (let i = 0; i < 2; i++) { await p.evaluate((f) => window.__frame(f), f + i); await p.screenshot({ type: 'png', optimizeForSpeed: true }); }
  console.log(`${e.id.padEnd(8)} ${e.scene.padEnd(10)} ${((Date.now() - t0) / 2000).toFixed(2)} s/frame`);
}
await b.close(); srv.close();
