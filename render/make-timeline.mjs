// Dump the timeline for a profile:  node render/make-timeline.mjs full 2026-10-22 > build/timeline.json
import { buildTimeline, daysUntil } from '../src/timeline.js';
const [profile = 'full', publish = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
console.log(JSON.stringify(buildTimeline(profile, { daysLeft: daysUntil(publish) }), null, 2));
