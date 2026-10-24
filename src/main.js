import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { bakeMilkyWay } from './sky.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { buildTimeline } from './timeline.js';
import { loadTexture, smooth, clamp } from './common.js';
import { createLandscape } from './scenes/landscape.js';
import { createOrbit } from './scenes/orbit.js';
import { createTour } from './scenes/tour.js';
import { createSkyEvents } from './scenes/skyevents.js';
import { createOverlay } from './overlay.js';

const q = new URLSearchParams(location.search);
const profile = q.get('profile') || 'full';
const pxW = parseInt(q.get('w') || '1920'), pxH = parseInt(q.get('h') || '1080');
const fps = parseInt(q.get('fps') || '30');
const daysLeft = parseInt(q.get('days') ?? '4');
const samples = parseInt(q.get('samples') ?? '0');
const useFXAA = (q.get('fxaa') ?? (Math.max(pxW, pxH) >= 3000 ? '0' : '1')) === '1';
const portrait = pxH > pxW;
const capture = q.get('capture') === '1';
if (capture) document.body.classList.add('capture');
const statusEl = document.getElementById('status');
const say = (s) => { statusEl.textContent = s; };

const tl = buildTimeline(profile, { daysLeft });
window.__timeline = tl;
window.__fps = fps;
window.__frames = Math.round(tl.total * fps);

