#!/usr/bin/env node
// Concatenate shard segments (stream copy) and mux the soundtrack.
//   node render/assemble.mjs --segments build/segs --audio build/audio_full.m4a --out dist/HuntersMoon_1080p.mp4
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, r) => { if (x.startsWith('--')) a.push([x.slice(2), r[i + 1]]); return a; }, []));
const segDir = path.resolve(args.segments || 'build/segs');
const files = fs.readdirSync(segDir).filter((f) => /^seg_\d+\.mp4$/.test(f)).sort();
if (!files.length) { console.error('no segments in', segDir); process.exit(1); }
const list = path.join(segDir, 'concat.txt');
fs.writeFileSync(list, files.map((f) => `file '${path.join(segDir, f)}'`).join('\n'));
fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
const probe = (f) => parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim());
const dur = String(files.reduce((t, f) => t + probe(path.join(segDir, f)), 0));
console.log(`[assemble] ${files.length} segments, video ${parseFloat(dur).toFixed(2)}s`);
const a = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
if (args.audio && fs.existsSync(args.audio)) a.push('-i', args.audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-af', 'apad', '-t', dur);
else a.push('-c:v', 'copy');
a.push('-movflags', '+faststart', '-metadata', `title=${args.title || "Hunter's Moon 2026"}`, '-metadata', 'comment=Rendered with Three.js / WebGL', path.resolve(args.out));
const r = spawnSync('ffmpeg', a, { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);
console.log('[assemble] wrote', args.out, (fs.statSync(args.out).size / 1e6).toFixed(1) + ' MB');
