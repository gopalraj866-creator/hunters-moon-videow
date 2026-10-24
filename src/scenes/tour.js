import * as THREE from 'three';
import { clamp, lerp, smooth, sampleKeys, moonDir, D2R, fovForAspect } from '../common.js';
import { makeStarfield, makeMilkyWay, updateStarUniforms } from '../sky.js';
import { makeMoonLitMaterial } from '../bodies.js';

const R = 10;
// [normalised time, camLat, camLon, camDist, targetLat, targetLon]
const KEYS_FULL = [
  [0, 4, 6, 50, 0, 0], [0.08, 12, -8, 42, 8, -6], [0.14, 30, -14, 24, 31, -16], [0.255, 14, -34, 19, 9.7, -20.1],
  [0.395, 8, 12, 17, 0.67, 23.47], [0.50, 8, 14, 17.5, 1.5, 24.5], [0.545, 16, 46, 20, 17, 59], [0.585, -30, -2, 18, -40, -11.4],
  [0.66, -32, -4, 17.5, -43.3, -11.4], [0.70, -8, -8, 38, -2, 0], [0.85, 10, 10, 46, 0, 0], [1, 4, 6, 50, 0, 0],
];
const KEYS_SHORT = [[0, 6, 4, 46, 0, 0], [0.12, 10, 10, 30, 6, 12], [0.34, 8, 14, 17.5, 0.67, 23.47], [0.55, 8, 14, 17.5, 1.5, 24.5], [0.62, -30, -2, 19, -40, -11.4], [0.86, -32, -4, 17.5, -43.3, -11.4], [1, 0, 0, 42, 0, 0]];
const SUN_KEYS = [[0, -0.2, 0.15, 1.0], [0.14, -0.65, 0.35, 0.7], [0.45, -0.5, 0.3, 0.8], [0.6, 0.55, 0.3, 0.75], [0.8, 0.2, 0.2, 0.9], [1, -0.15, 0.1, 1.0]];

// name, lat, lon, sub, [t0, t1] normalised (full), key?
const FEATURES = [
  ['MARE IMBRIUM', 32.8, -15.6, 'SEA OF SHOWERS', [0.13, 0.25]],
  ['OCEANUS PROCELLARUM', 18.4, -57.4, 'OCEAN OF STORMS', [0.2, 0.33]],
  ['COPERNICUS', 9.7, -20.1, 'CRATER · 93 KM', [0.26, 0.38]],
  ['MARE SERENITATIS', 28, 17.5, 'SEA OF SERENITY', [0.3, 0.4]],
  ['TRANQUILITY BASE', 0.67, 23.47, 'APOLLO 11 · JULY 20, 1969', [0.4, 0.53], true],
  ['MARE CRISIUM', 17, 59.1, 'SEA OF CRISES', [0.52, 0.61]],
  ['TYCHO', -43.3, -11.4, 'CRATER · 85 KM · ~108 MILLION YEARS', [0.59, 0.69], true],
];
const FEATURES_SHORT = [['TRANQUILITY BASE', 0.67, 23.47, 'APOLLO 11 · 1969', [0.25, 0.56], true], ['TYCHO', -43.3, -11.4, 'CRATER · 85 KM', [0.7, 0.95], true]];

export function createTour(ctx) {
  const { tex, aspect, portrait } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, aspect, 0.05, 4000);
  const stars = makeStarfield({ count: 9000, seed: 21 });
  const mw = makeMilkyWay(1450, tex.mw);
  scene.add(stars, mw);
  const mat = makeMoonLitMaterial(tex.moon, tex.moonBump);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R, 256, 192), mat);
  moon.rotation.y = -Math.PI / 2;
  scene.add(moon);
  const sun = new THREE.DirectionalLight(0xfff4e6, 6.2);
  scene.add(sun, new THREE.AmbientLight(0x202a44, 0.5));
  const camV = new THREE.Vector3(), tgt = new THREE.Vector3(), nrm = new THREE.Vector3();

  function update(local, params, c) {
    const u = local.u;
    const keys = params.short ? KEYS_SHORT : KEYS_FULL;
    const [cla, clo, D0, tla, tlo] = sampleKeys(keys, u);
    const D = D0 * (portrait ? 1.0 + 0.25 * smooth(0.0, 1, 1 - D0 / 50) * 0 : 1) * (portrait ? 1.0 : 1.0);
    const dist = portrait ? D * 1.28 : D;
    camV.copy(moonDir(cla, clo)).multiplyScalar(dist);
    tgt.copy(moonDir(tla, tlo)).multiplyScalar(R);
    camera.position.copy(camV);
    camera.up.set(0, 1, 0);
    camera.lookAt(tgt);
    camera.fov = 30;
    camera.updateProjectionMatrix();
    const s = sampleKeys(SUN_KEYS, u);
    sun.position.set(s[0], s[1], s[2]).normalize().multiplyScalar(100);
    mat.userData.uniforms.uDetail.value = smooth(40, 20, dist / (portrait ? 1.28 : 1));
    mat.userData.uniforms.uBumpDetail.value = 1.0;
    updateStarUniforms(stars, { time: c.time, height: c.pxH, vis: 0.9 });
    mw.material.uniforms.uVis.value = 0.8;
    mw.position.set(0, 0, 0);

    const labels = [];
    const feats = params.short ? FEATURES_SHORT : FEATURES;
    for (const [name, lat, lon, sub, [a, b], key] of feats) {
      const p = moonDir(lat, lon).multiplyScalar(R * 1.002);
      nrm.copy(p).normalize();
      const facing = smooth(0.12, 0.35, nrm.dot(camV.clone().normalize()));
      const w = smooth(a, a + 0.025, u) * smooth(b, b - 0.025, u);
      labels.push({ pos: p, text: name, sub, a: w * facing, cls: key ? 'lbl-key' : '' });
    }
    return { labels };
  }
  return { scene, camera, update };
}
