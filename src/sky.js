import * as THREE from 'three';
import { raDecToVec, rng, NOISE_GLSL, D2R } from './common.js';

// Bright stars (J2000). [name, RA hours, Dec deg, apparent magnitude, color]
export const STARS = {
  Betelgeuse: [5.9195, 7.407, 0.5, '#ff9c6b'], Rigel: [5.2423, -8.202, 0.13, '#a9c6ff'], Bellatrix: [5.4188, 6.349, 1.64, '#b4ccff'],
  Mintaka: [5.5334, -0.299, 2.2, '#b0c8ff'], Alnilam: [5.6036, -1.202, 1.7, '#b0c8ff'], Alnitak: [5.6793, -1.943, 1.77, '#b0c8ff'],
  Saiph: [5.7959, -9.67, 2.07, '#b0c8ff'], Meissa: [5.5856, 9.934, 3.3, '#c0d4ff'],
  Aldebaran: [4.5987, 16.509, 0.85, '#ffb06a'], Elnath: [5.4382, 28.608, 1.65, '#bcd0ff'], ZetaTau: [5.6274, 21.143, 3.0, '#bcd0ff'],
  GammaTau: [4.3299, 15.627, 3.65, '#ffe2b0'], Delta1Tau: [4.3825, 17.543, 3.76, '#ffe2b0'], EpsTau: [4.4770, 19.18, 3.5, '#ffd9a0'], Theta2Tau: [4.4780, 15.871, 3.4, '#f3f0ff'],
  Alcyone: [3.7914, 24.105, 2.87, '#bcd2ff'], Electra: [3.7479, 24.113, 3.7, '#bcd2ff'], Taygeta: [3.7534, 24.467, 4.3, '#bcd2ff'],
  Maia: [3.7639, 24.368, 3.87, '#bcd2ff'], Merope: [3.7723, 23.948, 4.2, '#bcd2ff'], Atlas: [3.8194, 24.053, 3.6, '#bcd2ff'], Pleione: [3.8197, 24.138, 5.0, '#bcd2ff'],
  Hamal: [2.1195, 23.463, 2.0, '#ffd2a2'], Sheratan: [1.9107, 20.808, 2.65, '#e8eeff'], Mesarthim: [1.8919, 19.294, 3.9, '#e8eeff'],
  Capella: [5.2782, 45.998, 0.08, '#fff0c8'], Castor: [7.5767, 31.888, 1.58, '#e2ecff'], Pollux: [7.7553, 28.026, 1.14, '#ffd8a8'],
  Sirius: [6.7525, -16.716, -1.46, '#cfe0ff'], Procyon: [7.655, 5.225, 0.34, '#fff4dc'],
  Mirfak: [3.4054, 49.861, 1.8, '#fff0d0'], Alpheratz: [0.1398, 29.09, 2.06, '#d6e4ff'], Mirach: [1.1622, 35.62, 2.05, '#ffbd8a'], Almach: [2.065, 42.33, 2.1, '#ffd9a8'],
  Markab: [23.0793, 15.205, 2.5, '#d6e4ff'], Scheat: [23.0629, 28.083, 2.4, '#ffb78a'], Algenib: [0.2206, 15.184, 2.8, '#c8d8ff'],
  Menkar: [3.0380, 4.09, 2.5, '#ff9c70'], Diphda: [0.7265, -17.987, 2.04, '#ffd9b0'],
  Schedar: [0.6751, 56.537, 2.24, '#ffd0a0'], Caph: [0.1529, 59.15, 2.27, '#fff0d8'], Navi: [0.9451, 60.717, 2.47, '#bcd0ff'],
  Regulus: [10.1395, 11.967, 1.35, '#c8d8ff'], Fomalhaut: [22.9608, -29.622, 1.16, '#e6eeff'],
};