/* ───────── renderer ───────── */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(pxW, pxH, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const mkRT = () => new THREE.WebGLRenderTarget(pxW, pxH, { type: THREE.HalfFloatType, samples, depthBuffer: true });

/* Pass that renders scene A (and optionally B) and crossfades them in linear HDR. */
class CrossfadePass extends Pass {
  constructor() {
    super();
    this.rtA = mkRT(); this.rtB = mkRT();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tA: { value: null }, tB: { value: null }, mixv: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D tA, tB; uniform float mixv; varying vec2 vUv; void main(){ gl_FragColor = mix(texture2D(tA, vUv), texture2D(tB, vUv), mixv); }',
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
    this.job = null;
  }
  render(r, writeBuffer) {
    const { drawA, drawB, mix } = this.job;
    r.setRenderTarget(this.rtA); r.clear(); drawA(r);
    const useB = !!drawB && mix > 0.001;
    if (useB) { r.setRenderTarget(this.rtB); r.clear(); drawB(r); }
    this.mat.uniforms.tA.value = this.rtA.texture;
    this.mat.uniforms.tB.value = useB ? this.rtB.texture : this.rtA.texture;
    this.mat.uniforms.mixv.value = useB ? mix : 0;
    r.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(r);
  }
  setSize(w, h) { this.rtA.setSize(w, h); this.rtB.setSize(w, h); }
}

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(pxW, pxH, { type: THREE.HalfFloatType, samples: 0 }));
composer.setPixelRatio(1); composer.setSize(pxW, pxH);
const cross = new CrossfadePass();
const bloom = new UnrealBloomPass(new THREE.Vector2(pxW, pxH), 0.6, 0.6, 1.0);
const output = new OutputPass();
const finalPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 0 }, uRes: { value: new THREE.Vector2(pxW, pxH) }, uGrain: { value: 0.035 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uFade, uGrain; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    void main(){
      vec2 c = vUv-0.5; float r2 = dot(c*vec2(uRes.x/uRes.y,1.0), c*vec2(uRes.x/uRes.y,1.0));
      vec2 ca = c*r2*0.0035;
      vec3 col = vec3(texture2D(tDiffuse, vUv+ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv-ca).b);
      col *= 1.0 - smoothstep(0.18, 0.95, r2)*0.5;               // vignette
      col = mix(vec3(dot(col, vec3(0.299,0.587,0.114))), col, 1.08); // gentle saturation
      float g = h(gl_FragCoord.xy + fract(uTime*7.31)*913.0) - 0.5;
      float g2 = h(gl_FragCoord.xy*0.5 + fract(uTime*3.17)*531.0) - 0.5;
      float lum = dot(col, vec3(0.333));
      col += (g*0.7 + g2*0.5) * uGrain * (0.4 + 0.6*(1.0-lum));    // film grain + dither (kills banding)
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const fxaa = new ShaderPass(FXAAShader);
fxaa.material.uniforms.resolution.value.set(1 / pxW, 1 / pxH);
fxaa.enabled = useFXAA;
composer.addPass(cross); composer.addPass(bloom); composer.addPass(output); composer.addPass(fxaa); composer.addPass(finalPass);
bloom.strength = 0.6;

/* ───────── assets & scenes ───────── */
let scenes = {}, overlayApi = null;
async function tryTex(url, opts) { try { return await loadTexture(url, opts); } catch { return null; } }

async function init() {
  say('loading textures…');
  const T = 'assets/textures/';
  const hires = await tryTex(T + 'moon_hires.jpg');
  const [moon, moonBump, earthDay, earthNight, earthSpec, clouds] = await Promise.all([
    hires ?? loadTexture(T + 'moon_1024.jpg'),
    loadTexture(T + 'moonbump_1k.jpg', { srgb: false }),
    loadTexture(T + 'earth_atmos_2048.jpg'),
    loadTexture(T + 'earth_lights_2048.png'),
    loadTexture(T + 'earth_specular_2048.jpg', { srgb: false }),
    loadTexture(T + 'earth_clouds_2k.png', { srgb: false }),
  ]);
  const mw = bakeMilkyWay(renderer);
  const tex = { moon, moonBump, earthDay, earthNight, earthSpec, clouds, mw };
  await Promise.all([document.fonts.load('700 40px Cinzel'), document.fonts.load('600 20px Montserrat'), document.fonts.load('400 20px Montserrat')]);
  const ctx = { tex, aspect: pxW / pxH, portrait, pxH, pxW };
  say('building scenes…');
  scenes = { landscape: createLandscape(ctx), orbit: createOrbit(ctx), tour: createTour(ctx), skyevents: createSkyEvents(ctx) };
  overlayApi = createOverlay({ tl, portrait, pxW, pxH });
  say('ready');
  return { frames: window.__frames, fps, total: tl.total, w: pxW, h: pxH };
}

/* ───────── frame ───────── */
const XF = profile === 'short' ? 0.5 : 1.0;      // crossfade seconds
function entryAt(T) { for (const e of tl.entries) if (T < e.end) return e; return tl.entries[tl.entries.length - 1]; }
function localOf(e, T) { const t = Math.max(0, T - e.start); return { t, u: clamp(t / e.dur), dur: e.dur }; }

function frame(i) {
  const T = Math.min(i / fps, tl.total - 1e-4);
  const e = entryAt(T);
  const c = { time: T, pxH, pxW };
  const A = scenes[e.scene];
  const next = tl.entries[e.index + 1];
  const inX = !!next && T > e.end - XF;
  const mix = inX ? smooth(0, 1, (T - (e.end - XF)) / XF) : 0;
  const B = inX ? scenes[next.scene] : null;
  let la = { labels: [] }, lb = { labels: [] };
  cross.job = {
    mix,
    drawA: (r) => { la = A.update(localOf(e, T), e.params, c); r.render(A.scene, A.camera); },
    drawB: B ? (r) => { lb = B.update(localOf(next, T), next.params, c); r.render(B.scene, B.camera); } : null,
  };
  // B must be updated even when mix is ~0 so labels exist; but only drawn when needed.
  finalPass.uniforms.uTime.value = T;
  let fade = 0;
  if (profile !== 'thumb') {
    if (T < 1.2) fade = 1 - smooth(0, 1.2, T);
    if (T > tl.total - 1.0) fade = Math.max(fade, smooth(tl.total - 1.0, tl.total - 0.02, T));
  }
  finalPass.uniforms.uFade.value = fade;
  composer.render();
  const useB = mix > 0.5 && B;
  const labels = (useB ? lb.labels : la.labels) || [];
  const labelAlpha = mix > 0 ? Math.abs(1 - 2 * mix) : 1;
  overlayApi.update(T, labels.map((l) => ({ ...l, a: l.a * labelAlpha })), (useB ? B : A).camera);
  return true;
}

window.__dbg = { get scenes() { return scenes; }, renderer, composer, bloom, cross, finalPass, THREE };
window.__init = init;
window.__frame = async (i) => {
  frame(i);
  renderer.getContext().finish();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return true;
};
window.__ready = true;
if (q.get('autoplay') === '1') {
  init().then(() => {
    let i = 0, last = performance.now();
    const loop = (now) => { i = ((now - last) / 1000 * fps) | 0; frame(i % window.__frames); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
}
