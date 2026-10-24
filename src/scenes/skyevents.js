import * as THREE from 'three';
import { clamp, lerp, smooth, sampleKeys, raDecToVec, eclToRaDec, D2R, makeGlowTexture, glowSprite } from '../common.js';
import { makeStarfield, makeMilkyWay, makeConstellationLines, updateStarUniforms, STARS } from '../sky.js';
import { makeMoonPhaseMaterial } from '../bodies.js';

const SKY_R = 1300;
const FULL_LON = 33.3, FULL_LAT = 4.7, MEAN_MOTION = 13.176, SUN_LON_AT_FULL = 213.3;
const SATURN = { lon: 11, lat: -2.3 };

function moonAtDays(dd) { // days relative to Oct 26 04:12 UTC
  const lon = FULL_LON + MEAN_MOTION * dd;
  const lat = 5.1 * Math.cos((2 * Math.PI * (dd - 1.7)) / 27.21);
  return eclToRaDec(lon, lat);
}
function sunDirAtDays(dd) { const s = eclToRaDec(SUN_LON_AT_FULL + 0.96 * dd, 0); return raDecToVec(s.raH, s.dec, 1); }

// [normalised time, RA hours, Dec deg, vertical FOV]
const CAM_FULL = [[0, 23.6, 6, 66], [0.16, 23.9, 8, 58], [0.30, 24.5, 10, 50], [0.42, 25.9, 14, 46], [0.50, 26.7, 18, 44], [0.58, 27.5, 20, 40], [0.64, 28.6, 12, 52], [0.74, 29.4, 6, 56], [0.88, 27.2, 12, 82], [1, 26.7, 13, 86]];
const CAM_SHORT = [[0, 23.8, 8, 60], [0.3, 24.5, 10, 52], [0.5, 25.9, 14, 46], [0.75, 27.4, 19, 42], [1, 27.6, 20, 42]];

const GHOSTS = [
  { dd: -4.1, label: 'OCT 22' }, { dd: -3.1, label: 'OCT 23' }, { dd: -2.1, label: 'OCT 24', sub: 'NEAR SATURN' }, { dd: -1.1, label: 'OCT 25' },
  { dd: 0, label: 'OCT 26', sub: "FULL HUNTER'S MOON", key: true },
  { dd: 1.0, label: 'OCT 27' }, { dd: 2.0, label: 'OCT 28', sub: 'PLEIADES' },
];

