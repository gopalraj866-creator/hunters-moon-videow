import { clamp, smooth, easeOut, lerp } from './common.js';

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const ICONS = {
  comment: '<svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M18 16a3 3 0 0 0-2.4 1.2L8.9 13.6a3 3 0 0 0 0-3.2l6.7-3.6A3 3 0 1 0 15 5a3 3 0 0 0 .1.8L8.4 9.4a3 3 0 1 0 0 5.2l6.7 3.6A3 3 0 1 0 18 16z"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6v-5a7 7 0 0 0-5.5-6.8V3a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v11H5z"/></svg>',
  like: '<svg viewBox="0 0 24 24"><path d="M2 10h4v12H2zM8 10l4-8c1.5 0 2.5 1 2.5 2.5L14 9h6a2 2 0 0 1 2 2.3l-1.6 8A2 2 0 0 1 18.4 21H8z"/></svg>',
};

// Engagement prompts (absolute seconds). Full-length video only.
const PROMPTS = {
  full: [
    { t: 76, d: 7, icon: 'comment', text: 'Where will you watch from? Tell us below' },
    { t: 196, d: 7, icon: 'like', text: 'Enjoying this? Tap the like button' },
    { t: 322, d: 7, icon: 'share', text: 'Send this to a fellow skywatcher' },
    { t: 418, d: 8, icon: 'cal', text: 'Set a reminder for Oct 26 · 04:12 UTC' },
    { t: 452, d: 8, icon: 'bell', text: 'Subscribe + tap the bell for sky alerts' },
  ],
  short: [],
  thumb: [],
};

