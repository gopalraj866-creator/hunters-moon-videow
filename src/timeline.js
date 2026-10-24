// DOM-free: imported by the browser renderer AND by Node (audio / metadata scripts).
// Single source of truth for scene order, durations, on-screen cards and narration.
//
// FACT SOURCES (researched Oct 22, 2026):
//  - Full Moon peak: Mon Oct 26 2026 04:12 UTC (Old Farmer's Almanac, Farmers' Almanac, TheSkyLive, Star Walk)
//  - Distance 368,872 km, apparent diameter 32.38', magnitude -12.69, RA 01h56m Dec +16 (TheSkyLive)
//  - Name origin, moon "rises near dusk several nights in a row" (Star Walk / Almanac / NASA)
//  - "Hunter's Moon" earliest OED citation 1710 (NASA, Old Farmer's Almanac)
//  - Moonrise only ~30 min later per night in autumn (Farmers' Almanac)
//  - No lunar eclipse on Oct 26 2026 (Farmers' Almanac)
//  - 2026 supermoons: Jan, Nov, Dec (CNN / AOL / EarthSky) -> October is NOT one
//  - Orionids peak Oct 21-22 (~20/hr), Moon near Saturn Oct 22-24, Moon & Pleiades Oct 26-28 (Space.com, Farmers' Almanac, whenthecurveslineup)
//  - Next full Moon Nov 24 2026 (Star Walk)

export const EVENT_ISO = '2026-10-26T04:12:00Z';
export const EVENT_DATE = '2026-10-26';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

