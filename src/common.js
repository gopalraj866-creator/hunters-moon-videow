import * as THREE from 'three';

export const D2R = Math.PI / 180;
export const TAU = Math.PI * 2;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Deterministic PRNG (mulberry32). Every frame must be a pure function of time. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [a,b] range param -> value at progress u (smooth). */
export const rangeAt = (r, u) => lerp(r[0], r[1], u);

/**
 * Celestial (RA hours, Dec degrees) -> unit vector as seen from the INSIDE of the sphere
 * with north up and EAST (increasing RA) to the LEFT, i.e. a correct, non-mirrored sky.
 */
export function raDecToVec(raH, decDeg, r = 1, out = new THREE.Vector3()) {
  const a = raH * 15 * D2R;
  const d = decDeg * D2R;
  return out.set(Math.cos(d) * Math.cos(a), Math.sin(d), -Math.cos(d) * Math.sin(a)).multiplyScalar(r);
}

/** Ecliptic lon/lat (deg) -> {raH, dec} */
export function eclToRaDec(lonDeg, latDeg) {
  const e = 23.4393 * D2R, l = lonDeg * D2R, b = latDeg * D2R;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  return { raH: (((ra / D2R) % 360) + 360) % 360 / 15, dec: dec / D2R };
}

/** Lunar surface point (lat, lon deg) -> world direction with lon0 facing +Z, east to the right. */
export function moonDir(latDeg, lonDeg, out = new THREE.Vector3()) {
  const la = latDeg * D2R, lo = lonDeg * D2R;
  return out.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

/**
 * Smooth keyframe sampler. keys = [[t, v0, v1, ...], ...]  ->  array of values at time t.
 * Each segment uses smootherstep so motion eases through every key.
 */
export function sampleKeys(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last.slice(1);
  let i = 0;
  while (keys[i + 1][0] < t) i++;
  const a = keys[i], b = keys[i + 1];
  let f = (t - a[0]) / (b[0] - a[0]);
  f = f * f * f * (f * (f * 6 - 15) + 10);
  const out = [];
  for (let k = 1; k < a.length; k++) out.push(lerp(a[k], b[k], f));
  return out;
}

export function loadTexture(url, { srgb = true, repeat = false, aniso = 16 } = {}) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = aniso;
        if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        resolve(tex);
      },
      undefined,
      (e) => reject(new Error('texture failed: ' + url))
    );
  });
}

/** Soft radial glow sprite texture. Half-float data texture so large halos have no 8-bit banding. */
export function makeGlowTexture(size = 256) {
  const stops = [[0, 1], [0.12, 0.62], [0.25, 0.30], [0.45, 0.10], [0.7, 0.025], [1, 0]];
  const f = (r) => { if (r >= 1) return 0; let i = 0; while (stops[i + 1][0] < r) i++; const [r0, v0] = stops[i], [r1, v1] = stops[i + 1]; const t = (r - r0) / (r1 - r0); const s = t * t * (3 - 2 * t); return v0 + (v1 - v0) * s; };
  const data = new Uint16Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2;
    const v = THREE.DataUtils.toHalfFloat(f(r));
    const o = (y * size + x) * 4;
    data[o] = data[o + 1] = data[o + 2] = THREE.DataUtils.toHalfFloat(1); data[o + 3] = v;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

export function glowSprite(tex, color, scale, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const s = new THREE.Sprite(m);
  s.scale.set(scale, scale, 1);
  return s;
}

/** GLSL noise snippet shared by several shaders. */
export const NOISE_GLSL = /* glsl */ `
float hash11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2  hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float hash31(vec3 p){ p = fract(p*.1031); p += dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 x){
  vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x), mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x), mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y), f.z);
}
float fbm3(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
`;

/** Camera FOV helper: guarantee a minimum horizontal FOV regardless of aspect (portrait Shorts). */
export function fovForAspect(baseVFov, aspect, minHFov = 50) {
  const vBase = baseVFov * D2R;
  const hBase = 2 * Math.atan(Math.tan(vBase / 2) * aspect);
  if (hBase >= minHFov * D2R) return baseVFov;
  return (2 * Math.atan(Math.tan((minHFov * D2R) / 2) / aspect)) / D2R;
}
