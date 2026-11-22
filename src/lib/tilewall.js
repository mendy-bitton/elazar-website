/* =========================================================
   TILE WALL: the lit wall behind the "מהבמה" title
   A grid of dark glossy tiles with a stage light behind them.
   The light shows through the seams and catches the bevels;
   under the pointer the tiles rise and tilt like a soft dome,
   and a wave runs out from the light when the section arrives.
   Loaded on demand by lib/wall.js, as its own chunk.
   ========================================================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const CAM_Z = 12;
const TILE = { size: .95, step: 1.05, radius: .16 };
const DOME = { lift: .95, sigma: .95 };                 // the bump under the pointer, in tiles
const WAVE = { speed: 8.5, width: .55, height: .42, fade: 9 };

// [angle°, length, spread, opacity]: two stage spots crossing behind the title, and fainter spill
const BEAMS = [[24, 12, .55, .5], [204, 12, .55, .46], [156, 10, .45, .38], [336, 10, .45, .34], [92, 4, .3, .1], [272, 3.5, .3, .08]];

function texture(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roundedSquare(s, r) {
  const h = s / 2, p = new THREE.Shape();
  p.moveTo(-h + r, -h); p.lineTo(h - r, -h); p.quadraticCurveTo(h, -h, h, -h + r);
  p.lineTo(h, h - r); p.quadraticCurveTo(h, h, h - r, h);
  p.lineTo(-h + r, h); p.quadraticCurveTo(-h, h, -h, h - r);
  p.lineTo(-h, -h + r); p.quadraticCurveTo(-h, -h, -h + r, -h);
  return p;
}

// emissive "rim" toward a point light behind the wall: bright on the grazing faces (bevels, sides)
// that face the light, falling off with distance. Added on top of the physical material.
function withRim(mat, light, { strength, power, falloff, wrap }) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, {
      uRimPos: light.pos, uRimColor: light.color,
      uRimStr: { value: strength }, uRimPow: { value: power }, uRimFall: { value: falloff }, uRimWrap: { value: wrap }
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRimPos;\nvarying vec3 vRimNrm;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        mat4 rimM = modelMatrix;
        #ifdef USE_INSTANCING
          rimM = modelMatrix * instanceMatrix;
        #endif
        vRimPos = (rimM * vec4(transformed, 1.0)).xyz;
        vRimNrm = normalize(mat3(rimM) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRimPos;\nvarying vec3 vRimNrm;\nuniform vec3 uRimPos;\nuniform vec3 uRimColor;\nuniform float uRimStr;\nuniform float uRimPow;\nuniform float uRimFall;\nuniform float uRimWrap;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 rn = normalize(vRimNrm);
          vec3 rv = normalize(cameraPosition - vRimPos);
          vec3 rl = uRimPos - vRimPos; float rd = length(rl); rl /= rd;
          float edge = pow(1.0 - clamp(abs(dot(rn, rv)), 0.0, 1.0), uRimPow);
          float toward = clamp((dot(rn, rl) + uRimWrap) / (1.0 + uRimWrap), 0.0, 1.0);
          totalEmissiveRadiance += uRimColor * uRimStr * edge * toward * toward / (1.0 + rd * rd * uRimFall);
        }`);
  };
  return mat;
}

export function createTileWall(canvas, C, { pixelRatio = Math.min(devicePixelRatio, 2) } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.page);
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.set(0, 0, CAM_Z);

  scene.add(new THREE.AmbientLight(0xffffff, .05));
  const back = new THREE.PointLight(C.accent, 40, 0, 2);
  back.position.set(0, 0, -.6);
  scene.add(back);
  // a small follow-spot that rides with the pointer, just in front of the wall
  const spot = new THREE.PointLight(C.accent, 0, 0, 2);
  spot.position.set(0, 0, 1.5);
  scene.add(spot);

  // the stage light behind the wall, seen through the seams
  const page = new THREE.Color(C.page), deep = new THREE.Color(C.deep);
  const dim = '#' + deep.clone().lerp(page, .72).getHexString();
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshBasicMaterial({
    toneMapped: false,
    map: texture(1024, 1024, (g, w) => {
      g.fillStyle = C.page; g.fillRect(0, 0, w, w);
      const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      r.addColorStop(0, '#ffffff'); r.addColorStop(.016, C.hot); r.addColorStop(.045, C.accent);
      r.addColorStop(.1, C.deep); r.addColorStop(.2, dim); r.addColorStop(.36, C.page);
      g.fillStyle = r; g.fillRect(0, 0, w, w);
    })
  }));
  glow.position.z = -.9;
  scene.add(glow);

  // light in front of the wall: a halo behind the words and the crossing spot beams
  const additive = { transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending };
  const front = new THREE.Group();
  front.position.z = .2;
  front.add(new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), new THREE.MeshBasicMaterial({
    ...additive, opacity: .8, color: C.accent,
    map: texture(256, 256, (g, w) => {
      const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      r.addColorStop(0, '#fff'); r.addColorStop(.16, 'rgba(255,255,255,.55)'); r.addColorStop(.46, 'rgba(255,255,255,.1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, w);
    })
  })));
  const beamMap = texture(512, 64, (g, w, h) => {
    const a = g.createLinearGradient(0, 0, w, 0);
    a.addColorStop(0, '#fff'); a.addColorStop(.22, 'rgba(255,255,255,.55)'); a.addColorStop(.6, 'rgba(255,255,255,.14)'); a.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const b = g.createLinearGradient(0, 0, 0, h);
    b.addColorStop(0, 'rgba(0,0,0,0)'); b.addColorStop(.5, '#000'); b.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = b; g.fillRect(0, 0, w, h);
  });
  const beamColor = new THREE.Color(C.accent).multiplyScalar(1.5);
  for (const [deg, len, spread, op] of BEAMS) {
    const geo = new THREE.PlaneGeometry(len, 1, 24, 1);
    geo.translate(len / 2 + .5, 0, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {                        // a cone: narrow at the light, wider away from it
      const u = (pos.getX(i) - .5) / len;
      pos.setY(i, pos.getY(i) * (.1 + spread * 2.4 * u));
    }
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ ...additive, map: beamMap, opacity: op * .42, color: beamColor }));
    m.rotation.z = THREE.MathUtils.degToRad(deg);
    front.add(m);
  }
  scene.add(front);

  // the tiles
  const tileGeo = new THREE.ExtrudeGeometry(roundedSquare(TILE.size, TILE.radius), {
    depth: .08, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 4, curveSegments: 12
  });
  tileGeo.center();
  const rimLight = { pos: { value: new THREE.Vector3(0, 0, -.35) }, color: { value: new THREE.Color(C.accent).lerp(new THREE.Color(C.hot), .3) } };
  const tileMat = withRim(new THREE.MeshPhysicalMaterial({ color: C.tile, metalness: .12, roughness: .34, clearcoat: .6, clearcoatRoughness: .25 }),
    rimLight, { strength: 11, power: 1.6, falloff: 1.1, wrap: .35 });

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(pixelRatio);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), .55, .4, .78));
  composer.addPass(new OutputPass());

  // grid state, one entry per tile
  let grid = null, ready = false, raf = 0, last = 0;
  const dummy = new THREE.Object3D();
  function buildGrid(cols, rows) {
    const key = `${cols}:${rows}`;
    if (grid && grid.key === key) return;
    if (grid) { scene.remove(grid.mesh); grid.mesh.dispose(); }
    const n = (cols[1] - cols[0] + 1) * (rows[1] - rows[0] + 1);
    grid = { key, mesh: new THREE.InstancedMesh(tileGeo, tileMat, n), x: new Float32Array(n), y: new Float32Array(n), lift: new Float32Array(n), tx: new Float32Array(n), ty: new Float32Array(n), far: 0 };
    let i = 0;
    for (let c = cols[0]; c <= cols[1]; c++) for (let r = rows[0]; r <= rows[1]; r++) {
      grid.x[i] = c * TILE.step; grid.y[i] = r * TILE.step;
      grid.far = Math.max(grid.far, Math.hypot(grid.x[i], grid.y[i]));
      i++;
    }
    writeMatrices();
    scene.add(grid.mesh);
  }
  function writeMatrices() {
    for (let i = 0; i < grid.x.length; i++) {
      dummy.position.set(grid.x[i], grid.y[i], grid.lift[i]);
      dummy.rotation.set(grid.tx[i], grid.ty[i], 0);
      dummy.updateMatrix();
      grid.mesh.setMatrixAt(i, dummy.matrix);
    }
    grid.mesh.instanceMatrix.needsUpdate = true;
  }

  // pointer → a point on the wall plane
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  let pointer = null, hover = 0, waveStart = null, waveEnd = 0;

  function step(dt) {
    if (pointer) { ray.setFromCamera(pointer, camera); ray.ray.intersectPlane(plane, hit); }
    hover += ((pointer ? 1 : 0) - hover) * (1 - Math.exp(-dt * 6));
    spot.position.x += (hit.x - spot.position.x) * (1 - Math.exp(-dt * 12));
    spot.position.y += (hit.y - spot.position.y) * (1 - Math.exp(-dt * 12));
    spot.intensity = 5 * hover;
    const waveR = waveStart === null ? null : (performance.now() - waveStart) / 1000 * WAVE.speed;
    if (waveR !== null && waveR > waveEnd) waveStart = null;
    const k = 1 - Math.exp(-dt * 9), s2 = DOME.sigma * DOME.sigma, w2 = WAVE.width * WAVE.width;
    let moving = (pointer ? hover < .999 : hover > .001) || waveStart !== null;
    for (let i = 0; i < grid.x.length; i++) {
      const x = grid.x[i], y = grid.y[i];
      const dx = x - hit.x, dy = y - hit.y;
      const bump = DOME.lift * hover * Math.exp(-(dx * dx + dy * dy) / (2 * s2));
      const d = Math.hypot(x, y) || 1e-6;
      const wave = waveStart === null ? 0 : WAVE.height * Math.exp(-((d - waveR) ** 2) / (2 * w2)) * Math.exp(-d / WAVE.fade);
      grid.lift[i] += (bump + wave - grid.lift[i]) * k;
      // tiles lean with the slope of the dome (away from the pointer) and of the wave (away from the light)
      const sx = .5 * dx * bump / s2 + (wave ? .35 * (d - waveR) / w2 * wave * x / d : 0);
      const sy = .5 * dy * bump / s2 + (wave ? .35 * (d - waveR) / w2 * wave * y / d : 0);
      grid.ty[i] += (Math.max(-.6, Math.min(.6, sx)) - grid.ty[i]) * k;
      grid.tx[i] += (Math.max(-.6, Math.min(.6, -sy)) - grid.tx[i]) * k;
      if (grid.lift[i] > 5e-4) moving = true;
    }
    return moving;
  }

  function frame(t) {
    const dt = Math.min((t - last) / 1000, .05);
    last = t;
    raf = 0;
    if (!grid || !ready) return;
    const moving = step(dt);
    writeMatrices();
    composer.render();
    if (moving) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && ready) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  return {
    // size the canvas, and put the light (the world origin) at lightX/lightY, with unitPx pixels per tile
    setFrame({ width, height, lightX, lightY, unitPx }) {
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      camera.aspect = width / height;
      camera.fov = 2 * THREE.MathUtils.radToDeg(Math.atan(height / unitPx / 2 / CAM_Z));
      camera.setViewOffset(width, height, width / 2 - lightX, height / 2 - lightY, width, height);
      camera.updateProjectionMatrix();
      const u = p => p / unitPx / TILE.step;
      buildGrid([Math.floor(-u(lightX)) - 1, Math.ceil(u(width - lightX)) + 1], [Math.floor(-u(height - lightY)) - 1, Math.ceil(u(lightY)) + 1]);
      if (ready) composer.render();
    },
    async warmUp() {
      if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
      ready = true;
      composer.render();
    },
    setPointer(p) { pointer = p ? new THREE.Vector2(p.x, p.y) : null; kick(); },
    ripple() {
      if (!grid) return;
      waveStart = performance.now();
      waveEnd = grid.far + 3 * WAVE.width;
      kick();
    },
    dispose() {
      cancelAnimationFrame(raf);
      grid && grid.mesh.dispose();
      tileGeo.dispose(); tileMat.dispose(); composer.dispose(); renderer.dispose();
    }
  };
}
