import * as THREE from 'three';
import { clamp, lerp, smooth, easeInOut, easeOut, easeInOutSine, D2R, makeGlowTexture, glowSprite, sampleKeys } from '../common.js';
import { makeStarfield, makeMilkyWay, updateStarUniforms } from '../sky.js';
import { makeEarth, makeMoonLitMaterial } from '../bodies.js';

const RING = 6.0;           // exaggerated orbit radius (Earth radius = 1.2 in diagram mode)
const STEP_DEG = 13.2;      // true mean daily motion of the Moon in its orbit

export function createOrbit(ctx) {
  const { tex, aspect, portrait } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, aspect, 0.1, 4000);
  const glowTex = makeGlowTexture();

  const stars = makeStarfield({ count: 9000, seed: 3, radius: 1400 });
  const mw = makeMilkyWay(1450, tex.mw);
  scene.add(mw, stars);

  const sun = new THREE.DirectionalLight(0xfff1dc, 9.5);
  scene.add(sun, sun.target);
  scene.add(new THREE.AmbientLight(0x1a2338, 0.35));

  const earth = makeEarth(tex, 1);
  const earthTilt = new THREE.Group();
  earthTilt.rotation.z = -0.25;
  earthTilt.add(earth);
  scene.add(earthTilt);

  const moonMat = makeMoonLitMaterial(tex.moon, tex.moonBump);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), moonMat);
  scene.add(moon);
  const moonHalo = glowSprite(glowTex, new THREE.Color(0.75, 0.85, 1.0), 1, 0.0);
  scene.add(moonHalo);

  /* diagram props */
  const diagram = new THREE.Group();
  scene.add(diagram);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RING, 0.018, 8, 256), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.7, 1.0).multiplyScalar(1.6), transparent: true, opacity: 0.0 }));
  ring.rotation.x = Math.PI / 2;
  diagram.add(ring);
  const posAt = (deg, r = RING) => new THREE.Vector3(Math.cos(deg * D2R) * r, 0, -Math.sin(deg * D2R) * r);
  const markers = [], lines = [], arcs = [];
  const amber = new THREE.Color(1.0, 0.62, 0.2).multiplyScalar(2.2);
  for (let k = 0; k <= 4; k++) {
    const mk = glowSprite(glowTex, new THREE.Color(1.0, 0.8, 0.45), 0.9, 0);
    mk.position.copy(posAt(k * STEP_DEG));
    diagram.add(mk); markers.push(mk);
    const ln = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: 0 }));
    const p = posAt(k * STEP_DEG, RING);
    ln.position.copy(p).multiplyScalar(0.5);
    ln.scale.y = RING;
    ln.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
    diagram.add(ln); lines.push(ln);
    if (k > 0) {
      const pts = [];
      for (let i = 0; i <= 24; i++) pts.push(posAt((k - 1) * STEP_DEG + (STEP_DEG * i) / 24, 1.95));
      const arc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.045, 8, false), new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: 0 }));
      diagram.add(arc); arcs.push(arc);
    }
  }
  const sunGlow = glowSprite(glowTex, new THREE.Color(1.0, 0.82, 0.5), 22, 0.0);
  const sunStreak = glowSprite(glowTex, new THREE.Color(1.0, 0.9, 0.7), 1, 0.0);
  sunStreak.scale.set(70, 2.2, 1);
  scene.add(sunGlow, sunStreak);

  const v = new THREE.Vector3(), target = new THREE.Vector3();

  function setSun(dir) {
    sun.position.copy(dir).multiplyScalar(100);
    earth.userData.uniforms.uSun.value.copy(dir).normalize();
  }
  function placeMoonFacing(pos, r, faceTarget) {
    moon.position.copy(pos);
    moon.scale.setScalar(r);
    moon.lookAt(faceTarget);
    moon.rotateY(-Math.PI / 2);
  }

  function update(local, params, c) {
    const { t, u, dur } = local;
    const T = c.time;
    const labels = [];
    if (params.mode !== 'diagram') camera.clearViewOffset();
    updateStarUniforms(stars, { time: T, height: c.pxH, vis: 1 });
    mw.material.uniforms.uVis.value = 1.0;
    diagram.visible = params.mode === 'diagram';
    earth.userData.clouds.rotation.y = T * 0.012;

    if (params.mode === 'title') {
      setSun(v.set(-1, 0.18, 0.28).normalize());
      sunGlow.material.opacity = 0; sunStreak.material.opacity = 0;
      const e = easeInOutSine(u);
      const tilt = 0.25;
      earthTilt.rotation.z = -tilt;
      if (!portrait) {
        earthTilt.position.set(0, 0, 0); earthTilt.scale.setScalar(2.05);
        const mp = new THREE.Vector3(8.6, 3.5, 0.6);
        placeMoonFacing(mp, 0.66, earthTilt.position);
        const cam = sampleKeys([[0, -3.5, 1.2, 14.5, 3.4, 0.3], [1, 1.2, 0.6, 11.4, 3.9, 0.2]], e);
        camera.position.set(cam[0], cam[1], cam[2]);
        camera.lookAt(cam[3], cam[4] - 0.2, 0);
        camera.fov = 32;
      } else {
        earthTilt.position.set(-1.2, -3.8, 0); earthTilt.scale.setScalar(2.9);
        placeMoonFacing(new THREE.Vector3(2.2, 4.2, -1), 1.0, earthTilt.position);
        const cam = sampleKeys([[0, -1.0, 0.0, 18.5], [1, 0.4, -0.2, 15.5]], e);
        camera.position.set(cam[0], cam[1], cam[2]);
        camera.lookAt(0.2, 0.2, 0);
        camera.fov = 38;
      }
      earth.rotation.y = 2.0 + T * 0.035;
      moonMat.userData.uniforms.uDetail.value = 0.0;
      moonHalo.position.copy(moon.position); moonHalo.scale.setScalar(moon.scale.x * 5); moonHalo.material.opacity = 0.0;
    } else if (params.mode === 'diagram') {
      setSun(v.set(-1, 0.0, 0.0));
      earthTilt.position.set(0, 0, 0); earthTilt.scale.setScalar(1.2);
      earthTilt.rotation.z = -0.25;
      // moon stepping 4 nights along its orbit
      let s = 0;
      for (let k = 1; k <= 4; k++) s += easeInOut(clamp((t - (14 + 6.5 * (k - 1))) / 2.5));
      const phi = s * STEP_DEG;
      const mp = posAt(phi);
      placeMoonFacing(mp, 0.46, earthTilt.position);
      earth.rotation.y = 2.2 + s * (Math.PI * 2 + STEP_DEG * D2R) + T * 0.05;
      moonMat.userData.uniforms.uDetail.value = 0.0;
      moonHalo.position.copy(mp); moonHalo.scale.setScalar(2.6); moonHalo.material.opacity = 0.35;
      // orbit ring + markers
      const ringIn = smooth(2, 6, t);
      ring.material.opacity = 0.65 * ringIn;
      for (let k = 0; k <= 4; k++) {
        const reached = k === 0 ? smooth(4, 7, t) : smooth(0, 0.4, s - (k - 1) - 0.55);
        markers[k].material.opacity = 0.9 * reached * (k === 0 ? 1 : 1);
        lines[k].material.opacity = 0.35 * reached;
        if (k > 0) arcs[k - 1].material.opacity = 0.95 * smooth(0.5, 1.0, s - (k - 1));
      }
      // sun
      const sunPos = new THREE.Vector3(-24, 0, 0);
      sunGlow.position.copy(sunPos); sunStreak.position.copy(sunPos);
      sunGlow.material.opacity = 0.9; sunStreak.material.opacity = 0.7;
      // camera: swoop down to a high 3/4 view
      const sp = easeInOutSine(clamp(t / 12));
      const elev = lerp(22, 62, sp) * D2R, az = lerp(-26, -6, sp) * D2R + Math.sin(T * 0.1) * 0.02;
      const hfov = 2 * Math.atan(Math.tan(16 * D2R) * aspect);
      const span = portrait ? 8.2 : 11.5;
      const dist = Math.max(span / Math.tan(Math.min(hfov, 32 * D2R) / 2 * 0.98) * 0.5, 15) * lerp(1.42, 1.3, sp);
      const centre = new THREE.Vector3(portrait ? 2.2 : 2.6, 0, 0);
      camera.position.set(centre.x + Math.sin(az) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist + centre.z);
      camera.lookAt(centre);
      camera.fov = 32;
      if (!portrait) camera.setViewOffset(c.pxW, c.pxH, -0.17 * c.pxW, 0.075 * c.pxH, c.pxW, c.pxH); else camera.clearViewOffset();

      // labels
      const la = ringIn;
      labels.push({ pos: new THREE.Vector3(-RING - 4.8, 0.8, 0), text: 'SUN', sub: 'LIGHT COMES FROM THIS SIDE', a: la });
      labels.push({ pos: new THREE.Vector3(0, -1.9, 0.6), text: 'EARTH', sub: '', a: smooth(3, 6, t) });
      const dates = ['OCT 26', 'OCT 27', 'OCT 28', 'OCT 29', 'OCT 30'];
      for (let k = 0; k <= 4; k++) {
        const a = k === 0 ? smooth(4, 7, t) : smooth(0.5, 1, s - (k - 1));
        const p = posAt(k * STEP_DEG, RING + 0.9);
        labels.push({ pos: p, text: dates[k], sub: k === 0 ? 'FULL MOON' : `+${(STEP_DEG * k).toFixed(0)}°`, a: a * (k === 0 ? 1 : 0.95), cls: k === 0 ? 'lbl-key' : '' });
      }
      labels.push({ sx: 0.5, sy: portrait ? 0.93 : 0.94, text: 'NOT TO SCALE', sub: '', a: smooth(2, 4, t) * 0.7, cls: 'hud-note' });
    } else {
      // outro: giant Moon, small Earth in the distance
      setSun(v.set(-0.42, 0.28, 1.0).normalize());
      sunGlow.material.opacity = 0; sunStreak.material.opacity = 0;
      const e = easeInOutSine(u);
      const mr = portrait ? 2.6 : 2.5;
      const mp = new THREE.Vector3(portrait ? 0.4 : 6.2, portrait ? -1.6 : -0.9, 0);
      moon.position.copy(mp); moon.scale.setScalar(mr);
      moon.rotation.set(0, -Math.PI / 2 + 0.2 + e * 0.1, 0);
      moonMat.userData.uniforms.uDetail.value = 0.2;
      moonHalo.position.copy(mp); moonHalo.scale.setScalar(mr * 3.6); moonHalo.material.opacity = 0.16;
      earthTilt.position.set(portrait ? -3.4 : -8.2, portrait ? 5.8 : -3.4, -14); earthTilt.scale.setScalar(portrait ? 1.7 : 1.4);
      earth.rotation.y = 4.1 + T * 0.03;
      camera.position.set(0, 0, lerp(portrait ? 20 : 15.5, portrait ? 17 : 13.2, e));
      camera.lookAt(0, portrait ? 0.4 : 0, 0);
      camera.fov = portrait ? 38 : 32;
    }
    camera.updateProjectionMatrix();
    return { labels };
  }

  return { scene, camera, update };
}