export function createOverlay({ tl, portrait, pxW, pxH }) {
  const stage = $('#stage');
  const unit = portrait ? pxW / 1080 : pxH / 1080;
  document.documentElement.style.setProperty('--u', unit + 'px');
  stage.style.width = pxW + 'px'; stage.style.height = pxH + 'px';
  const overlay = $('#overlay');
  if (portrait) overlay.classList.add('portrait');
  const scrim = $('#scrim'), labelsRoot = $('#labels'), hud = $('#hud'), cardsRoot = $('#cards'), promptsRoot = $('#prompts');
  if (portrait) scrim.classList.add('portrait');

  /* HUD */
  const badge = el('div', 'hud-badge shadowed', `<i></i>HUNTER'S MOON  ·  OCT 26`);
  const chip = el('div', 'hud-chip', tl.chip);
  if (tl.profile !== 'thumb') hud.append(badge, chip);

  /* build all cards once */
  const built = [];
  const makeCard = (c) => {
    const n = (cls, html) => { const d = el('div', 'card ' + cls, html); cardsRoot.append(d); return d; };
    let node, items = [];
    switch (c.type) {
      case 'center': {
        node = n('center shadowed', `<div class="big${c.big.length > 14 ? ' long' : ''}">${c.big}</div><div class="small">${c.small}</div>`);
        items = [node.querySelector('.big'), node.querySelector('.small')]; break;
      }
      case 'title': {
        node = n('title shadowed', `<div class="kicker">${c.kicker}</div><h1>${c.title}</h1><div class="sub">${c.sub}</div>`);
        items = [node.querySelector('.kicker'), node.querySelector('h1'), node.querySelector('.sub')]; break;
      }
      case 'lower': {
        node = n('lower shadowed', `<div class="kicker">${c.kicker}</div><div class="rule"></div><h2>${c.title}</h2><p>${c.body}</p>`);
        items = [node.querySelector('.kicker'), node.querySelector('.rule'), node.querySelector('h2'), node.querySelector('p')]; break;
      }
      case 'stat': {
        node = n('stat shadowed', `<div class="kicker">${c.kicker}</div><div class="rule"></div><div class="val">${c.value}</div><div class="label">${c.label}</div>`);
        items = [node.querySelector('.kicker'), node.querySelector('.rule'), node.querySelector('.val'), node.querySelector('.label')];
        node._val = node.querySelector('.val'); node._valText = c.value; break;
      }
      case 'stats': {
        node = n('stats shadowed', `<div class="kicker">${c.kicker}</div><div class="rule"></div><h2>${c.title}</h2><div class="stats-grid">${c.stats.map(([a, b]) => `<div><b>${a}</b><span>${b}</span></div>`).join('')}</div>`);
        items = [node.querySelector('.kicker'), node.querySelector('.rule'), node.querySelector('h2'), ...node.querySelectorAll('.stats-grid > div')]; break;
      }
      case 'times': {
        node = n('panel shadowed', `<div class="kicker">${c.kicker}</div><div class="rule"></div>${c.rows.map(([a, b]) => `<div class="row${a.startsWith('Mumbai') ? ' hot' : ''}"><span class="k">${a.toUpperCase()}</span><span class="v">${b}</span></div>`).join('')}`);
        items = [node.querySelector('.kicker'), node.querySelector('.rule'), ...node.querySelectorAll('.row')]; break;
      }
      case 'list': {
        node = n('panel shadowed', `<div class="kicker">${c.kicker}</div><div class="rule"></div><h2>${c.title}</h2>${c.items.map((s) => `<div class="row"><span class="bullet"></span><span class="v">${s}</span></div>`).join('')}`);
        items = [node.querySelector('.kicker'), node.querySelector('.rule'), node.querySelector('h2'), ...node.querySelectorAll('.row')]; node._stagger = true; break;
      }
      case 'steps': {
        node = n('panel shadowed', `<div class="kicker">${c.title}</div><div class="rule"></div>${c.items.map((s, i) => `<div class="row step"><span class="num">${i + 1}</span><span class="v">${s}</span></div>`).join('')}`);
        items = [node.querySelector('.kicker'), node.querySelector('.rule'), ...node.querySelectorAll('.row')]; node._stagger = true; break;
      }
      case 'events': {
        node = n('panel shadowed', `<div class="kicker">${c.kicker}</div><div class="rule"></div>${c.items.map(([a, b]) => `<div class="row${/FULL/.test(b) ? ' hot' : ''}"><span class="k">${a}</span><span class="v">${b}</span></div>`).join('')}`);
        items = [node.querySelector('.kicker'), node.querySelector('.rule'), ...node.querySelectorAll('.row')]; node._stagger = true; break;
      }
      case 'cta': {
        node = n('cta shadowed', `<h1>${c.title}</h1><div class="sub">${c.sub}</div><div class="chips">${c.chips.map((s, i) => `<div class="chip ${i ? 'b' : 'a'}">${s}</div>`).join('')}</div><div class="ask">${c.ask}</div>`);
        items = [node.querySelector('h1'), node.querySelector('.sub'), node.querySelector('.chips'), node.querySelector('.ask')]; break;
      }
      case 'thumb': {
        node = n('thumb', `<div class="big"><em>HUNTER'S</em>MOON</div><div class="small">${c.small}</div><div class="chip">${c.chip}</div>`);
        items = [node]; break;
      }
    }
    return { node, items, c, stagger: c.stagger };
  };
  tl.entries.forEach((e) => e.cards.forEach((c) => built.push({ ...makeCard(c), t0: e.start + c.t0, t1: e.start + c.t1, type: c.type })));

  const proms = PROMPTS[tl.profile].map((p) => {
    const d = el('div', 'prompt', `<span class="ico">${ICONS[p.icon]}</span><span>${p.text}</span>`);
    promptsRoot.append(d);
    return { ...p, node: d };
  });

  const labelPool = [];
  const getLabel = (i) => {
    if (!labelPool[i]) {
      const d = el('div', 'lbl', '<div class="dot"></div><div class="txt"><b></b><span></span></div>');
      labelsRoot.append(d);
      labelPool[i] = { d, b: d.querySelector('b'), s: d.querySelector('span'), cls: '' };
    }
    return labelPool[i];
  };

  const fmtCount = (str, p) => {
    const m = str.match(/[\d,]+(\.\d+)?/);
    if (!m) return str;
    const raw = m[0], target = parseFloat(raw.replace(/,/g, ''));
    const dec = (raw.split('.')[1] || '').length;
    let v = target * easeOut(p);
    let s = dec ? v.toFixed(dec) : Math.round(v).toString();
    if (raw.includes(',')) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return str.replace(raw, s);
  };

  function update(T, labels, camera, mixInfo) {
    /* cards */
    let scrimA = 0, scrimMode = '';
    for (const b of built) {
      const active = T >= b.t0 - 0.05 && T <= b.t1 + 0.05;
      if (!active) { if (b.node.style.display !== 'none') b.node.style.display = 'none'; continue; }
      b.node.style.display = '';
      const out = smooth(b.t1, b.t1 - 0.8, T);
      let any = 0;
      b.items.forEach((it, i) => {
        const stagger = b.stagger && i >= (b.type === 'list' ? 3 : 2) ? b.stagger : 0;
        const idx = b.type === 'list' ? Math.max(0, i - 3) : Math.max(0, i - 2);
        const delay = b.items.length === 1 ? 0 : (b.stagger && i >= (b.type === 'list' ? 3 : 2) ? 0.5 + idx * b.stagger : i * 0.16);
        const p = easeOut((T - b.t0 - delay) / 0.9);
        const o = Math.min(p, out);
        any = Math.max(any, o);
        it.style.opacity = o;
        it.style.transform = b.type === 'thumb' ? '' : `translateY(${(1 - p) * 22}px) scale(${lerp(0.985, 1, p)})`;
        if (it.tagName === 'H1' || it.classList.contains('big')) it.style.letterSpacing = b.type === 'thumb' ? '' : `${lerp(0.16, 0.06, p)}em`;
      });
      b.node.style.opacity = 1;
      if (b._val) b._val.textContent = fmtCount(b._valText, clamp((T - b.t0 - 0.4) / 1.6));
      if (b.type !== 'thumb' && b.type !== 'cta') { if (b.type === 'center' || b.type === 'title') { scrimMode = 'center'; scrimA = Math.max(scrimA, any * (b.type === 'center' ? 0.9 : 0.55)); } else { scrimMode = scrimMode || ''; scrimA = Math.max(scrimA, any); } }
    }
    scrim.className = (portrait ? 'portrait ' : '') + (scrimMode === 'center' && !portrait ? 'center' : '');
    scrim.style.opacity = scrimA;

    /* HUD */
    const total = tl.total;
    const hudA = smooth(2.5, 4.0, T) * smooth(total - 0.5, total - 2.5, T) * (tl.profile === 'short' ? smooth(0.2, 0.8, T) : 1);
    hud.style.opacity = hudA;

    /* prompts */
    for (const p of proms) {
      const a = smooth(p.t, p.t + 0.6, T) * smooth(p.t + p.d, p.t + p.d - 0.6, T);
      p.node.style.opacity = a;
      p.node.style.transform = `translateX(${(1 - a) * 40}px)`;
    }

    /* labels */
    let used = 0;
    const w = pxW, h = pxH, v = camera.position.clone();
    for (const L of labels) {
      if (L.a <= 0.01) continue;
      let x, y;
      if (L.pos) {
        const p = L.pos.clone().project(camera);
        if (p.z > 1 || p.z < -1) continue;
        x = (p.x * 0.5 + 0.5) * w; y = (-p.y * 0.5 + 0.5) * h;
        if (x < -80 || x > w + 80 || y < -80 || y > h + 80) continue;
      } else { x = L.sx * w; y = L.sy * h; }
      const lab = getLabel(used++);
      if (lab.cls !== (L.cls || '')) { lab.d.className = 'lbl ' + (L.cls || ''); lab.cls = L.cls || ''; }
      if (lab.b.textContent !== L.text) lab.b.textContent = L.text;
      if (lab.s.textContent !== (L.sub || '')) lab.s.textContent = L.sub || '';
      lab.d.style.display = '';
      lab.d.style.opacity = L.a;
      const off = L.off ?? [0, 0];
      lab.d.style.transform = `translate(${x + off[0] * 8 * unit}px, ${y + off[1] * -14 * unit}px)`;
    }
    for (let i = used; i < labelPool.length; i++) labelPool[i].d.style.display = 'none';
  }

  return { update };
}