export const CONSTELLATIONS = {
  Orion: [['Betelgeuse', 'Bellatrix'], ['Betelgeuse', 'Alnitak'], ['Bellatrix', 'Mintaka'], ['Mintaka', 'Alnilam'], ['Alnilam', 'Alnitak'], ['Alnitak', 'Saiph'], ['Mintaka', 'Rigel'], ['Meissa', 'Betelgeuse'], ['Meissa', 'Bellatrix']],
  Taurus: [['Aldebaran', 'GammaTau'], ['GammaTau', 'Delta1Tau'], ['Delta1Tau', 'EpsTau'], ['GammaTau', 'Theta2Tau'], ['Aldebaran', 'Theta2Tau'], ['EpsTau', 'Elnath'], ['Aldebaran', 'ZetaTau']],
  Aries: [['Hamal', 'Sheratan'], ['Sheratan', 'Mesarthim']],
  Pegasus: [['Markab', 'Scheat'], ['Scheat', 'Alpheratz'], ['Alpheratz', 'Algenib'], ['Algenib', 'Markab']],
  Andromeda: [['Alpheratz', 'Mirach'], ['Mirach', 'Almach']],
  Cassiopeia: [['Caph', 'Schedar'], ['Schedar', 'Navi']],
};

/** Starfield: random faint stars + the catalog's bright stars. */
export function makeStarfield({ count = 9000, radius = 1400, seed = 7 } = {}) {
  const r = rng(seed);
  const names = Object.keys(STARS);
  const total = count + names.length;
  const pos = new Float32Array(total * 3), size = new Float32Array(total), col = new Float32Array(total * 3), phase = new Float32Array(total);
  const tmp = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // uniform on sphere
    const z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    tmp.set(s * Math.cos(a), z, s * Math.sin(a)).multiplyScalar(radius);
    pos.set([tmp.x, tmp.y, tmp.z], i * 3);
    const m = Math.pow(r(), 2.6); // most stars faint
    size[i] = 1.1 + m * 2.4;
    const b = 0.25 + m * 0.75;
    const temp = r();
    c.setRGB(0.8 + 0.2 * temp, 0.85 + 0.1 * (1 - Math.abs(temp - 0.5)), 1.0 - 0.25 * temp).multiplyScalar(b);
    col.set([c.r, c.g, c.b], i * 3);
    phase[i] = r() * 6.283;
  }
  names.forEach((n, k) => {
    const i = count + k;
    const [ra, dec, mag, hex] = STARS[n];
    raDecToVec(ra, dec, radius, tmp);
    pos.set([tmp.x, tmp.y, tmp.z], i * 3);
    const br = Math.min(1.0, 0.55 + (3.2 - mag) * 0.18);
    size[i] = 3.2 + Math.max(0, 2.6 - mag) * 2.0;
    c.set(hex).multiplyScalar(1.1 + br);
    col.set([c.r, c.g, c.b], i * 3);
    phase[i] = r() * 6.283;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uVis: { value: 1 }, uScale: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute vec3 aColor; attribute float aPhase;
      uniform float uScale; uniform float uTime; varying vec3 vCol; varying float vTw;
      void main(){
        vCol = aColor;
        vTw = 0.82 + 0.18*sin(uTime*(1.3+fract(aPhase)*2.0)+aPhase*5.0);
        vec4 mv = modelViewMatrix*vec4(position,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = aSize*uScale;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uVis; varying vec3 vCol; varying float vTw;
      void main(){
        float d = length(gl_PointCoord-0.5)*2.0;
        float core = smoothstep(1.0,0.0,d); core = core*core*core;
        float halo = smoothstep(1.0,0.0,d)*0.18;
        gl_FragColor = vec4(vCol*(core+halo)*vTw*uVis, 1.0);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -1;
  return pts;
}

const MW_NOISE_FRAG = /* glsl */ `
  varying vec2 vUv; uniform vec3 uGal; uniform vec3 uGC;
  ${NOISE_GLSL}
  void main(){
    float lon = (vUv.x - 0.5) * 6.2831853, lat = (vUv.y - 0.5) * 3.1415927;
    vec3 d = vec3(cos(lat)*cos(lon), sin(lat), cos(lat)*sin(lon));
    float b = dot(d,uGal);
    float warp = (fbm3(d*3.0)-0.5)*0.22;
    float bb = b + warp;
    float band = exp(-bb*bb/(2.0*0.115*0.115));
    float core = exp(-bb*bb/(2.0*0.045*0.045));
    float n1 = fbm3(d*7.0+2.0);
    float n2 = fbm3(d*18.0+8.0);
    float dust = smoothstep(0.42,0.72,fbm3(d*10.0+21.0 + vec3(0.0,0.0,warp*6.0)));
    float gcBoost = pow(max(dot(d,uGC),0.0),3.0);
    vec3 cool = vec3(0.50,0.60,0.95);
    vec3 warm = vec3(1.0,0.78,0.52);
    vec3 col = cool*band*(0.20+0.75*n1) + warm*core*(0.25+0.6*n2)*(0.4+1.6*gcBoost);
    col *= 1.0 - 0.75*dust*core;
    col += cool*0.02*n2*band;
    gl_FragColor = vec4(col*0.55, 1.0);
  }`;

/** One-time GPU bake of the Milky Way into an equirectangular half-float texture (huge per-frame saving). */
export function bakeMilkyWay(renderer, w = 2048, h = 1024) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const mat = new THREE.ShaderMaterial({
    uniforms: { uGal: { value: raDecToVec(12.857, 27.13, 1) }, uGC: { value: raDecToVec(17.76, -28.94, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: MW_NOISE_FRAG, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const sc = new THREE.Scene(); sc.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.render(sc, cam); renderer.setRenderTarget(prev);
  mat.dispose(); quad.geometry.dispose();
  return rt.texture;
}

/** Milky Way dome sampling the baked texture. */
export function makeMilkyWay(radius = 1450, tex) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uVis: { value: 1 }, uTex: { value: tex } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir; uniform float uVis; uniform sampler2D uTex;
      void main(){
        vec3 d = normalize(vDir);
        vec2 uv = vec2(atan(d.z, d.x)/6.2831853 + 0.5, asin(clamp(d.y,-1.0,1.0))/3.1415927 + 0.5);
        gl_FragColor = vec4(texture2D(uTex, uv).rgb*uVis/0.55*0.55, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), mat);
  m.renderOrder = -2;
  m.frustumCulled = false;
  return m;
}

/** Constellation lines as thin camera-agnostic ribbons with constant angular width. */
export function makeConstellationLines(radius = 1390, widthDeg = 0.09, only = null) {
  const verts = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), side = new THREE.Vector3();
  const w = radius * Math.tan(widthDeg * D2R);
  for (const [cname, pairs] of Object.entries(CONSTELLATIONS)) {
    if (only && !only.includes(cname)) continue;
    for (const [n1, n2] of pairs) {
      const s1 = STARS[n1], s2 = STARS[n2];
      raDecToVec(s1[0], s1[1], radius, a);
      raDecToVec(s2[0], s2[1], radius, b);
      // shorten a little at both ends so lines don't touch the stars
      const dir = b.clone().sub(a);
      const aa = a.clone().addScaledVector(dir, 0.04), bb = b.clone().addScaledVector(dir, -0.04);
      side.copy(dir).cross(a).normalize().multiplyScalar(w);
      verts.push(...aa.clone().add(side).toArray(), ...aa.clone().sub(side).toArray(), ...bb.clone().add(side).toArray());
      verts.push(...bb.clone().add(side).toArray(), ...aa.clone().sub(side).toArray(), ...bb.clone().sub(side).toArray());
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fbcff').multiplyScalar(1.4), transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = -1;
  return m;
}

export function updateStarUniforms(stars, { time, height, vis = 1 }) {
  stars.material.uniforms.uTime.value = time;
  stars.material.uniforms.uScale.value = height / 1080;
  stars.material.uniforms.uVis.value = vis;
}
