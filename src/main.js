import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { orbVert, orbFrag } from './shaders.js';

const THEMES = [
  { a: 0x1e3a8a, b: 0x06b6d4, rim: 0x67e8f9, bg: 0x05060a }, // ice
  { a: 0x7c2d12, b: 0xf97316, rim: 0xfde68a, bg: 0x0a0603 }, // ember
  { a: 0x4c1d95, b: 0xec4899, rim: 0xf5d0fe, bg: 0x0a0510 }, // nebula
  { a: 0x064e3b, b: 0x10b981, rim: 0xa7f3d0, bg: 0x03080a }, // moss
];
let themeIndex = 0;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 4.7;

const detail = window.innerWidth < 700 ? 32 : 48;
const material = new THREE.ShaderMaterial({
  vertexShader: orbVert,
  fragmentShader: orbFrag,
  uniforms: {
    uTime: { value: 0 },
    uAmp: { value: 0.16 },
    uFreq: { value: 1.1 },
    uColorA: { value: new THREE.Color() },
    uColorB: { value: new THREE.Color() },
    uColorRim: { value: new THREE.Color() },
  },
});
const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, detail), material);
scene.add(orb);

const shell = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.6, 1),
  new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.05 })
);
scene.add(shell);

// starfield
const STAR_COUNT = 1400;
const starPos = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  const r = 9 + Math.random() * 16;
  const th = Math.random() * Math.PI * 2;
  const ph = Math.acos(2 * Math.random() - 1);
  starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
  starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
  starPos[i * 3 + 2] = r * Math.cos(ph);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.025, transparent: true, opacity: 0.75, sizeAttenuation: true })
);
scene.add(stars);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.45, 0.6, 0.62
);
composer.addPass(bloom);

function applyTheme(i) {
  const t = THEMES[i];
  material.uniforms.uColorA.value.setHex(t.a);
  material.uniforms.uColorB.value.setHex(t.b);
  material.uniforms.uColorRim.value.setHex(t.rim);
  scene.background = new THREE.Color(t.bg);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#' + t.bg.toString(16).padStart(6, '0'));
}
applyTheme(0);

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
let energy = 0;
window.addEventListener('pointermove', (e) => {
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = (e.clientY / window.innerHeight) * 2 - 1;
  energy = Math.min(1.4, energy + Math.hypot(nx - mouse.tx, ny - mouse.ty) * 2.5);
  mouse.tx = nx; mouse.ty = ny;
}, { passive: true });
window.addEventListener('pointerdown', () => { energy = 1.8; });

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  energy *= 0.94;

  material.uniforms.uTime.value = t;
  const targetAmp = 0.12 + energy * 0.4;
  material.uniforms.uAmp.value += (targetAmp - material.uniforms.uAmp.value) * 0.1;

  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;

  orb.rotation.y += dt * 0.15;
  orb.rotation.x = mouse.y * 0.4;
  orb.rotation.z = mouse.x * 0.1;
  shell.rotation.y -= dt * 0.05;
  shell.rotation.x += dt * 0.03;
  stars.rotation.y += dt * 0.012;

  camera.position.x += (mouse.x * 0.7 - camera.position.x) * 0.04;
  camera.position.y += (-mouse.y * 0.7 - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);

  bloom.strength = 0.4 + energy * 0.4;

  composer.render();
  requestAnimationFrame(loop);
}
loop();

document.getElementById('theme').addEventListener('click', cycleTheme);
window.addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); cycleTheme(); } });
function cycleTheme() { themeIndex = (themeIndex + 1) % THEMES.length; applyTheme(themeIndex); }

const hint = document.querySelector('.sub');
window.addEventListener('pointerdown', () => hint && hint.classList.add('is-faded'), { once: true });
