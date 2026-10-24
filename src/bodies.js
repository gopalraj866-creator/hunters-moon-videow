import * as THREE from 'three';
import { NOISE_GLSL } from './common.js';

/** Self-luminous full-Moon disc (used when the Moon is a sky object): limb darkening + HDR glow. */
export function makeMoonDiscMaterial(map) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      uMap: { value: map }, uColor: { value: new THREE.Color(1, 1, 1) }, uInt: { value: 3.2 }, uContrast: { value: 1.12 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uColor; uniform float uInt; uniform float uContrast;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 c = texture2D(uMap, vUv).rgb;
        c = pow(max(c, vec3(0.0)), vec3(uContrast));
        float mu = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        float limb = 0.52 + 0.48*pow(mu, 0.42);
        gl_FragColor = vec4(c*uColor*uInt*limb, 1.0);
      }`,
  });
}

/**
 * Physically lit Moon (directional light) + procedural crater / regolith detail so close-ups stay crisp
 * even though the source texture is only 1K. uDetail 0..1 fades the detail in as the camera approaches.
 */
export function makeMoonLitMaterial(map, bump) {
  const m = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.2, roughness: 0.98, metalness: 0 });
  const uniforms = { uDetail: { value: 0 }, uBumpDetail: { value: 1.0 } };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vDUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvDUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        varying vec2 vDUv; uniform float uDetail; uniform float uBumpDetail;
        ${NOISE_GLSL}
        float craterLayer(vec2 p, float seed){
          float fw = length(fwidth(p)); float wgt = 1.0 - smoothstep(0.10, 0.45, fw);
          if (wgt < 0.01) return 0.0;
          vec2 id = floor(p), f = fract(p); float h = 0.0;
          for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
            vec2 nb = vec2(float(i), float(j));
            vec2 cid = id + nb + seed;
            vec2 rc = hash22(cid);
            float present = step(0.38, hash21(cid+7.3));
            float r = mix(0.12, 0.42, hash21(cid+3.1));
            float d = length(f - (nb + rc));
            float bowl = -(1.0 - clamp(d/r,0.0,1.0)*clamp(d/r,0.0,1.0)) * step(d, r);
            float rim = smoothstep(r*1.45, r, d) * smoothstep(r*0.78, r, d) * 0.55;
            h += present * (bowl*0.9 + rim) * r;
          }
          return h * wgt;
        }
        float lunarDetail(vec2 uv){
          vec2 p = vec2(uv.x*2.0, uv.y);
          float h = craterLayer(p*38.0, 1.0)*1.0 + craterLayer(p*96.0, 5.0)*0.55 + craterLayer(p*240.0, 9.0)*0.32 + craterLayer(p*620.0, 13.0)*0.18;
          h += (vnoise(vec3(p*1700.0,1.0))-0.5)*0.05*(1.0-smoothstep(0.1,0.4,length(fwidth(p*1700.0))));
          return h;
        }`)
      .replace('#include <map_fragment>', /* glsl */ `#include <map_fragment>
        float dH = lunarDetail(vDUv);
        diffuseColor.rgb *= 1.0 + uDetail*(dH*0.30);`)
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
        if (uDetail > 0.001) {
          vec2 dh = vec2(dFdx(dH), dFdy(dH)) * uBumpDetail * uDetail * 38.0;
          normal = perturbNormalArb(-vViewPosition, normal, dh, faceDirection);
        }`);
  };
  return m;
}

/** Earth: day/night terminator, city lights, ocean glint, clouds and atmosphere shells. */
export function makeEarth(tex, radius = 1) {
  const g = new THREE.Group();
  const sunDir = new THREE.Vector3(-1, 0.1, 0.2).normalize();
  const uniforms = {
    uDay: { value: tex.earthDay }, uNight: { value: tex.earthNight }, uSpec: { value: tex.earthSpec }, uNormal: { value: tex.earthNormal },
    uSun: { value: sunDir },
  };
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 128, 96),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
        void main(){ vUv = uv; vWN = normalize(mat3(modelMatrix)*normal); vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uDay, uNight, uSpec, uNormal; uniform vec3 uSun;
        varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
        void main(){
          vec3 N = normalize(vWN), L = normalize(uSun), V = normalize(cameraPosition - vWP);
          vec3 day = texture2D(uDay, vUv).rgb;
          vec3 night = texture2D(uNight, vUv).rgb;
          float spec = texture2D(uSpec, vUv).r;
          float ndl = dot(N, L);
          float lit = smoothstep(-0.06, 0.28, ndl);
          vec3 col = day*max(ndl,0.0)*1.55*(0.25+0.75*lit) + day*0.012;
          vec3 R = reflect(-L, N);
          col += vec3(1.0,0.95,0.85)*pow(max(dot(R,V),0.0), 38.0)*spec*0.9*lit;
          col += night*vec3(1.0,0.72,0.38)*2.1*(1.0-lit);
          float term = exp(-pow(ndl/0.09, 2.0));
          col += vec3(1.0,0.42,0.18)*term*0.30*dot(day, vec3(0.33));
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  g.add(globe);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.006, 96, 64),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uCl: { value: tex.clouds }, uSun: uniforms.uSun },
      vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vWN; void main(){ vUv = uv; vWN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uCl; uniform vec3 uSun; varying vec2 vUv; varying vec3 vWN;
        void main(){
          vec4 c = texture2D(uCl, vUv);
          float a = c.r*0.9;
          float ndl = dot(normalize(vWN), normalize(uSun));
          float lit = smoothstep(-0.05, 0.3, ndl);
          vec3 col = vec3(1.0)*max(ndl,0.0)*1.5*lit + vec3(0.9,0.5,0.35)*exp(-pow(ndl/0.1,2.0))*0.25;
          gl_FragColor = vec4(col, a*(0.08+0.92*lit));
        }`,
    })
  );
  g.add(clouds);

  const atmo = (r, back, power, k) =>
    new THREE.Mesh(
      new THREE.SphereGeometry(radius * r, 96, 64),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: back ? THREE.BackSide : THREE.FrontSide,
        uniforms: { uSun: uniforms.uSun, uPow: { value: power }, uK: { value: k } },
        vertexShader: /* glsl */ `varying vec3 vWN; varying vec3 vWP; void main(){ vWN = normalize(mat3(modelMatrix)*normal); vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun; uniform float uPow; uniform float uK; varying vec3 vWN; varying vec3 vWP;
          void main(){
            vec3 N = normalize(vWN), V = normalize(cameraPosition - vWP);
            float f = ${back ? 'pow(clamp(0.72 - dot(N, V), 0.0, 1.0), uPow)' : 'pow(1.0 - abs(dot(N, V)), uPow)'};
            float sunlit = clamp(dot(normalize(vWN), normalize(uSun))*0.9 + 0.25, 0.0, 1.0);
            vec3 col = mix(vec3(0.20,0.45,1.0), vec3(1.0,0.55,0.28), pow(1.0-clamp(dot(N,normalize(uSun))*2.0+0.5,0.0,1.0), 4.0)*0.6);
            gl_FragColor = vec4(col*f*uK*sunlit, 1.0);
          }`,
      })
    );
  g.add(atmo(1.018, false, 2.6, 1.35));
  g.add(atmo(1.16, true, 3.2, 3.2));
  g.userData = { uniforms, globe, clouds };
  return g;
}

/** Moon with correct phase for sky charts: lit by a world-space Sun direction (no scene lights needed). */
export function makeMoonPhaseMaterial(map) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uMap: { value: map }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uInt: { value: 3.0 }, uTint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWN;
      void main(){ vUv = uv; vWN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uSun; uniform float uInt; uniform vec3 uTint; varying vec2 vUv; varying vec3 vWN;
      void main(){
        vec3 c = pow(texture2D(uMap, vUv).rgb, vec3(1.1));
        float ndl = dot(normalize(vWN), normalize(uSun));
        float lit = smoothstep(-0.03, 0.14, ndl);
        gl_FragColor = vec4(c*uTint*uInt*(lit + 0.035), 1.0);
      }`,
  });
}
