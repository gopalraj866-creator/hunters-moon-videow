#!/usr/bin/env node
// Generates YouTube-ready metadata + captions:  node render/metadata.mjs --publish 2026-10-22 --out dist
import fs from 'node:fs';
import path from 'node:path';
import { buildTimeline, narrationOf, daysUntil, daysPhrase } from '../src/timeline.js';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, r) => { if (x.startsWith('--')) a.push([x.slice(2), r[i + 1]]); return a; }, []));
const publish = args.publish || new Date().toISOString().slice(0, 10);
const outDir = path.resolve(args.out || 'dist'); fs.mkdirSync(outDir, { recursive: true });
const buildDir = path.resolve(args.build || 'build');
const days = daysUntil(publish);
const full = buildTimeline('full', { daysLeft: days }), short = buildTimeline('short', { daysLeft: days });
const ts = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const srtT = (s) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000), r = ms % 1000; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(r).padStart(3, '0')}`; };

for (const [name, tl] of [['full', full], ['short', short]]) {
  const real = path.join(buildDir, `lines_${name}.json`);
  const lines = fs.existsSync(real) ? JSON.parse(fs.readFileSync(real, 'utf8')) : narrationOf(tl).map((l) => ({ text: l.text, start: l.t, end: l.t + Math.min(l.maxDur, l.text.split(' ').length * 0.4) }));
  let srt = '', vtt = 'WEBVTT\n\n';
  lines.forEach((l, i) => {
    // split long lines into ≤ 2 caption rows of ~42 chars
    const words = l.text.split(' '), rows = []; let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > 42) { rows.push(cur.trim()); cur = w; } else cur += ' ' + w; }
    if (cur.trim()) rows.push(cur.trim());
    const text = rows.join('\n');
    srt += `${i + 1}\n${srtT(l.start)} --> ${srtT(l.end)}\n${text}\n\n`;
    vtt += `${srtT(l.start).replace(',', '.')} --> ${srtT(l.end).replace(',', '.')}\n${text}\n\n`;
  });
  fs.writeFileSync(path.join(outDir, `captions_${name}.srt`), srt);
  fs.writeFileSync(path.join(outDir, `captions_${name}.vtt`), vtt);
}

const chapters = full.entries.map((e) => `${ts(e.start)} ${e.chapter}`).join('\n');
const d = daysPhrase(days);
const countdown = days > 1 ? `${days} days` : days === 1 ? 'tomorrow' : days === 0 ? 'tonight' : 'now';
const md = `# Upload kit — Hunter's Moon 2026 (publish date ${publish}, ${countdown} before the peak)

## Title options (pick one; first ~60 characters matter most)
1. Hunter's Moon 2026: Oct 26 — Date, Time, Meaning & How to Watch 🌕
2. ${days > 1 ? days + ' Days Until' : 'Get Ready for'} the HUNTER'S MOON 🌕 Everything You Need to Know
3. The Hunter's Moon Is Coming — What Makes It Special? (Oct 26, 2026)

**Shorts title:** ${days > 1 ? "Hunter's Moon in " + days + ' days' : "Hunter's Moon this week"} 🌕 Here's when to look up #shorts

## Description (paste)
${days > 1 ? `The Hunter's Moon is only ${days} days away!` : "The Hunter's Moon is almost here!"} This full Moon peaks on Monday, October 26, 2026 at 04:12 UTC — here's the date in your time zone, why it's called the Hunter's Moon, the real Moon facts, and the sky events happening around it.

🌕 PEAK TIME (04:12 UTC, Oct 26): 9:12 PM Oct 25 Los Angeles · 12:12 AM New York · 4:12 AM London · 9:42 AM India · 1:12 PM Tokyo · 3:12 PM Sydney
The Moon looks full for ~3 nights, so evening of Oct 25 or 26 at moonrise is a great time to look.

CHAPTERS
${chapters}

SKY CALENDAR: Orionids peak Oct 21–22 · Moon near Saturn Oct 22–24 · Hunter's Moon Oct 26 · Moon passes the Pleiades Oct 27–28 · Next full Moon Nov 24.

👇 Where will you be watching from? Tell us in the comments!
🔔 Subscribe for more skywatching guides.

Sources: Old Farmer's Almanac, Farmers' Almanac, NASA, Space.com, Star Walk, TheSkyLive, Time and Date.
#HuntersMoon #FullMoon #Astronomy #MoonWatching #October2026

## Tags
hunter's moon, hunters moon 2026, october full moon, full moon october 2026, hunter's moon 2026, when is the hunters moon, full moon, moon, astronomy, skywatching, night sky, harvest moon vs hunters moon, orionids, pleiades, moonrise

## Pinned comment
Where will you be watching the Hunter's Moon from? 🌕 Drop your city below — and tell us if the sky is clear!

## Engagement checklist
- [ ] Upload as a **Premiere** scheduled for the evening before the event (adds a live chat + countdown).
- [ ] Custom thumbnail: \`dist/thumbnail_*.png\` (contains the "${d.chip}" chip — re-render with --publish for each day).
- [ ] Upload captions: \`captions_full.srt\` (and \`captions_short.srt\` for the Short).
- [ ] Add the 'Shorts' file separately; link the long video in the Short's description.
- [ ] Add an end screen (last 20 s) and a pinned comment.
- [ ] Re-render with a later --publish date to refresh the "IN N DAYS" countdown text on re-uploads.

## Fact sources used on screen
- Peak 04:12 UTC Oct 26, 2026; distance 368,872 km; Aries; mag −12.7 — TheSkyLive, Old Farmer's Almanac, Star Walk
- Name origin / OED 1710 / alternate names — NASA, Farmers' Almanac, Time and Date
- No lunar eclipse on Oct 26; moonrise ~30 min later per night; Orionids Oct 21–22; Pleiades Oct 26–28 — Farmers' Almanac, Space.com
- 2026 supermoons in Jan, Nov, Dec — CNN/EarthSky
`;
fs.writeFileSync(path.join(outDir, 'upload_kit.md'), md);
console.log('[metadata] wrote', path.join(outDir, 'upload_kit.md'), '+ captions');
