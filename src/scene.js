import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const ORBIT_RADII = [8.0, 10.8, 13.6, 16.4, 19.2, 22.0];
const PLANET_R = 0.95;
const TWO_PI = Math.PI * 2;

function easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

function radialTexture(inner = '#ffffff', outer = 'rgba(255,255,255,0)', size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture(color, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, color);
  grad.addColorStop(0.5, color.replace(/[\d.]+\)$/, '0.22)'));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createScene({ canvas, apps, quality = 'high', isPhone = false, seed = 0 }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality === 'high' && !isPhone,
    powerPreference: 'high-performance',
    alpha: false,
    stencil: false,
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 1);

  const maxDpr = isPhone ? 1.5 : 2;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  if (quality === 'medium') dpr = Math.min(dpr, isPhone ? 1 : 1.25);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  camera.position.set(0, 30, 220);

  // Environment (studio, no downloaded HDR)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.4;
  pmrem.dispose();

  // Lights: big soft key from above, cool rim from below
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));
  const key = new THREE.DirectionalLight(0xfff4e0, 2.4);
  key.position.set(4, 14, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb8ff, 1.3);
  rim.position.set(-3, -10, -6);
  scene.add(rim);
  const coreLight = new THREE.PointLight(0xffc252, 60, 40, 1.6);
  scene.add(coreLight);

  // System group (slight cinematic tilt)
  const system = new THREE.Group();
  system.rotation.x = -0.32;
  system.rotation.z = 0.08;
  scene.add(system);

  // Stars
  const starTex = radialTexture('#ffffff', 'rgba(255,255,255,0)', 64);
  function makeStars(count, rMin, rMax, size, opacity) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = rMin + Math.random() * (rMax - rMin);
      const th = Math.random() * TWO_PI;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size, map: starTex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, color: 0xdfe8ff });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }
  const stars = makeStars(isPhone ? 900 : 1600, 60, 160, 1.1, 0.9);
  const starsFar = makeStars(isPhone ? 500 : 900, 160, 300, 1.6, 0.5);
  scene.add(stars, starsFar);

  // Core: crystal + light orb
  const core = new THREE.Group();
  const crystalGeo = new THREE.IcosahedronGeometry(0.95, 1);
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff1c9, metalness: 0, roughness: 0.08,
    transmission: quality === 'high' ? 0.85 : 0, thickness: 1.6, ior: 1.7,
    transparent: quality !== 'high', opacity: quality === 'high' ? 1 : 0.55,
    emissive: 0xffb347, emissiveIntensity: 0.35, flatShading: true,
    clearcoat: 1, clearcoatRoughness: 0.05,
  });
  const crystal = new THREE.Mesh(crystalGeo, crystalMat);
  core.add(crystal);
  const orbMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), orbMat);
  core.add(orb);
  const coreGlowTex = glowTexture('rgba(255,196,80,0.9)');
  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreGlowTex, color: 0xffd080, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
  coreGlow.scale.set(5.5, 5.5, 1);
  core.add(coreGlow);
  const coreHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreGlowTex, color: 0xffb050, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  coreHalo.scale.set(13, 13, 1);
  core.add(coreHalo);
  system.add(core);

  // Orbits
  const orbitMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, depthWrite: false });
  ORBIT_RADII.forEach((r) => {
    const pts = [];
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * TWO_PI;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    system.add(new THREE.LineLoop(geo, orbitMat));
  });

  // Planets
  const sphereGeo = new THREE.SphereGeometry(PLANET_R, isPhone ? 36 : 56, isPhone ? 24 : 40);
  const warmGlowTex = glowTexture('rgba(255,190,70,0.85)');
  const coldGlowTex = glowTexture('rgba(112,184,255,0.7)');
  const sparkTex = radialTexture('#ffffff', 'rgba(255,255,255,0)', 32);

  const rand = mulberry32(1234 + seed);
  const planets = apps.map((app, i) => {
    const g = new THREE.Group();
    const r = ORBIT_RADII[i % ORBIT_RADII.length];
    const live = app.status === 'live';
    const p = {
      app, group: g, radius: r, live,
      angle: (i * 1.07 + 0.6) % TWO_PI,
      speed: (TWO_PI / (140 + i * 38)) * (i % 2 ? 1 : 1),
      offset: new THREE.Vector3(), vel: new THREE.Vector3(),
      mesh: null, ring: null, extras: [], glow: null, light: null, particles: [],
      hover: 0, t: rand() * 10,
    };
    const mat = app.material;
    let mesh;
    if (mat === 'chrome' && live) {
      mesh = new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({ color: 0xd8d8dc, metalness: 1, roughness: 0.14, emissive: 0xff9a2e, emissiveIntensity: 0.28, envMapIntensity: 0.75 }));
      const inner = new THREE.Sprite(new THREE.SpriteMaterial({ map: warmGlowTex, color: 0xffb347, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
      inner.scale.set(2.8, 2.8, 1);
      g.add(inner); p.glow = inner;
      const light = new THREE.PointLight(0xffb347, 6, 8, 1.8);
      g.add(light); p.light = light;
    } else if (mat === 'glass' && live) {
      mesh = new THREE.Mesh(sphereGeo, new THREE.MeshPhysicalMaterial({
        color: 0xfff6ea, metalness: 0, roughness: 0.06,
        transmission: quality === 'high' ? 1 : 0, thickness: 0.6, ior: 1.3,
        transparent: quality !== 'high', opacity: quality === 'high' ? 1 : 0.28,
        clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.0,
        emissive: 0xffc78a, emissiveIntensity: 0.08, depthWrite: false,
      }));
      mesh.renderOrder = 1;
      const seasons = [0x9be36b, 0xffd166, 0xff8c42, 0xa8dcff];
      seasons.forEach((col, s) => {
        const n = isPhone ? 40 : 70;
        const pos = new Float32Array(n * 3);
        const base = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) {
          const v = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(0.25 + rand() * 0.42);
          const qa = (s / 4) * TWO_PI;
          v.x += Math.cos(qa) * 0.28; v.z += Math.sin(qa) * 0.28;
          base.set([v.x, v.y, v.z], k * 3);
          pos.set([v.x, v.y, v.z], k * 3);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, map: sparkTex, color: col, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
        pts.userData = { base, phase: s * 1.7 };
        pts.renderOrder = 2;
        g.add(pts); p.particles.push(pts);
      });
      const inner = new THREE.Sprite(new THREE.SpriteMaterial({ map: warmGlowTex, color: 0xffc78a, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
      inner.scale.set(3.2, 3.2, 1);
      g.add(inner); p.glow = inner;
      const light = new THREE.PointLight(0xffc78a, 3, 7, 1.8);
      g.add(light); p.light = light;
    } else {
      // Coming soon: frozen. Gold medal keeps its gold core under the frost.
      if (mat === 'gold') {
        const gold = new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({ color: 0xffc85c, metalness: 1, roughness: 0.2 }));
        gold.scale.setScalar(0.82);
        g.add(gold); p.extras.push(gold);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.07, 10, 64), new THREE.MeshStandardMaterial({ color: 0xffd27a, metalness: 1, roughness: 0.18 }));
        ring.rotation.x = Math.PI / 2.6;
        g.add(ring); p.extras.push(ring);
      } else if (app.id === 'three-screens') {
        const slabMat = new THREE.MeshStandardMaterial({ color: 0xdff0ff, metalness: 0.2, roughness: 0.4, emissive: 0x2a4a6b, emissiveIntensity: 0.5 });
        [[0.9, 0.55], [0.3, 0.55], [0.3, 0.5]].forEach((s, k) => {
          const slab = new THREE.Mesh(new THREE.BoxGeometry(s[0] * 0.7, s[1] * 0.7, 0.03), slabMat);
          slab.position.set((k - 1) * 0.32, 0, (k - 1) * 0.12);
          slab.rotation.y = (k - 1) * 0.5;
          g.add(slab); p.extras.push(slab);
        });
      } else if (app.id === 'order-agent') {
        const dotMat = new THREE.MeshStandardMaterial({ color: 0xdff0ff, emissive: 0x70b8ff, emissiveIntensity: 0.8 });
        const dotGeo = new THREE.SphereGeometry(0.07, 10, 8);
        for (let k = 0; k < 8; k++) {
          const d = new THREE.Mesh(dotGeo, dotMat);
          const a = (k / 8) * TWO_PI;
          d.position.set(Math.cos(a) * 0.55, Math.sin(a * 2) * 0.15, Math.sin(a) * 0.55);
          g.add(d); p.extras.push(d);
        }
      } else if (app.id === 'logo-motion') {
        const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.38, 0.1, 64, 10), new THREE.MeshStandardMaterial({ color: 0xdff0ff, metalness: 0.6, roughness: 0.3, emissive: 0x2a4a6b, emissiveIntensity: 0.6 }));
        g.add(knot); p.extras.push(knot);
      }
      mesh = new THREE.Mesh(sphereGeo, new THREE.MeshPhysicalMaterial({
        color: 0xbfdcff, metalness: 0, roughness: 0.58,
        transmission: quality === 'high' ? 0.6 : 0, thickness: 1.2, ior: 1.31,
        transparent: true, opacity: quality === 'high' ? 1 : 0.72,
        emissive: 0x16304d, emissiveIntensity: 0.5,
        clearcoat: 0.6, clearcoatRoughness: 0.35, envMapIntensity: 0.9,
      }));
      mesh.scale.setScalar(1.02);
      // Frost sparkle
      const n = isPhone ? 60 : 110;
      const pos = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) {
        const v = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(PLANET_R * (1.05 + rand() * 0.5));
        pos.set([v.x, v.y, v.z], k * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const spark = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.05, map: sparkTex, color: 0xdff0ff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(spark); p.particles.push(spark);
      const cold = new THREE.Sprite(new THREE.SpriteMaterial({ map: coldGlowTex, color: 0x70b8ff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
      cold.scale.set(3.4, 3.4, 1);
      g.add(cold); p.glow = cold;
    }
    mesh.userData.planet = p;
    g.add(mesh);
    p.mesh = mesh;

    if (live) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.012, 6, 96), new THREE.MeshBasicMaterial({ color: 0xffca16, transparent: true, opacity: 0.7, depthWrite: false }));
      ring.rotation.x = Math.PI / 2;
      g.add(ring); p.ring = ring;
    }
    system.add(g);
    return p;
  });

  // Post-processing
  let composer = null, bloomPass = null;
  function buildComposer() {
    if (composer) composer.dispose();
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    if (quality === 'high') {
      bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.5, 0.9);
      composer.addPass(bloomPass);
    } else bloomPass = null;
    composer.addPass(new OutputPass());
  }
  buildComposer();

  // Camera director
  const state = {
    shot: 0, // 0 = wide, 1..n = planets
    mode: 'intro', // intro | film | dive
    time: 0,
    width: 1, height: 1, portrait: false,
    camPos: new THREE.Vector3(0, 30, 220),
    camTarget: new THREE.Vector3(0, 0, 0),
    desiredPos: new THREE.Vector3(),
    desiredTarget: new THREE.Vector3(),
    tween: null,
    diveT: 0,
    lastShotChange: 0,
    paused: false,
  };

  const worldUp = new THREE.Vector3(0, 1, 0);
  const tmpV = new THREE.Vector3(), tmpF = new THREE.Vector3(), tmpR = new THREE.Vector3(), tmpU = new THREE.Vector3();

  function planetWorldPos(p, out) {
    return p.group.getWorldPosition(out);
  }

  function wideShot(outPos, outTarget, t) {
    const a = t * 0.04;
    const portrait = state.portrait;
    outPos.set(Math.sin(a) * 6, (portrait ? 36 : 23) + Math.sin(t * 0.11) * 0.6, (portrait ? 54 : 34) + Math.cos(a) * 1.5);
    outTarget.set(portrait ? 0 : -3.5, portrait ? 4 : -0.5, 0);
  }

  function heroShot(p, outPos, outTarget, t) {
    planetWorldPos(p, tmpV);
    const dist = state.portrait ? 7.8 : 6.2;
    // direction from planet to camera: outward from core, raised, and side-stepped so the core stays in frame
    const radial = tmpV.clone().setY(0).normalize();
    const tangent = new THREE.Vector3(-radial.z, 0, radial.x);
    const dir = radial.multiplyScalar(0.75).add(tangent.multiplyScalar(0.6)).add(worldUp.clone().multiplyScalar(0.36)).normalize();
    outPos.copy(tmpV).addScaledVector(dir, dist);
    outPos.y += Math.sin(t * 0.5 + p.t) * 0.08;
    tmpF.subVectors(tmpV, outPos).normalize();
    tmpR.crossVectors(tmpF, worldUp).normalize();
    tmpU.crossVectors(tmpR, tmpF).normalize();
    outTarget.copy(tmpV);
    if (state.portrait) outTarget.addScaledVector(tmpU, -1.15);
    else outTarget.addScaledVector(tmpR, -1.25).addScaledVector(tmpU, -0.15);
  }

  function computeDesired(t) {
    if (state.shot === 0) wideShot(state.desiredPos, state.desiredTarget, t);
    else heroShot(planets[state.shot - 1], state.desiredPos, state.desiredTarget, t);
  }

  function resize(w, h) {
    state.width = w; state.height = h; state.portrait = h > w * 1.05;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setPixelRatio(v) {
    dpr = v;
    renderer.setPixelRatio(v);
    composer.setPixelRatio(v);
    resize(state.width, state.height);
  }

  function disableBloom() {
    if (quality === 'high') {
      quality = 'medium';
      buildComposer();
      composer.setSize(state.width, state.height);
      // cheaper glass
      planets.forEach((p) => {
        const m = p.mesh.material;
        if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = p.live ? 0.28 : 0.72; m.needsUpdate = true; }
      });
      if (crystalMat.transmission > 0) { crystalMat.transmission = 0; crystalMat.transparent = true; crystalMat.opacity = 0.55; crystalMat.needsUpdate = true; }
    }
  }

  // Public control
  function goTo(shot, immediate = false) {
    shot = ((shot % (planets.length + 1)) + planets.length + 1) % (planets.length + 1);
    state.shot = shot;
    state.lastShotChange = state.time;
    if (immediate) { placePlanets(0); computeDesired(state.time); state.camPos.copy(state.desiredPos); state.camTarget.copy(state.desiredTarget); }
  }

  function startIntroFlight(duration = 3.2) {
    state.mode = 'intro';
    const from = state.camPos.clone();
    const fromT = state.camTarget.clone();
    state.tween = {
      t0: state.time, dur: duration,
      update: (k) => {
        const e = easeInOutCubic(k);
        computeDesired(state.time);
        state.camPos.lerpVectors(from, state.desiredPos, e);
        state.camTarget.lerpVectors(fromT, state.desiredTarget, e);
      },
      done: () => { state.mode = 'film'; },
    };
  }

  function skipIntro() {
    if (state.mode === 'intro') { state.tween = null; state.mode = 'film'; placePlanets(0); computeDesired(state.time); state.camPos.copy(state.desiredPos); state.camTarget.copy(state.desiredTarget); }
  }

  function dive(planetIndex, onDone) {
    const p = planets[planetIndex];
    state.mode = 'dive';
    const from = state.camPos.clone();
    const fromT = state.camTarget.clone();
    state.tween = {
      t0: state.time, dur: 1.1,
      update: (k) => {
        const e = easeInOutCubic(k);
        planetWorldPos(p, tmpV);
        const dir = tmpV.clone().sub(from).normalize();
        const to = tmpV.clone().addScaledVector(dir, -0.35);
        state.camPos.lerpVectors(from, to, e);
        state.camTarget.lerpVectors(fromT, tmpV, e);
        state.diveT = e;
      },
      done: () => { state.diveT = 1; onDone && onDone(); },
    };
  }

  function undive() {
    const from = state.camPos.clone();
    const fromT = state.camTarget.clone();
    state.mode = 'film';
    state.tween = {
      t0: state.time, dur: 1.2,
      update: (k) => {
        const e = easeOutCubic(k);
        computeDesired(state.time);
        state.camPos.lerpVectors(from, state.desiredPos, e);
        state.camTarget.lerpVectors(fromT, state.desiredTarget, e);
        state.diveT = 1 - e;
      },
      done: () => { state.diveT = 0; },
    };
  }

  function shake(strength = 1) {
    planets.forEach((p) => {
      const v = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.6, rand() - 0.5).normalize().multiplyScalar((6 + rand() * 6) * strength);
      p.vel.add(v);
    });
  }

  // Raycast helper
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(x, y) {
    ndc.set((x / state.width) * 2 - 1, -(y / state.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(planets.map((p) => p.mesh), false);
    if (hits.length) return planets.indexOf(hits[0].object.userData.planet);
    // forgiving tap radius on phones: nearest planet within ~70px
    let best = -1, bestD = 70 * dpr;
    planets.forEach((p, i) => {
      planetWorldPos(p, tmpV).project(camera);
      if (tmpV.z > 1) return;
      const sx = (tmpV.x + 1) / 2 * state.width, sy = (1 - tmpV.y) / 2 * state.height;
      const d = Math.hypot(sx - x, sy - y) * dpr;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  function placePlanets(dt) {
    planets.forEach((p, i) => {
      if (state.mode !== 'dive' || state.shot - 1 !== i) p.angle += p.speed * dt;
      p.vel.addScaledVector(p.offset, -6 * dt);
      p.vel.multiplyScalar(Math.max(0, 1 - 2.2 * dt));
      p.offset.addScaledVector(p.vel, dt);
      p.group.position.set(Math.cos(p.angle) * p.radius + p.offset.x, p.offset.y, Math.sin(p.angle) * p.radius + p.offset.z);
    });
    system.updateMatrixWorld(true);
  }

  // Frame
  const timer = new THREE.Timer();
  function update(fixedDt) {
    timer.update();
    const dt = fixedDt != null ? fixedDt : Math.min(timer.getDelta(), 0.05);
    state.time += dt;
    const t = state.time;

    placePlanets(dt);
    planets.forEach((p, i) => {
      p.mesh.rotation.y += dt * 0.25;
      if (p.ring) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + p.t);
        p.ring.scale.setScalar(1 + pulse * 0.12);
        if (state.mode !== 'poster') p.ring.material.opacity = 0.25 + pulse * 0.55;
        p.ring.lookAt(camera.position);
      }
      p.particles.forEach((pts) => {
        const d = pts.userData;
        if (!d.base) { pts.rotation.y += dt * 0.15; pts.rotation.x = Math.sin(t * 0.3) * 0.2; return; }
        const arr = pts.geometry.attributes.position.array;
        const b = d.base;
        for (let k = 0; k < arr.length; k += 3) {
          arr[k] = b[k] + Math.sin(t * 0.9 + k * 0.37 + d.phase) * 0.06;
          arr[k + 1] = b[k + 1] + Math.cos(t * 0.7 + k * 0.21 + d.phase) * 0.06;
          arr[k + 2] = b[k + 2] + Math.sin(t * 0.8 + k * 0.53 + d.phase) * 0.06;
        }
        pts.geometry.attributes.position.needsUpdate = true;
        pts.rotation.y = t * 0.25 + d.phase;
      });
      p.extras.forEach((e, k) => { e.rotation.y += dt * (0.3 + k * 0.1); });
      if (p.glow && p.live) p.glow.material.opacity = 0.75 + 0.2 * Math.sin(t * 1.6 + p.t);
    });

    // Core
    crystal.rotation.y += dt * 0.18;
    crystal.rotation.x = Math.sin(t * 0.21) * 0.25;
    const breath = 1 + Math.sin(t * 1.1) * 0.04;
    coreGlow.scale.set(5.5 * breath, 5.5 * breath, 1);
    coreLight.intensity = 55 + Math.sin(t * 1.1) * 8;

    // Camera
    if (state.tween) {
      const k = Math.min(1, (t - state.tween.t0) / state.tween.dur);
      state.tween.update(k);
      if (k >= 1) { const d = state.tween.done; state.tween = null; d && d(); }
    } else if (state.mode === 'film') {
      computeDesired(t);
      const since = t - state.lastShotChange;
      // fast but critically-damped approach right after a cut, soft follow afterwards
      const k = since < 2.4 ? 3.2 : 2.0;
      const a = 1 - Math.exp(-dt * k);
      state.camPos.lerp(state.desiredPos, a);
      state.camTarget.lerp(state.desiredTarget, a);
      const dCore = state.camPos.length();
      if (dCore < 9) state.camPos.multiplyScalar(THREE.MathUtils.lerp(dCore, 9, a) / dCore);
    }
    camera.position.copy(state.camPos);
    camera.lookAt(state.camTarget);
    // subtle handheld
    camera.rotation.z += Math.sin(t * 0.37) * 0.004;

    if (bloomPass && state.mode === 'dive') bloomPass.strength = 0.5 + state.diveT * 1.2;
    composer.render();
  }

  // Deterministic poster pose for og.jpg (no DOM, brightened)
  function posterPose() {
    const y = planets[0], ti = planets[1];
    y.angle = 1.2; ti.angle = 1.95;
    planets[2].angle = 4.4; planets[3].angle = 3.6; planets[4].angle = 5.3; planets[5].angle = 0.2;
    renderer.toneMappingExposure = 1.4;
    if (bloomPass) { bloomPass.strength = 1.05; bloomPass.threshold = 0.6; }
    coreGlow.scale.set(8, 8, 1);
    orbitMat.opacity = 0.2;
    planets.forEach((p) => { if (p.glow) p.glow.material.opacity *= 1.4; if (p.ring) p.ring.material.opacity = 0.35; });
    state.mode = 'poster';
    update(0.016);
    state.camPos.set(0.5, 10.5, 17.5);
    state.camTarget.set(0, 0, 3);
    camera.fov = 40; camera.updateProjectionMatrix();
    state.tween = null;
  }

  return {
    renderer, scene, camera, planets, state,
    resize, update, goTo, startIntroFlight, skipIntro, dive, undive, shake, pick,
    setPixelRatio, disableBloom, posterPose,
    get dpr() { return dpr; },
    get quality() { return quality; },
    dispose() { composer.dispose(); renderer.dispose(); },
  };
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
