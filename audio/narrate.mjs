#!/usr/bin/env node
// Builds the final soundtrack: narration (TTS) over the synthesised score, with sidechain ducking.
//   node audio/narrate.mjs --profile full --provider edge --voice en-GB-RyanNeural --publish 2026-10-22
// providers: edge (Microsoft neural voices via `pip install edge-tts`, best quality, needs internet)
//            espeak (offline fallback, robotic) | test (tones, for pipeline tests) | none (music only)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildTimeline, narrationOf, daysUntil } from '../src/timeline.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, r) => { if (x.startsWith('--')) a.push([x.slice(2), r[i + 1]]); return a; }, []));
const profile = args.profile || 'full';
const publish = args.publish || new Date().toISOString().slice(0, 10);
const provider = args.provider || 'edge';
const voice = args.voice || 'en-GB-RyanNeural';
const rate = args.rate || '-4%';
const outDir = path.resolve(args.out || 'build');
const linesDir = path.join(outDir, `lines_${profile}`);
fs.mkdirSync(linesDir, { recursive: true });
const music = args.music || path.join(outDir, `music_${profile}.wav`);
const tl = buildTimeline(profile, { daysLeft: daysUntil(publish) });
const lines = provider === 'none' ? [] : narrationOf(tl);

const run = (cmd, a, opt = {}) => spawnSync(cmd, a, { encoding: 'utf8', ...opt });
const dur = (f) => parseFloat(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout);

// ---- synthesise each line
const made = [];
for (let i = 0; i < lines.length; i++) {
  const L = lines[i], base = path.join(linesDir, String(i).padStart(3, '0'));
  let f = null;
  if (provider === 'edge') {
    fs.writeFileSync(base + '.txt', L.text);
    for (let attempt = 1; attempt <= 4 && !f; attempt++) {
      const r = run(args.edgebin || 'edge-tts', ['--voice', voice, `--rate=${rate}`, '--file', base + '.txt', '--write-media', base + '.mp3']);
      if (r.status === 0 && fs.existsSync(base + '.mp3') && fs.statSync(base + '.mp3').size > 2000) f = base + '.mp3';
      else { console.warn(`[tts] line ${i} attempt ${attempt} failed: ${(r.stderr || r.error || '').toString().slice(0, 160)}`); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * attempt); }
    }
  } else if (provider === 'espeak') {
    const r = run('espeak-ng', ['-v', 'en-us+m3', '-s', '150', '-w', base + '.wav', L.text]); if (r.status === 0) f = base + '.wav';
  } else if (provider === 'test') {
    const words = L.text.split(/\s+/).length;
    run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `sine=frequency=${180 + (i % 5) * 30}:duration=${(words * 0.36).toFixed(2)}`, '-af', 'volume=0.2', base + '.wav']); f = base + '.wav';
  }
  if (!f) { console.warn(`[tts] skipping line ${i}: "${L.text.slice(0, 50)}…"`); continue; }
  made.push({ ...L, file: f, raw: dur(f) });
  if (i % 10 === 0) console.log(`[tts] ${i + 1}/${lines.length}`);
}

// ---- schedule sequentially, never overlapping; speed up slightly if a line overruns its card
let cursor = 0;
const sched = made.map((m) => {
  const start = Math.max(m.t, cursor);
  const window = Math.max(2.5, m.maxDur - 0.4);
  const tempo = Math.min(1.3, Math.max(1, m.raw / window));
  const d = m.raw / tempo;
  cursor = start + d + 0.25;
  return { ...m, start, tempo, end: start + d };
});
fs.writeFileSync(path.join(outDir, `lines_${profile}.json`), JSON.stringify(sched.map(({ text, start, end }) => ({ text, start, end })), null, 2));
const overrun = sched.filter((s) => s.end > tl.total - 0.5);
if (overrun.length) console.warn(`[tts] WARNING: ${overrun.length} line(s) run past the end of the video`);

// ---- mix
const inputs = ['-i', music, ...sched.flatMap((s) => ['-i', s.file])];
const F = [];
F.push(`[0:a]volume=${args.musicGain || 0.8},atrim=0:${tl.total + 3}[m]`);
sched.forEach((s, i) => F.push(`[${i + 1}:a]${s.tempo > 1.001 ? `atempo=${s.tempo.toFixed(3)},` : ''}aresample=44100,aformat=channel_layouts=stereo,highpass=f=70,adelay=${Math.round(s.start * 1000)}|${Math.round(s.start * 1000)},volume=1.5[n${i}]`));
let chain;
if (sched.length) {
  F.push(`${sched.map((_, i) => `[n${i}]`).join('')}amix=inputs=${sched.length}:normalize=0:dropout_transition=0,asplit=2[narr][sc]`);
  F.push('[m][sc]sidechaincompress=threshold=0.015:ratio=9:attack=25:release=700:makeup=1[duck]');
  F.push('[duck][narr]amix=inputs=2:normalize=0[mix]');
  chain = '[mix]';
} else chain = '[m]';
F.push(`${chain}alimiter=limit=0.95,loudnorm=I=-15:TP=-1.5:LRA=11,atrim=0:${tl.total}[out]`);
const script = path.join(outDir, `mix_${profile}.filter`);
fs.writeFileSync(script, F.join(';\n'));
const outFile = path.join(outDir, `audio_${profile}.m4a`);
const r = run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex_script', script, '-map', '[out]', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', outFile]);
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
console.log(`[audio] ${outFile}  ${dur(outFile).toFixed(1)}s  (${sched.length}/${lines.length} narration lines, provider=${provider})`);
