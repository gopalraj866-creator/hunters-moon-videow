#!/usr/bin/env node
// Original, copyright-free ambient score synthesised from scratch (no samples, no downloads).
// node audio/make-music.mjs --profile full --out build/music_full.wav --publish 2026-10-22
import fs from 'node:fs';
import path from 'node:path';
import { buildTimeline, daysUntil } from '../src/timeline.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, r) => { if (x.startsWith('--')) a.push([x.slice(2), r[i + 1]]); return a; }, []));
const profile = args.profile || 'full';
const publish = args.publish || new Date().toISOString().slice(0, 10);
const tl = buildTimeline(profile, { daysLeft: daysUntil(publish) });
const SR = 44100, DUR = tl.total + 3;
const N = Math.floor(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);

let seed = 1337; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const TAU = Math.PI * 2;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Slow progression in A minor (MIDI notes): Am9 - Fmaj7 - Cadd9 - G6 ... each chord ~ barLen seconds
const CHORDS = [[45, 57, 60, 64, 71], [41, 53, 57, 60, 67], [48, 55, 60, 64, 67], [43, 55, 59, 62, 64], [45, 57, 60, 64, 67], [41, 53, 57, 64, 69], [43, 55, 62, 67, 71], [40, 52, 59, 64, 67]];
const barLen = profile === 'short' ? 7.2 : 16;
const PENT = [69, 72, 74, 76, 79, 81, 84, 88];

// intensity envelope over the video (0..1): quiet intro, rises to the title, calm through explanations, lifts at CTA
const intensity = (t) => {
  if (profile === 'short') return 0.55 + 0.45 * sm(0, 6, t) ;
  return 0.35 + 0.35 * sm(0, 10, t) + 0.25 * sm(9, 12, t) * (1 - sm(14, 30, t)) + 0.12 * Math.sin(t / 37) + 0.25 * sm(tl.total - 30, tl.total - 15, t);
};

function addVoice(start, dur, freq, amp, { pan = 0, detune = 0.004, atk = 3, rel = 4, cutoff = 900, lfo = 0.07, saw = true }) {
  const i0 = Math.floor(start * SR), n = Math.floor((dur + rel) * SR);
  const ph = [rnd(), rnd(), rnd()], dt = [1 - detune, 1, 1 + detune];
  let lp = 0;
  for (let i = 0; i < n && i0 + i < N; i++) {
    const t = i / SR;
    const env = Math.min(1, t / atk) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / rel));
    let s = 0;
    for (let k = 0; k < 3; k++) {
      ph[k] += (freq * dt[k]) / SR; ph[k] -= Math.floor(ph[k]);
      s += saw ? (2 * ph[k] - 1) * 0.6 + Math.sin(TAU * ph[k]) * 0.4 : Math.sin(TAU * ph[k]);
    }
    const c = cutoff * (0.7 + 0.3 * Math.sin(TAU * lfo * (start + t)));
    const a = 1 - Math.exp(-TAU * c / SR);
    lp += a * (s - lp);
    const v = lp * amp * env * (0.4 + 0.6 * intensity(start + t));
    L[i0 + i] += v * (1 - pan) * 0.5 * 2 / 2 * (1 + (pan < 0 ? -pan : 0));
    R[i0 + i] += v * (1 + pan) * 0.5;
  }
}
function addBell(start, freq, amp, pan) {
  const i0 = Math.floor(start * SR), n = Math.floor(7 * SR);
  for (let i = 0; i < n && i0 + i < N; i++) {
    const t = i / SR, e = Math.exp(-t * 0.9) * Math.min(1, t / 0.004);
    const s = Math.sin(TAU * freq * t) + 0.35 * Math.sin(TAU * freq * 2.76 * t) * Math.exp(-t * 3) + 0.2 * Math.sin(TAU * freq * 5.4 * t) * Math.exp(-t * 6);
    const v = s * e * amp;
    L[i0 + i] += v * (1 - pan) * 0.5; R[i0 + i] += v * (1 + pan) * 0.5;
  }
}
function addImpact(start, amp = 1) {
  const i0 = Math.floor(start * SR), n = Math.floor(6 * SR);
  let lp = 0;
  for (let i = 0; i < n && i0 + i < N; i++) {
    const t = i / SR;
    const f = 48 * Math.exp(-t * 0.55) + 28;
    const s = Math.sin(TAU * f * t) * Math.exp(-t * 0.8) * 0.9;
    lp += 0.02 * ((rnd() * 2 - 1) - lp);
    const v = (s + lp * 3.0 * Math.exp(-t * 2.2)) * amp * 0.9;
    L[i0 + i] += v; R[i0 + i] += v;
  }
}
function addRiser(start, dur, amp = 0.5) {
  const i0 = Math.floor(start * SR), n = Math.floor(dur * SR);
  let lp = 0, ph = 0;
  for (let i = 0; i < n && i0 + i < N; i++) {
    const x = i / n, e = x * x * (3 - 2 * x), t = i / SR;
    const c = 0.01 + 0.35 * e * e; lp += c * ((rnd() * 2 - 1) - lp);
    ph += (110 + 880 * e * e) / SR; const tone = Math.sin(TAU * ph) * 0.25 * e;
    const v = (lp * 1.6 + tone) * e * amp * (i > n - 0.15 * SR ? (n - i) / (0.15 * SR) : 1);
    L[i0 + i] += v; R[i0 + i] += v;
  }
}