export function daysUntil(publishISO) {
  const a = Date.parse(publishISO.slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse(EVENT_DATE + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

export function daysPhrase(days) {
  if (days > 1) return { big: `IN ${days} DAYS`, chip: `${days} DAYS TO GO`, say: `In just ${WORDS[days] ?? days} days` };
  if (days === 1) return { big: 'TOMORROW NIGHT', chip: 'TOMORROW NIGHT', say: 'Tomorrow night' };
  if (days === 0) return { big: 'TONIGHT', chip: 'TONIGHT', say: 'Tonight' };
  return { big: 'RIGHT NOW', chip: 'RISING NOW', say: 'Right now' };
}

const TIMES = [
  ['Los Angeles', '9:12 PM  ·  Oct 25'],
  ['New York', '12:12 AM  ·  Oct 26'],
  ['London', '4:12 AM  ·  Oct 26'],
  ['Mumbai / Delhi', '9:42 AM  ·  Oct 26'],
  ['Tokyo', '1:12 PM  ·  Oct 26'],
  ['Sydney', '3:12 PM  ·  Oct 26'],
];

function fullProfile(cfg) {
  const d = daysPhrase(cfg.daysLeft);
  return [
    // ───────────────────────── 0:00  HOOK ─────────────────────────
    {
      id: 'hook', scene: 'landscape', dur: 25, chapter: 'Intro',
      params: { twi: [0.8, 0.35], moonEl: [-1.5, 16], moonAz: [-6, -2], cam: { z: [8, -22], y: 1.5, yaw: [0.02, -0.01], pitch: [0.0, 0.05] }, leaves: 1, geese: null, seed: 11 },
      cards: [
        { t0: 0.8, t1: 9.6, type: 'center', big: d.big, small: 'THE SKY GETS A VERY SPECIAL VISITOR',
          say: `${d.say}, the sky lights up with one of the brightest, most legendary full moons of the year.` },
        { t0: 10.4, t1: 23.5, type: 'title', kicker: 'FULL MOON  ·  OCTOBER 2026', title: "THE HUNTER'S MOON", sub: 'Monday, October 26, 2026',
          say: "The Hunter's Moon. Here's everything you need to know, and exactly when to look up." },
      ],
    },
    // ───────────────────────── 0:25  THE DATE ─────────────────────────
    {
      id: 'date', scene: 'orbit', dur: 35, chapter: 'When is the Hunter\'s Moon?',
      params: { mode: 'title', cam: 0 },
      cards: [
        { t0: 1.0, t1: 10.5, type: 'title', kicker: 'PEAK FULL PHASE', title: "THE HUNTER'S MOON", sub: 'Mon, Oct 26, 2026  ·  04:12 UTC',
          say: "The Hunter's Moon reaches full phase on Monday, October twenty-sixth, at 04:12 UTC." },
        { t0: 11.5, t1: 23.5, type: 'times', kicker: 'SAME INSTANT, EVERY CLOCK', rows: TIMES,
          say: "Wherever you are, the Moon is full at the very same instant. Only the clock changes. That's nine forty-two in the morning in India, and just after midnight in New York." },
        { t0: 24.5, t1: 34.0, type: 'lower', kicker: 'PRO TIP', title: 'It looks full for about 3 nights', body: 'Enjoy it the night before and the night after the peak, too.',
          say: "And you don't need the exact minute. The Moon looks full for about three nights, so you can enjoy it before and after the peak." },
      ],
    },
    // ───────────────────────── 1:00  NAME ─────────────────────────
    {
      id: 'name', scene: 'landscape', dur: 70, chapter: 'Why is it called the Hunter\'s Moon?',
      params: { twi: [0.9, 0.12], moonEl: [-1.0, 22], moonAz: [-8, 4], cam: { z: [6, -34], y: 1.7, yaw: [0.05, -0.04], pitch: [0.0, 0.07] }, leaves: 1, geese: { t0: 30, t1: 58 }, seed: 23 },
      cards: [
        { t0: 1.0, t1: 9.0, type: 'lower', kicker: 'THE NAME', title: "Why “Hunter's Moon”?", body: "It's the first full Moon after the Harvest Moon.",
          say: "So why is it called the Hunter's Moon? It's the first full Moon after the Harvest Moon." },
        { t0: 10.0, t1: 23.0, type: 'lower', kicker: 'THE FIELDS ARE BARE', title: 'Crops cleared. Game fattened.', body: 'Farmers had just emptied their fields, so hunters could easily spot deer and other animals ready for winter.',
          say: "By October, farmers had cleared their fields under the Harvest Moon. Hunters could finally spot deer and other animals, fattened up for the winter ahead." },
        { t0: 24.0, t1: 36.0, type: 'lower', kicker: 'EXTRA LIGHT AT DUSK', title: 'Moonrise right at sunset', body: 'For several nights in a row the Moon rises around dusk and shines until dawn.',
          say: "And here's the magic. For several nights in a row, the Moon rises right around dusk and shines until dawn, giving hunters extra light to work by." },
        { t0: 37.0, t1: 47.5, type: 'stat', kicker: 'EARLIEST WRITTEN USE', value: '1710', label: "First citation of “Hunter's Moon” in the Oxford English Dictionary",
          say: "The name goes back at least to the year seventeen ten, when it was first recorded in the Oxford English Dictionary." },
        { t0: 49.0, t1: 61.0, type: 'list', kicker: 'OTHER NAMES', title: 'One Moon, many names', items: ['Travel Moon', 'Dying Grass Moon', 'Falling Leaves Moon', 'Freezing Moon', 'Drying Rice Moon (Dakota)'], stagger: 1.1,
          say: "Across cultures it has many names: the Travel Moon, the Dying Grass Moon, the Falling Leaves Moon, and the Drying Rice Moon." },
        { t0: 62.0, t1: 69.5, type: 'center', big: 'NO ECLIPSE THIS TIME', small: "SOME CALL IT A “BLOOD MOON” — BUT THIS ONE IS A REGULAR FULL MOON",
          say: "Some call it a Blood Moon, but don't expect an eclipse this time. This one is a regular full moon." },
      ],
    },
    // ───────────────────────── 2:10  HARVEST VS HUNTER ─────────────────────────
    {
      id: 'orbit', scene: 'orbit', dur: 55, chapter: 'Harvest Moon vs Hunter\'s Moon',
      params: { mode: 'diagram' },
      cards: [
        { t0: 1.0, t1: 12.0, type: 'lower', kicker: 'HARVEST VS HUNTER', title: 'Two Moons, one season', body: "The Harvest Moon is the full Moon closest to the autumn equinox. In 2026 that was September's — so October's is the Hunter's Moon.",
          say: "The Harvest Moon is the full Moon closest to the autumn equinox. In twenty twenty-six that's September's, which makes October's full moon the Hunter's Moon." },
        { t0: 13.0, t1: 27.0, type: 'lower', kicker: 'THE MOON ORBITS EASTWARD', title: '~13° further east every night', body: 'Earth has to spin a little longer to catch up, so moonrise normally slips about 50 minutes later each night.',
          say: "Every night the Moon shifts about thirteen degrees along its orbit. Earth has to spin a bit longer to catch up, so moonrise normally slips later, by about fifty minutes." },
        { t0: 28.0, t1: 40.0, type: 'stat', kicker: 'IN AUTUMN IT\'S DIFFERENT', value: '~30 min', label: 'Typical moonrise delay between nights around now at mid-northern latitudes, because the Moon\'s path hugs the horizon at a shallow angle',
          say: "But around this time of year, the Moon's path hugs the horizon at a shallow angle. Moonrise comes only about thirty minutes later each night." },
        { t0: 41.0, t1: 53.0, type: 'lower', kicker: 'THE RESULT', title: 'Bright moonlight, night after night', body: 'Several evenings in a row with a big, bright Moon rising just as the Sun sets.',
          say: "The result? Several evenings in a row with a bright, full-looking Moon rising just as the Sun sets." },
      ],
    },
    // ───────────────────────── 3:05  MOONRISE TIME-LAPSE ─────────────────────────
    {
      id: 'lapse', scene: 'landscape', dur: 50, chapter: 'Five nights of moonrise (time-lapse)',
      params: { mode: 'timelapse', nights: 5, lapse: { t0: 9, per: 7.6 }, twi: [0.7, 0.2], moonEl: [0, 26], moonAz: [-5, -5], cam: { z: [-6, -10], y: 1.6, yaw: [0, 0], pitch: [0.03, 0.03] }, leaves: 0.6, geese: null, seed: 31 },
      cards: [
        { t0: 1.0, t1: 8.0, type: 'lower', kicker: 'TIME-LAPSE', title: 'Five nights of moonrise', body: 'Oct 23 → Oct 27 · the Moon keeps rising near dusk.',
          say: "Watch five nights of moonrise, compressed. Notice how little the rise time changes." },
        { t0: 40.5, t1: 49.0, type: 'lower', kicker: 'PHOTO TIP', title: 'Shoot at moonrise', body: 'Near the horizon the Moon can be framed with trees, hills or buildings for a dramatic sense of scale.',
          say: "Night five. Almost the same time, almost the same spot. Perfect for photography." },
      ],
      narration: [
        { t: 9.4, text: 'Night one.' },
        { t: 17.0, text: 'Night two, just thirty minutes later.' },
        { t: 24.6, text: 'Night three.' },
        { t: 32.2, text: 'Night four.' },
      ],
    },
    // ───────────────────────── 3:55  MOON TOUR ─────────────────────────
    {
      id: 'tour', scene: 'tour', dur: 95, chapter: 'A tour of the Moon',
      params: {},
      cards: [
        { t0: 1.0, t1: 12.0, type: 'stats', kicker: 'OCT 26  ·  04:12 UTC', title: 'The Moon by the numbers', stats: [['368,872 km', 'distance (229,207 mi)'], ['32.4′', 'apparent size'], ['−12.7', 'magnitude'], ['Aries', 'constellation']],
          say: "At the moment of full phase, the Moon will be about three hundred sixty-nine thousand kilometers away, shining at magnitude minus twelve point seven, in the constellation Aries." },
        { t0: 13.0, t1: 23.0, type: 'lower', kicker: 'NOT A SUPERMOON', title: 'Close, but not an official supermoon', body: "This year's supermoons fall in January, November and December.",
          say: "It's not an official supermoon. Those come in January, November and December this year. But it's still a big, bright full moon." },
        { t0: 24.0, t1: 37.0, type: 'lower', kicker: 'THE DARK PATCHES', title: "Lunar “seas” — made of lava", body: 'The maria (Latin for seas) are vast plains of ancient volcanic basalt that flooded giant impact basins billions of years ago.',
          say: "Those dark patches are called maria, Latin for seas. But they're not water. They're vast plains of ancient volcanic lava that flooded giant impact basins billions of years ago." },
        { t0: 38.0, t1: 49.0, type: 'lower', kicker: 'TRANQUILITY BASE', title: 'Apollo 11 landed here', body: 'Mare Tranquillitatis · July 20, 1969',
          say: "Right there, in the Sea of Tranquility, Apollo Eleven landed on July twentieth, nineteen sixty-nine, and humans took their first steps on another world." },
        { t0: 51.0, t1: 62.0, type: 'lower', kicker: 'TYCHO', title: 'A young crater with bright rays', body: 'About 85 km wide, roughly 108 million years old — its rays of debris stretch across the near side.',
          say: "Look south and you'll find Tycho, a crater about eighty-five kilometers wide, with bright rays of debris that spray across the near side." },
        { t0: 63.5, t1: 74.5, type: 'stat', kicker: 'AVERAGE DISTANCE', value: '384,400 km', label: 'And the Moon is drifting away from Earth by about 3.8 cm every year',
          say: "On average the Moon is three hundred eighty-four thousand kilometers from us, and it's slowly drifting away, about three point eight centimeters every year." },
        { t0: 76.0, t1: 86.0, type: 'lower', kicker: 'ALWAYS THE SAME FACE', title: 'Tidally locked', body: 'The Moon spins once for every orbit, so we only ever see the near side.',
          say: "And we always see the same face, because the Moon spins exactly once for every trip around Earth." },
        { t0: 87.5, t1: 93.5, type: 'center', big: 'WHAT ELSE IS UP THERE?', small: 'THE SKY HAS MORE PLANNED THIS WEEK',
          say: "Now let's look at what else the sky has planned." },
      ],
    },
    // ───────────────────────── 5:30  COLOUR & ILLUSION ─────────────────────────
    {
      id: 'colour', scene: 'landscape', dur: 50, chapter: 'Why does the Moon look orange and huge?',
      params: { twi: [0.55, 0.0], moonEl: [-1.0, 34], moonAz: [2, 12], cam: { z: [-8, -30], y: 1.4, yaw: [-0.03, 0.04], pitch: [0.02, 0.1] }, leaves: 0.7, geese: { t0: 34, t1: 48 }, seed: 47, exag: 3.6 },
      cards: [
        { t0: 1.0, t1: 13.0, type: 'lower', kicker: 'WHY ORANGE?', title: 'A low Moon shines through more air', body: 'Near the horizon the light crosses far more atmosphere. Blue is scattered away; the warm colors get through.',
          say: "Why does a rising Moon glow orange? Near the horizon its light cuts through much more atmosphere. Blue light is scattered away, and the warm colors get through." },
        { t0: 14.0, t1: 26.0, type: 'lower', kicker: 'THE MOON ILLUSION', title: "It isn't actually bigger", body: 'The Moon is about half a degree wide wherever it is. Your brain exaggerates it near the horizon.',
          say: "And that giant look? It's an illusion. The Moon is the same size in the sky all night. Your brain just exaggerates it near the horizon." },
        { t0: 27.0, t1: 39.0, type: 'lower', kicker: 'TRY IT TONIGHT', title: "Hold a pea at arm's length", body: 'It covers the Moon just the same, rising or high overhead.',
          say: "Here's a quick test. Hold a small pea at arm's length. It will cover the Moon both when it's rising and when it's high overhead." },
        { t0: 41.0, t1: 49.0, type: 'center', big: 'AMBER → PEARL', small: 'WATCH THE COLOR CHANGE AS IT CLIMBS' },
      ],
    },
    // ───────────────────────── 6:20  OTHER SKY EVENTS ─────────────────────────
    {
      id: 'sky', scene: 'skyevents', dur: 60, chapter: "What else is in the sky?",
      params: {},
      cards: [
        { t0: 1.0, t1: 8.0, type: 'lower', kicker: 'THE BIG PICTURE', title: 'A busy week in the sky', body: "The Hunter's Moon doesn't travel alone.",
          say: "The Hunter's Moon doesn't travel alone. Here's what to watch for around it." },
        { t0: 9.0, t1: 29.0, type: 'events', kicker: 'OCTOBER 2026 SKY CALENDAR', stagger: 3.6,
          items: [
            ['OCT 21–22', "Orionid meteors peak — debris of Halley's Comet"],
            ['OCT 22–24', 'Bright gibbous Moon passes near Saturn'],
            ['OCT 26  ·  04:12 UTC', "FULL HUNTER'S MOON"],
            ['OCT 27–28', 'Moon glides past the Pleiades (stars occulted from some regions)'],
            ['NOV 24', 'Next full Moon'],
          ],
          say: "Earlier in the week, the Orionid meteor shower peaks, thanks to debris from Halley's Comet. Then the gibbous Moon pairs up with Saturn. After full phase, it glides toward the Pleiades star cluster, and from some places it will pass right in front of those stars." },
        { t0: 31.0, t1: 42.0, type: 'lower', kicker: 'THE HUNTER IN THE SKY', title: 'Orion rises in the east', body: 'Look for the three stars of his belt, with red Betelgeuse above.',
          say: "And fittingly, Orion, the Hunter himself, climbs into the eastern sky later in the evening. Find the three stars of his belt." },
        { t0: 44.0, t1: 58.0, type: 'lower', kicker: 'HEADS UP', title: 'Bright Moon, faint meteors', body: 'Moonlight washes out most meteors, so the best meteor-watching is earlier in the week.',
          say: "A bright full Moon washes out faint stars and meteors. So the full moon is for moon-gazing, and a darker sky is better a few nights earlier." },
      ],
    },
    // ───────────────────────── 7:20  HOW TO WATCH ─────────────────────────
    {
      id: 'watch', scene: 'landscape', dur: 25, chapter: 'How to watch it',
      params: { twi: [0.6, 0.35], moonEl: [6, 15], moonAz: [-4, 2], cam: { z: [-20, -34], y: 1.6, yaw: [0.0, -0.03], pitch: [0.04, 0.07] }, leaves: 0.8, geese: null, seed: 61 },
      cards: [
        { t0: 1.0, t1: 13.5, type: 'steps', title: 'HOW TO WATCH', items: ['Find a clear view of the eastern horizon', 'Be outside around sunset — moonrise is near dusk', 'Check your local moonrise time (Stellarium, SkySafari)', 'Binoculars reveal the craters beautifully'], stagger: 2.0,
          say: "To watch, find a clear view of the eastern horizon and be outside around sunset. Check your local moonrise time in an app like Stellarium, and bring binoculars for the craters." },
        { t0: 15.0, t1: 24.0, type: 'lower', kicker: 'PHOTOGRAPHERS', title: 'Use a long lens', body: 'A telephoto lens makes the Moon huge. Add a tree line for scale.',
          say: "Photographers: a telephoto lens makes the Moon look huge, and a foreground like a tree line adds scale." },
      ],
    },
    // ───────────────────────── 7:45  OUTRO / CTA ─────────────────────────
    {
      id: 'outro', scene: 'orbit', dur: 15, chapter: 'See you under the Hunter\'s Moon',
      params: { mode: 'outro' },
      cards: [
        { t0: 0.8, t1: 14.0, type: 'cta', title: "SEE YOU UNDER THE HUNTER'S MOON", sub: 'Monday, October 26  ·  04:12 UTC', chips: ['SUBSCRIBE', 'SHARE WITH A SKYWATCHER'], ask: 'Where will you be watching from? Tell us in the comments.',
          say: "The Hunter's Moon peaks on Monday, October twenty-sixth. Tell me in the comments where you'll be watching from, and subscribe so you never miss a skywatching night. Clear skies!" },
      ],
    },
  ];
}

function shortProfile(cfg) {
  const d = daysPhrase(cfg.daysLeft);
  return [
    {
      id: 'hook', scene: 'landscape', dur: 6, chapter: 'Hook',
      params: { twi: [0.8, 0.4], moonEl: [-1.5, 12], moonAz: [-4, -2], cam: { z: [4, -10], y: 1.5, yaw: [0.0, 0.0], pitch: [0.0, 0.06] }, leaves: 1, geese: null, seed: 11 },
      cards: [{ t0: 0.3, t1: 5.6, type: 'center', big: d.big, small: "THE HUNTER'S MOON IS COMING", say: `${d.say}, the Hunter's Moon lights up the sky.` }],
    },
    {
      id: 'date', scene: 'orbit', dur: 9, chapter: 'Date',
      params: { mode: 'title', cam: 0 },
      cards: [
        { t0: 0.3, t1: 8.6, type: 'title', kicker: 'PEAK FULL PHASE', title: "THE HUNTER'S MOON", sub: 'Mon, Oct 26  ·  04:12 UTC',
          say: "It peaks Monday, October twenty-sixth, at 04:12 UTC. That's nine forty-two in the morning in India, and just after midnight in New York." },
      ],
    },
    {
      id: 'name', scene: 'landscape', dur: 12, chapter: 'Name',
      params: { twi: [0.7, 0.15], moonEl: [0, 18], moonAz: [-6, 2], cam: { z: [4, -14], y: 1.6, yaw: [0.04, -0.02], pitch: [0.0, 0.07] }, leaves: 1, geese: { t0: 2, t1: 11 }, seed: 23 },
      cards: [
        { t0: 0.3, t1: 6.2, type: 'lower', kicker: 'WHY THE NAME?', title: 'Fields cleared. Game fattened.', body: 'Hunters could spot deer in the bright moonlight before winter.',
          say: "Farmers had cleared their fields, so hunters could spot deer in the bright moonlight before winter." },
        { t0: 6.6, t1: 11.7, type: 'lower', kicker: 'MYTH BUSTED', title: 'No eclipse this time', body: 'Just a gorgeous, regular full Moon.',
          say: "And no, it's not a Blood Moon eclipse. Just a gorgeous full moon." },
      ],
    },
    {
      id: 'lapse', scene: 'landscape', dur: 10, chapter: 'Moonrise',
      params: { mode: 'timelapse', nights: 5, lapse: { t0: 0.6, per: 1.75 }, twi: [0.7, 0.2], moonEl: [0, 26], moonAz: [-5, -5], cam: { z: [-6, -9], y: 1.6, yaw: [0, 0], pitch: [0.03, 0.03] }, leaves: 0.6, geese: null, seed: 31 },
      cards: [
        { t0: 0.3, t1: 9.5, type: 'lower', kicker: 'TIME-LAPSE', title: 'Moonrise only ~30 min later each night', body: 'Bright moonlight right after sunset, for several nights.',
          say: "For several nights, moonrise comes only about thirty minutes later, so you get bright moonlight right after sunset." },
      ],
    },
    {
      id: 'tour', scene: 'tour', dur: 11, chapter: 'Moon',
      params: { short: true },
      cards: [
        { t0: 0.3, t1: 5.3, type: 'stat', kicker: 'DISTANCE AT FULL PHASE', value: '368,872 km', label: 'Not a supermoon, but still big and bright',
          say: "The Moon will be about three hundred sixty-nine thousand kilometers away." },
        { t0: 5.7, t1: 10.6, type: 'lower', kicker: 'LOOK FOR', title: 'Tycho & the Sea of Tranquility', body: "Where Apollo 11 landed in 1969.",
          say: "Look for Tycho, and the Sea of Tranquility, where Apollo Eleven landed." },
      ],
    },
    {
      id: 'sky', scene: 'skyevents', dur: 7, chapter: 'Sky',
      params: { short: true },
      cards: [
        { t0: 0.2, t1: 6.8, type: 'events', kicker: 'AROUND THE FULL MOON', stagger: 1.6,
          items: [['OCT 22–24', 'Moon near Saturn'], ['OCT 26', "FULL HUNTER'S MOON"], ['OCT 27–28', 'Moon passes the Pleiades']],
          say: "The Moon pairs with Saturn, then glides past the Pleiades." },
      ],
    },
    {
      id: 'outro', scene: 'orbit', dur: 3, chapter: 'CTA',
      params: { mode: 'outro' },
      cards: [{ t0: 0.2, t1: 2.9, type: 'cta', title: 'FOLLOW FOR MORE SKY EVENTS', sub: 'Oct 26  ·  04:12 UTC', chips: [], ask: '', say: 'Follow for more!' }],
    },
  ];
}

function thumbProfile(cfg) {
  const d = daysPhrase(cfg.daysLeft);
  return [{
    id: 'thumb', scene: 'landscape', dur: 4, chapter: 'Thumbnail',
    params: { twi: [0.5, 0.5], moonEl: [15, 15], moonAz: [13, 13], cam: { z: [-6, -6], y: 1.4, yaw: [0, 0], pitch: [0.1, 0.1] }, leaves: 0.6, geese: null, seed: 11, exag: 13, haloBoost: 0.5, still: true },
    cards: [{ t0: 0, t1: 99, type: 'thumb', big: "HUNTER'S MOON", small: 'OCT 26, 2026', chip: d.chip }],
  }];
}

export function buildTimeline(profile, cfg) {
  const raw = profile === 'short' ? shortProfile(cfg) : profile === 'thumb' ? thumbProfile(cfg) : fullProfile(cfg);
  let t = 0;
  const entries = raw.map((e, i) => {
    const out = { ...e, index: i, start: t, end: t + e.dur };
    t += e.dur;
    return out;
  });
  return { profile, total: t, entries, event: EVENT_ISO, daysLeft: cfg.daysLeft, chip: daysPhrase(cfg.daysLeft).chip };
}

// Flat narration list [{t, text}] in absolute video seconds.
export function narrationOf(tl) {
  const lines = [];
  for (const e of tl.entries) {
    for (const c of e.cards) if (c.say) lines.push({ t: e.start + c.t0 + 0.35, text: c.say, maxDur: c.t1 - c.t0 });
    for (const n of e.narration ?? []) lines.push({ t: e.start + n.t, text: n.text, maxDur: 6 });
  }
  return lines.sort((a, b) => a.t - b.t);
}