export function createSkyEvents(ctx) {
  const { tex, aspect, portrait } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, aspect, 0.5, 4000);
  const glowTex = makeGlowTexture();
  const stars = makeStarfield({ count: 11000, seed: 8 });
  const mw = makeMilkyWay(1450, tex.mw);
  const lines = makeConstellationLines(1390, 0.04);
  scene.add(mw, stars, lines);

  const ghosts = GHOSTS.map((g) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), makeMoonPhaseMaterial(tex.moon));
    const p = moonAtDays(g.dd);
    const pos = raDecToVec(p.raH, p.dec, SKY_R);
    m.position.copy(pos);
    const ang = g.key ? 1.75 : 1.15; // exaggerated for visibility
    m.scale.setScalar(SKY_R * Math.tan(ang * D2R));
    m.lookAt(0, 0, 0); m.rotateY(-Math.PI / 2);
    m.material.uniforms.uSun.value.copy(sunDirAtDays(g.dd));
    scene.add(m);
    const halo = glowSprite(glowTex, new THREE.Color(0.8, 0.88, 1), m.scale.x * (g.key ? 9 : 5), g.key ? 0.4 : 0.14);
    halo.position.copy(pos);
    scene.add(halo);
    return { g, m, halo, pos };
  });
  // dotted path of the Moon
  const pathPts = [];
  for (let dd = -4.6; dd <= 2.6; dd += 0.06) { const p = moonAtDays(dd); pathPts.push(...raDecToVec(p.raH, p.dec, SKY_R - 1).toArray()); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pathPts, 3));
  const path = new THREE.Points(pg, new THREE.PointsMaterial({ color: new THREE.Color(1.0, 0.75, 0.4).multiplyScalar(1.6), size: 3.2 * (ctx.pxH / 1080), sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  path.frustumCulled = false;
  scene.add(path);

  // Saturn (small golden disc + glow)
  const sp = eclToRaDec(SATURN.lon, SATURN.lat);
  const satPos = raDecToVec(sp.raH, sp.dec, SKY_R);
  const sat = glowSprite(glowTex, new THREE.Color(1.0, 0.86, 0.55), 38, 0.95); sat.position.copy(satPos);
  const satCore = glowSprite(glowTex, new THREE.Color(1.0, 0.95, 0.8), 12, 1.0); satCore.position.copy(satPos);
  scene.add(sat, satCore);
  // Pleiades nebulosity
  const pl = raDecToVec(3.79, 24.1, SKY_R);
  const nebula = glowSprite(glowTex, new THREE.Color(0.35, 0.55, 1.0), 120, 0.28); nebula.position.copy(pl);
  scene.add(nebula);

  const fwd = new THREE.Vector3();
  function update(local, params, c) {
    const u = local.u;
    const [ra, dec, fov] = sampleKeys(params.short ? CAM_SHORT : CAM_FULL, u);
    raDecToVec(ra, dec, 1, fwd);
    camera.position.set(0, 0, 0);
    camera.up.set(0, 1, 0);
    camera.lookAt(fwd);
    camera.fov = portrait ? fov * 1.35 : fov;
    camera.updateProjectionMatrix();
    updateStarUniforms(stars, { time: c.time, height: c.pxH, vis: 1.05 });
    mw.material.uniforms.uVis.value = 1.0;
    const lineIn = params.short ? 0.25 : smooth(0.5, 0.62, u) * 0.5 + 0.12;
    lines.material.opacity = lineIn;
    path.material.opacity = smooth(0.0, 0.08, u) * 0.85;
    path.material.size = 3.2 * (c.pxH / 1080);

    // each ghost moon appears when the narration reaches that date
    const nG = ghosts.length;
    ghosts.forEach((o, i) => {
      const app = params.short ? smooth(0.02 + i * 0.1, 0.1 + i * 0.1, u) : smooth(0.16 + i * 0.065, 0.2 + i * 0.065, u) * (o.g.dd === 0 ? 1 : 1);
      const base = o.g.key ? 3.4 : 1.7;
      o.m.material.uniforms.uInt.value = base * Math.max(app, o.g.key ? smooth(0.0, 0.1, u) * 0.0 + app : app);
      o.m.visible = app > 0.01; o.halo.visible = app > 0.01;
      o.halo.material.opacity = (o.g.key ? 0.42 : 0.14) * app;
    });

    const labels = [];
    const W = (a, b, k = 0.02) => smooth(a, a + k, u) * smooth(b, b - k, u);
    if (!params.short) {
      ghosts.forEach((o, i) => {
        const app = smooth(0.16 + i * 0.065, 0.2 + i * 0.065, u);
        labels.push({ pos: o.pos.clone(), text: o.g.label, sub: o.g.sub ?? '', a: app * smooth(0.97, 0.9, u), cls: o.g.key ? 'lbl-key' : '', off: [0, 1] });
      });
      labels.push({ pos: satPos.clone(), text: 'SATURN', sub: '', a: W(0.0, 0.36, 0.03), off: [0, -1] });
      labels.push({ pos: pl, text: 'PLEIADES', sub: 'THE SEVEN SISTERS · 440 LIGHT-YEARS', a: W(0.40, 0.62, 0.03), off: [0, -2.4] });
      const bet = raDecToVec(...STARS.Betelgeuse.slice(0, 2), SKY_R), mint = raDecToVec(...STARS.Alnilam.slice(0, 2), SKY_R);
      labels.push({ pos: bet, text: 'BETELGEUSE', sub: '', a: W(0.56, 0.76, 0.03), off: [1, 0] });
      labels.push({ pos: mint, text: 'ORION', sub: 'THE HUNTER · THE THREE BELT STARS', a: W(0.56, 0.78, 0.03), off: [0, 1.4], cls: 'lbl-key' });
      const ald = raDecToVec(...STARS.Aldebaran.slice(0, 2), SKY_R);
      labels.push({ pos: ald, text: 'ALDEBARAN', sub: '', a: W(0.58, 0.76, 0.03), off: [1, 0] });
    } else {
      ghosts.forEach((o, i) => { if (o.g.key || o.g.dd === -2.1 || o.g.dd === 2.0) labels.push({ pos: o.pos.clone(), text: o.g.label, sub: o.g.sub ?? '', a: smooth(0.02 + i * 0.1, 0.12 + i * 0.1, u), cls: o.g.key ? 'lbl-key' : '', off: [0, 1] }); });
      labels.push({ pos: satPos.clone(), text: 'SATURN', sub: '', a: W(0.0, 0.5, 0.05), off: [0, -1] });
      labels.push({ pos: pl, text: 'PLEIADES', sub: '', a: W(0.6, 1.0, 0.05), off: [0, -1] });
    }
    return { labels };
  }
  return { scene, camera, update };
}