// --- pads + sub on the chord progression
const nBars = Math.ceil(DUR / barLen) + 1;
for (let b = 0; b < nBars; b++) {
  const ch = CHORDS[b % CHORDS.length], st = b * barLen;
  ch.forEach((m, k) => addVoice(st - 1.5, barLen + 3, mtof(m + (k > 1 ? 0 : 0)), k === 0 ? 0.20 : 0.075, { pan: (k - 2) * 0.28, atk: 3.2, rel: 4, cutoff: k === 0 ? 400 : 1300 + k * 200, lfo: 0.05 + k * 0.013, saw: k > 0 }));
  addVoice(st - 0.5, barLen + 1, mtof(ch[0] - 12), 0.16, { pan: 0, atk: 2, rel: 3, cutoff: 160, saw: false });
}
// --- shimmering bells (seeded random walk on a pentatonic scale)
let ni = 2;
for (let t = 3; t < DUR - 4; t += (profile === 'short' ? 1.4 : 3.2) + rnd() * 2.6) {
  if (rnd() < 0.7) { ni = Math.max(0, Math.min(PENT.length - 1, ni + (rnd() < 0.5 ? -1 : 1) * (1 + (rnd() < 0.3 ? 1 : 0)))); addBell(t, mtof(PENT[ni]), 0.045 * (0.5 + intensity(t)), rnd() * 1.6 - 0.8); }
}
// --- cinematic hits at key moments
const hits = [];
for (const e of tl.entries) {
  if (e.index > 0) hits.push([e.start - 1.0, 'rise']);
  if (e.index > 0) hits.push([e.start, 'impact', 0.55]);
}
if (profile === 'full') { hits.push([9.0, 'rise']); hits.push([10.4, 'impact', 1.0]); }
for (const h of hits) { if (h[0] < 0) continue; if (h[1] === 'rise') addRiser(h[0], 1.0, 0.18); else addImpact(h[0], h[2]); }
if (profile === 'full') { addRiser(tl.total - 22, 6, 0.25); addImpact(tl.total - 15 + 0.8, 0.8); }
if (profile === 'short') { addRiser(0, 0.1, 0.0); addImpact(0.1, 0.9); addImpact(tl.total - 3, 0.7); }

// --- reverb-ish (multi-tap feedback comb) + master
const taps = [[0.093, 0.42], [0.157, 0.36], [0.231, 0.3], [0.379, 0.24], [0.563, 0.18]];
const wetL = new Float32Array(N), wetR = new Float32Array(N);
for (const [d, g] of taps) {
  const ds = Math.floor(d * SR), dsR = Math.floor((d * 1.07) * SR);
  for (let i = ds; i < N; i++) wetL[i] += L[i - ds] * g;
  for (let i = dsR; i < N; i++) wetR[i] += R[i - dsR] * g;
}
let lpL = 0, lpR = 0, peak = 0;
for (let i = 0; i < N; i++) {
  lpL += 0.12 * (wetL[i] - lpL); lpR += 0.12 * (wetR[i] - lpR);
  L[i] += lpL * 0.9; R[i] += lpR * 0.9;
}
const fadeIn = 2.0, fadeOut = 2.5;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = sm(0, fadeIn, t) * (1 - sm(tl.total - fadeOut, tl.total + 1.5, t));
  L[i] = Math.tanh(L[i] * 1.4) * g; R[i] = Math.tanh(R[i] * 1.4) * g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.85 / peak;
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), 44 + i * 4); out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), 46 + i * 4); }
const f = args.out || `build/music_${profile}.wav`;
fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, out);
console.log(`[music] ${f}  ${DUR.toFixed(1)}s`);
