import * as THREE from 'three';
import { clamp, lerp, smooth, easeInOutSine, easeOut, rng, rangeAt, D2R, NOISE_GLSL, makeGlowTexture, glowSprite, fovForAspect } from '../common.js';
import { makeStarfield, makeMilkyWay, updateStarUniforms } from '../sky.js';
import { makeMoonDiscMaterial } from '../bodies.js';

/* ---------- tiny deterministic 2D noise for terrain ---------- */
const hash2 = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
function vnoise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
function fbm2(x, y) { let a = 0.5, s = 0; for (let i = 0; i < 4; i++) { s += a * vnoise2(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; a *= 0.5; } return s; }

export function terrainH(x, z) {
  const far = smooth(40, 380, -z + Math.abs(x) * 0.35);
  const swell = (fbm2(x * 0.006, z * 0.006) - 0.5);
  return swell * (1.2 + 46 * far * far) + (fbm2(x * 0.05, z * 0.05) - 0.5) * 0.35;
}

/* ---------- procedural harvested-field texture (rows run along -Z toward the Moon) ---------- */
function makeFieldTextures() {
  const S = 1024, c = document.createElement('canvas'), b = document.createElement('canvas');
  c.width = c.height = b.width = b.height = S;
  const g = c.getContext('2d'), gb = b.getContext('2d');
  const r = rng(99), rows = 16, w = S / rows;
  for (let i = 0; i < rows; i++) {
    const x0 = i * w;
    const grad = g.createLinearGradient(x0, 0, x0 + w, 0);
    grad.addColorStop(0, '#2e2718'); grad.addColorStop(0.25, '#4a3f22'); grad.addColorStop(0.5, '#5d4e29'); grad.addColorStop(0.75, '#4a3f22'); grad.addColorStop(1, '#2e2718');
    g.fillStyle = grad; g.fillRect(x0, 0, w, S);
    const gr2 = gb.createLinearGradient(x0, 0, x0 + w, 0);
    gr2.addColorStop(0, '#202020'); gr2.addColorStop(0.5, '#f0f0f0'); gr2.addColorStop(1, '#202020');
    gb.fillStyle = gr2; gb.fillRect(x0, 0, w, S);
  }
  // stubble speckle + dirt variation
  for (let i = 0; i < 90000; i++) {
    const x = r() * S, y = r() * S, a = r();
    g.fillStyle = a > 0.55 ? `rgba(196,164,88,${0.10 + r() * 0.25})` : `rgba(10,8,4,${0.15 + r() * 0.3})`;
    g.fillRect(x, y, 1 + r() * 1.5, 2 + r() * 7);
    gb.fillStyle = a > 0.5 ? `rgba(255,255,255,${0.1 + r() * 0.25})` : `rgba(0,0,0,${0.1 + r() * 0.2})`;
    gb.fillRect(x, y, 1, 2 + r() * 6);
  }
  const col = new THREE.CanvasTexture(c), bump = new THREE.CanvasTexture(b);
  col.colorSpace = THREE.SRGBColorSpace;
  for (const t of [col, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(58, 58); t.anisotropy = 16; }
  return { col, bump };
}

function makeTree(rand, x, z, scale, parts) {
  const trunkH = (2.2 + rand() * 2.2) * scale;
  parts.trunk.push({ x, y: terrainH(x, z) + trunkH / 2, z, sx: 0.16 * scale, sy: trunkH, sz: 0.16 * scale });
  const blobs = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < blobs; i++) {
    const a = rand() * Math.PI * 2, rr = rand() * 1.5 * scale;
    parts.crown.push({
      x: x + Math.cos(a) * rr, y: terrainH(x, z) + trunkH + (rand() * 1.8 - 0.2) * scale, z: z + Math.sin(a) * rr,
      sx: (1.2 + rand() * 1.1) * scale, sy: (1.0 + rand() * 0.9) * scale, sz: (1.2 + rand() * 1.1) * scale, c: rand(),
    });
  }
}

export function createLandscape(ctx) {
  const { tex, aspect } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fovForAspect(34, aspect, 44), aspect, 0.3, 4000);
  scene.fog = new THREE.FogExp2(0x0b1630, 0.0036);
  const glowTex = makeGlowTexture();

  /* sky dome */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { uTwi: { value: 0.5 }, uMoonDir: { value: new THREE.Vector3(0, 0.3, -1) }, uMoonCol: { value: new THREE.Color(1, 0.8, 0.6) }, uMoonGlow: { value: 1 } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir; uniform float uTwi; uniform vec3 uMoonDir; uniform vec3 uMoonCol; uniform float uMoonGlow;
      void main(){
        vec3 d = normalize(vDir); float h = clamp(d.y,0.0,1.0);
        vec3 zenith  = mix(vec3(0.003,0.006,0.018), vec3(0.030,0.060,0.17), uTwi);
        vec3 mid     = mix(vec3(0.010,0.024,0.062), vec3(0.20,0.15,0.30), uTwi);
        vec3 horizon = mix(vec3(0.030,0.055,0.115), vec3(0.95,0.42,0.20), uTwi);
        vec3 col = mix(horizon, mid, smoothstep(0.0,0.20,h));
        col = mix(col, zenith, smoothstep(0.08,0.85,h));
        float c = max(dot(d, normalize(uMoonDir)), 0.0);
        col += uMoonCol*(pow(c,900.0)*2.0 + pow(c,160.0)*0.16 + pow(c,30.0)*0.045 + pow(c,6.0)*0.018)*uMoonGlow;
        col = mix(col, horizon*0.35, smoothstep(0.0,-0.25,d.y));
        gl_FragColor = vec4(col,1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 32), skyMat);
  sky.renderOrder = -3; sky.frustumCulled = false;
  scene.add(sky);

  const stars = makeStarfield({ count: 7000, seed: 5 });
  const mw = makeMilkyWay(1450, tex.mw);
  scene.add(mw, stars);

  /* wispy cloud layer that the moonlight silvers */
  const cloudMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uMoonDir: skyMat.uniforms.uMoonDir, uMoonCol: skyMat.uniforms.uMoonCol, uMoonI: { value: 1 }, uAmt: { value: 0.55 }, uTwi: skyMat.uniforms.uTwi },
    vertexShader: skyMat.vertexShader,
    fragmentShader: /* glsl */ `
      varying vec3 vDir; uniform float uTime; uniform vec3 uMoonDir; uniform vec3 uMoonCol; uniform float uMoonI; uniform float uAmt; uniform float uTwi;
      ${NOISE_GLSL}
      void main(){
        vec3 d = normalize(vDir);
        if (d.y < 0.0) discard;
        vec2 p = d.xz/(d.y+0.10);
        float n  = fbm3(vec3(p*0.50 + vec2(uTime*0.012, 0.0), 1.7));
        float n2 = fbm3(vec3(p*1.70 + 5.0 - vec2(uTime*0.007, 0.0), 3.3));
        float cov = smoothstep(0.50, 0.80, n*0.85 + n2*0.30) * smoothstep(0.0, 0.16, d.y) * (1.0 - smoothstep(0.55, 0.95, d.y));
        float m = max(dot(d, normalize(uMoonDir)), 0.0);
        vec3 base = mix(vec3(0.020,0.030,0.055), vec3(0.45,0.25,0.22), uTwi*0.8*smoothstep(0.35,0.0,d.y));
        vec3 col = base + uMoonCol*(pow(m,30.0)*1.1 + pow(m,6.0)*0.10 + pow(m,2.0)*0.012)*uMoonI;
        gl_FragColor = vec4(col, cov*uAmt);
      }`,
  });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1300, 48, 32), cloudMat);
  clouds.renderOrder = -0.5; clouds.frustumCulled = false;
  scene.add(clouds);

  /* the Moon */
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), makeMoonDiscMaterial(tex.moon));
  moon.renderOrder = -0.8; moon.frustumCulled = false;
  const halo1 = glowSprite(glowTex, new THREE.Color(1, 0.85, 0.65), 1, 0.55);
  const halo2 = glowSprite(glowTex, new THREE.Color(0.7, 0.8, 1.0), 1, 0.22);
  halo1.renderOrder = halo2.renderOrder = -0.7;
  scene.add(moon, halo1, halo2);

  /* lights */
  const moonLight = new THREE.DirectionalLight(0xb7ccff, 2.4);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  Object.assign(moonLight.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 1, far: 700 });
  moonLight.shadow.bias = -0.0006; moonLight.shadow.normalBias = 0.05;
  scene.add(moonLight, moonLight.target);
  const warmFill = new THREE.DirectionalLight(0xff9a62, 0.0);
  warmFill.position.set(-30, 12, 60);
  scene.add(warmFill);
  const hemi = new THREE.HemisphereLight(0x4a6aa8, 0x1a170d, 0.55);
  scene.add(hemi);

  /* ground */
  const ft = makeFieldTextures();
  const geo = new THREE.PlaneGeometry(1000, 1000, 150, 150);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -380);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ft.col, bumpMap: ft.bump, bumpScale: 1.4, roughness: 0.96, metalness: 0, color: 0xb59a78 }));
  ground.receiveShadow = true;
  scene.add(ground);

  /* ridge silhouettes behind the field */
  const ridgeCols = [0x0a1020, 0x0c1426, 0x0f192e];
  [-430, -540, -660].forEach((zz, k) => {
    const g = new THREE.PlaneGeometry(1400, 1, 140, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), top = p.getY(i) > 0;
      const h = 12 + 26 * fbm2(x * 0.004 + k * 9.0, k * 3.0) + 9 * fbm2(x * 0.02 + k, 7.0);
      p.setY(i, top ? h : -4);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: ridgeCols[k], fog: true }));
    m.position.set(0, 0, zz);
    scene.add(m);
  });

  /* instanced trees */
  const rand = rng(4242);
  const parts = { trunk: [], crown: [] };
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (9 + rand() * 22), z = 14 - rand() * 170;
    makeTree(rand, x, z, 0.85 + rand() * 0.9, parts);
  }
  for (let i = 0; i < 26; i++) makeTree(rand, (rand() - 0.5) * 220, -120 - rand() * 180, 1.4 + rand() * 1.4, parts);
  const dummy = new THREE.Object3D();
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.8, 1, 6), new THREE.MeshStandardMaterial({ color: 0x1a120a, roughness: 1 }), parts.trunk.length);
  parts.trunk.forEach((t, i) => { dummy.position.set(t.x, t.y, t.z); dummy.scale.set(t.sx, t.sy, t.sz); dummy.rotation.set(0, i, 0); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix); });
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), parts.crown.length);
  const palette = [new THREE.Color(0x5a2a10), new THREE.Color(0x7a4c14), new THREE.Color(0x3a3a14), new THREE.Color(0x4d1f12), new THREE.Color(0x6b5a1c)];
  parts.crown.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z); dummy.scale.set(t.sx, t.sy, t.sz); dummy.rotation.set(t.c * 3, t.c * 7, 0); dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix); crowns.setColorAt(i, palette[Math.floor(t.c * palette.length) % palette.length]);
  });
  for (const m of [trunks, crowns]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }

  /* hay bales */
  const bales = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.85, 0.85, 1.35, 16), new THREE.MeshStandardMaterial({ color: 0x8a6a30, roughness: 1 }), 30);
  for (let i = 0; i < 30; i++) {
    const x = (i % 2 ? 1 : -1) * (13 + rand() * 32), z = 6 - rand() * 150;
    dummy.position.set(x, terrainH(x, z) + 0.85, z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, rand() * 3, Math.PI / 2); dummy.updateMatrix();
    bales.setMatrixAt(i, dummy.matrix);
  }
  bales.castShadow = bales.receiveShadow = true; bales.frustumCulled = false;
  scene.add(bales);

  /* fence */
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 1.25, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 1 }), 70);
  for (let i = 0; i < 70; i++) { const z = 22 - i * 2.2, x = -8.5 + Math.sin(i * 0.2) * 0.2; dummy.position.set(x, terrainH(x, z) + 0.62, z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); posts.setMatrixAt(i, dummy.matrix); }
  posts.castShadow = true; posts.frustumCulled = false; scene.add(posts);
  for (const hh of [0.5, 1.0]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 154), new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 1 }));
    rail.position.set(-8.5, terrainH(-8.5, -50) + hh, -55); rail.castShadow = true; scene.add(rail);
  }

  /* distant farmhouse with warm windows */
  const farm = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1 });
  const house = new THREE.Mesh(new THREE.BoxGeometry(9, 4.2, 6), wallMat);
  house.position.y = 2.1;
  const roofShape = new THREE.Shape([new THREE.Vector2(-5, 0), new THREE.Vector2(0, 3), new THREE.Vector2(5, 0)]);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 6.6, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0x0d0b0a, roughness: 1 }));
  roof.position.set(0, 4.2, -3.3);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.8), wallMat); chim.position.set(2.6, 6.2, 0);
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.62, 0.22).multiplyScalar(4.5), fog: false });
  const w1 = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.2), winMat); w1.position.set(-2.2, 2.3, 3.02);
  const w2 = w1.clone(); w2.position.x = 0.2;
  const w3 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), winMat); w3.position.set(2.6, 2.2, 3.02);
  farm.add(house, roof, chim, w1, w2, w3);
  farm.position.set(-34, terrainH(-34, -160), -160);
  farm.rotation.y = 0.35;
  farm.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  scene.add(farm);
  const barnGlow = glowSprite(glowTex, new THREE.Color(1.0, 0.55, 0.2), 14, 0.6);
  barnGlow.position.set(-33, farm.position.y + 2.4, -158);
  scene.add(barnGlow);

  /* geese in a V (pure silhouettes) */
  const geese = new THREE.Group();
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x04060a, side: THREE.DoubleSide, fog: false });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.35, 0, 0, -0.45, 1.35, 0.0, -0.15, 0, 0, 0.35, 1.35, 0, -0.15, 0.55, 0, 0.3], 3));
  wingGeo.computeVertexNormals();
  const birds = [];
  for (let i = 0; i < 15; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), birdMat); body.scale.set(0.7, 0.55, 2.2);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.75, 6), birdMat); neck.rotation.x = Math.PI / 2 + 0.2; neck.position.set(0, 0.06, 0.66);
    const wl = new THREE.Mesh(wingGeo, birdMat), wr = new THREE.Mesh(wingGeo, birdMat);
    wr.scale.x = -1;
    g.add(body, neck, wl, wr);
    geese.add(g);
    const rank = Math.ceil(i / 2), side = i === 0 ? 0 : i % 2 ? 1 : -1;
    birds.push({ g, wl, wr, ox: side * rank * 1.6, oz: rank * 1.9, phase: i * 0.7 });
  }
  scene.add(geese);

  /* falling leaves */
  const LEAVES = 170;
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.18, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false }), LEAVES);
  const lc = [new THREE.Color(0xd9741a), new THREE.Color(0xb8431a), new THREE.Color(0xe8a431), new THREE.Color(0x8a3a14)];
  const lr = rng(77), lp = [];
  for (let i = 0; i < LEAVES; i++) {
    lp.push({ x: (lr() - 0.5) * 34, y: lr() * 12, z: -lr() * 40 + 6, fall: 0.35 + lr() * 0.5, drift: (lr() - 0.3) * 0.9, ph: lr() * 6.28, sp: 0.8 + lr() * 2.4, s: 0.7 + lr() * 1.2 });
    leaves.setColorAt(i, lc[i % lc.length]);
  }
  leaves.frustumCulled = false;
  scene.add(leaves);

  const camPos = new THREE.Vector3(), moonDir = new THREE.Vector3(), tmp = new THREE.Vector3();

  function update(local, params, c) {
    const { t, u } = local;
    const T = c.time;
    const lapse = params.mode === 'timelapse';
    let el, az, twi, nightLabel = null, nightSub = null;
    if (lapse) {
      const L = params.lapse, rel = t - L.t0;
      const k = clamp(Math.floor(rel / L.per), 0, params.nights - 1);
      const p = clamp((rel - k * L.per) / L.per, 0, 1);
      el = lerp(params.moonEl[0], params.moonEl[1], easeInOutSine(p));
      if (rel < 0) el = params.moonEl[0] - 6;
      if (rel > params.nights * L.per) el = params.moonEl[1];
      az = params.moonAz[0] + k * 1.1;
      twi = lerp(params.twi[0], params.twi[1], easeOut(p));
      if (rel >= 0 && rel <= params.nights * L.per) {
        nightLabel = `NIGHT ${k + 1} OF ${params.nights}`;
        nightSub = k === 0 ? 'MOONRISE  ·  START' : `MOONRISE  ·  ~${30} MIN LATER`;
      }
    } else {
      const e = easeInOutSine(u);
      el = rangeAt(params.moonEl, e);
      az = rangeAt(params.moonAz, e);
      twi = rangeAt(params.twi, u);
    }
    const g = (params.exag ?? 7.5);

    /* camera */
    const cp = params.cam, pe = params.still ? 0 : easeInOutSine(u);
    const z = rangeAt(cp.z, pe);
    const xoff = ((params.seed ?? 1) % 5 - 2) * 5.5 + Math.sin(T * 0.21) * 0.12;
    camPos.set(xoff, terrainH(xoff, z) + cp.y + Math.sin(T * 0.33) * 0.04, z);
    camera.position.copy(camPos);
    const yaw = rangeAt(cp.yaw, pe) + Math.sin(T * 0.17) * 0.003, pitch = rangeAt(cp.pitch, pe) + Math.sin(T * 0.23) * 0.002;
    camera.rotation.set(0, 0, 0);
    camera.rotateY(-yaw);
    camera.rotateX(pitch);
    camera.updateMatrixWorld();

    /* moon placement */
    const ea = el * D2R, aa = az * D2R;
    moonDir.set(Math.sin(aa) * Math.cos(ea), Math.sin(ea), -Math.cos(aa) * Math.cos(ea));
    const R = 1000 * Math.tan(0.2625 * D2R * g);
    moon.position.copy(camPos).addScaledVector(moonDir, 1000);
    moon.scale.setScalar(R);
    moon.lookAt(camPos); moon.rotateY(-Math.PI / 2);
    halo1.position.copy(moon.position); halo2.position.copy(moon.position);
    halo1.scale.setScalar(R * 6.0); halo2.scale.setScalar(R * 20);

    const low = smooth(0, 24, el);
    const mcol = new THREE.Color().setRGB(lerp(1.0, 0.96, low), lerp(0.50, 0.965, low), lerp(0.20, 1.0, Math.pow(low, 0.8)));
    moon.material.uniforms.uColor.value.copy(mcol);
    const vis = smooth(-3, 1.2, el);
    moon.material.uniforms.uInt.value = (3.0 + 2.6 * low) * vis;
    halo1.material.color.copy(mcol); halo1.material.opacity = (0.22 - 0.06 * low) * vis * (params.haloBoost ?? 1);
    halo2.material.opacity = (0.07 + 0.04 * (1 - low)) * vis;
    sky.position.copy(camPos); clouds.position.copy(camPos); stars.position.copy(camPos); mw.position.copy(camPos);
    skyMat.uniforms.uTwi.value = twi;
    skyMat.uniforms.uMoonDir.value.copy(moonDir);
    skyMat.uniforms.uMoonCol.value.copy(mcol);
    skyMat.uniforms.uMoonGlow.value = vis;
    cloudMat.uniforms.uTime.value = T;
    cloudMat.uniforms.uMoonI.value = vis * (0.9 + 0.8 * low);
    cloudMat.uniforms.uAmt.value = params.clouds ?? 0.6;

    const starVis = Math.pow(1 - twi, 1.4) * (1 - 0.45 * smooth(2, 30, el));
    updateStarUniforms(stars, { time: T, height: c.pxH, vis: starVis });
    mw.material.uniforms.uVis.value = starVis * 0.55;

    /* lighting follows the moon */
    const li = 2.3 * smooth(-1.5, 7, el);
    moonLight.intensity = li;
    moonLight.color.copy(mcol).lerp(new THREE.Color(0xaec6ff), 0.45);
    moonLight.target.position.set(camPos.x, camPos.y - 1, camPos.z - 45);
    moonLight.position.copy(moonLight.target.position).addScaledVector(moonDir, 300);
    moonLight.target.updateMatrixWorld();
    warmFill.intensity = 0.75 * Math.pow(twi, 1.2);
    warmFill.position.set(camPos.x - 20, camPos.y + 25, camPos.z + 60);
    hemi.intensity = 0.34 + 0.4 * twi;
    hemi.color.setRGB(lerp(0.2, 0.55, twi), lerp(0.3, 0.45, twi), lerp(0.55, 0.6, twi));
    scene.fog.color.setRGB(lerp(0.02, 0.38, twi * twi), lerp(0.045, 0.22, twi * twi), lerp(0.10, 0.28, twi * twi));
    scene.fog.density = 0.0032 + 0.0012 * twi;

    /* geese */
    const gz = params.geese;
    geese.visible = !!gz && t > gz.t0 && t < gz.t1;
    if (geese.visible) {
      const gp = (t - gz.t0) / (gz.t1 - gz.t0);
      const right = tmp.set(1, 0, 0).applyQuaternion(camera.quaternion).clone();
      const center = camPos.clone().addScaledVector(moonDir, 120).addScaledVector(right, lerp(48, -52, gp)).add(new THREE.Vector3(0, Math.sin(gp * 6) * 0.6 + 1.5, 0));
      const heading = Math.atan2(-right.x, -right.z);
      for (const b of birds) {
        const f = Math.sin(T * 8.2 + b.phase);
        b.g.position.set(b.ox * Math.cos(heading) - b.oz * Math.sin(heading), Math.sin(T * 1.1 + b.phase) * 0.15, -b.ox * Math.sin(heading) - b.oz * Math.cos(heading)).add(center);
        b.g.rotation.set(0, heading, 0);
        b.wl.rotation.z = -0.15 + f * 0.62; b.wr.rotation.z = 0.15 - f * 0.62;
        b.g.scale.setScalar(2.0);
      }
    }

    /* leaves */
    const forward = tmp.set(0, 0, -1).applyQuaternion(camera.quaternion).clone();
    const lintensity = params.leaves ?? 1;
    for (let i = 0; i < LEAVES; i++) {
      const l = lp[i];
      const active = i < LEAVES * lintensity;
      const yy = ((l.y - l.fall * T) % 12 + 12) % 12;
      const xx = l.x + l.drift * Math.sin(T * 0.4 + l.ph) * 2 + T * 0.35;
      const wrappedX = ((xx + 17) % 34 + 34) % 34 - 17;
      dummy.position.set(camPos.x + wrappedX, camPos.y - 1.4 + yy, camPos.z + l.z);
      dummy.rotation.set(T * l.sp + l.ph, T * l.sp * 0.7, T * l.sp * 0.4);
      dummy.scale.setScalar(active ? l.s * 0.55 : 0.0001);
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    }
    leaves.instanceMatrix.needsUpdate = true;

    const labels = [];
    if (nightLabel) labels.push({ sx: 0.5, sy: ctx.portrait ? 0.11 : 0.09, text: nightLabel, sub: nightSub, a: 1, cls: 'hud-night' });
    return { labels };
  }

  return { scene, camera, update };
}
