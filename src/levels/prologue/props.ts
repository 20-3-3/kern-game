// Предметы пролога из примитивов: самокат, минивэны, дорожные препятствия.

import * as THREE from 'three';
import type { ObstacleKind } from '../../data/levels/prologue-ride';

// Одинаковые материалы переиспользуются: тогда части предмета сливаются в один меш.
const matCache = new Map<string, THREE.MeshStandardMaterial>();
const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
  const key = extra.map ? '' : `${color}:${JSON.stringify(extra)}`;
  const hit = key ? matCache.get(key) : undefined;
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true, ...extra });
  if (key) matCache.set(key, m);
  return m;
};

const add = (g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
};

export const buildScooter = (): { group: THREE.Group; headlight: THREE.SpotLight } => {
  const g = new THREE.Group();
  const dark = std(0x202428, { metalness: 0.4 });
  const accent = std(0xff8a1e, { emissive: 0x331500 });
  add(g, new THREE.BoxGeometry(0.2, 0.06, 0.9), dark, 0, 0.12, 0);
  add(g, new THREE.BoxGeometry(0.21, 0.02, 0.6), accent, 0, 0.16, -0.05);
  const stem = add(g, new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), dark, 0, 0.62, 0.42);
  stem.rotation.x = -0.15;
  const bar = add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), dark, 0, 1.1, 0.5);
  bar.rotation.z = Math.PI / 2;
  const wheelGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10);
  for (const z of [-0.42, 0.45]) {
    const w = add(g, wheelGeo, std(0x0d0d0d), 0, 0.1, z);
    w.rotation.z = Math.PI / 2;
  }
  add(g, new THREE.BoxGeometry(0.1, 0.06, 0.04), new THREE.MeshBasicMaterial({ color: 0xffffee, toneMapped: false }), 0, 0.95, 0.5);
  const headlight = new THREE.SpotLight(0xfff1d0, 0, 28, 0.5, 0.6, 1.2);
  headlight.position.set(0, 0.95, 0.5);
  headlight.target.position.set(0, 0, 8);
  g.add(headlight, headlight.target);
  return { group: g, headlight };
};

export const buildVan = (): THREE.Group => {
  const g = new THREE.Group();
  const body = std(0x0b0c0e, { metalness: 0.6, roughness: 0.35 });
  const glass = std(0x05070a, { metalness: 0.9, roughness: 0.1 });
  add(g, new THREE.BoxGeometry(2.0, 1.5, 4.8), body, 0, 1.2, 0);
  add(g, new THREE.BoxGeometry(1.9, 0.7, 1.2), body, 0, 0.85, 2.7);
  add(g, new THREE.BoxGeometry(1.85, 0.55, 0.05), glass, 0, 1.55, 2.4);
  add(g, new THREE.BoxGeometry(2.02, 0.45, 3.4), glass, 0, 1.6, -0.4);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xf4f8ff, toneMapped: false });
  for (const x of [-0.7, 0.7]) add(g, new THREE.BoxGeometry(0.4, 0.15, 0.05), lightMat, x, 0.95, 3.31);
  const tail = new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false });
  for (const x of [-0.85, 0.85]) add(g, new THREE.BoxGeometry(0.2, 0.3, 0.05), tail, x, 1.1, -2.42);
  const wheel = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  for (const [x, z] of [[-0.95, 1.6], [0.95, 1.6], [-0.95, -1.5], [0.95, -1.5]]) {
    const w = add(g, wheel, std(0x050505), x, 0.38, z);
    w.rotation.z = Math.PI / 2;
  }
  // Свет фар на асфальте (без настоящего источника света).
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(230,240,255,0.5)');
  grad.addColorStop(1, 'rgba(230,240,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 12),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0, 0.05, 8.5);
  g.add(beam);
  return g;
};

const stripeTexture = (a: string, b: string) => {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = a;
  g.fillRect(0, 0, 64, 16);
  g.fillStyle = b;
  for (let x = -16; x < 64; x += 16) {
    g.beginPath();
    g.moveTo(x, 16);
    g.lineTo(x + 8, 0);
    g.lineTo(x + 16, 0);
    g.lineTo(x + 8, 16);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

let stripes: THREE.Texture | null = null;
let fenceStripes: THREE.Texture | null = null;

export const buildObstacle = (kind: ObstacleKind, hx: number, hz: number, color = 0x3a4a5a): THREE.Object3D => {
  const g = new THREE.Group();
  switch (kind) {
    case 'cone': {
      const orange = std(0xff6a1a, { emissive: 0x401800 });
      add(g, new THREE.ConeGeometry(0.22, 0.6, 8), orange, 0, 0.3, 0);
      add(g, new THREE.CylinderGeometry(0.13, 0.16, 0.08, 8), std(0xffffff, { emissive: 0x555555 }), 0, 0.33, 0);
      add(g, new THREE.BoxGeometry(0.45, 0.04, 0.45), std(0x111111), 0, 0.02, 0);
      break;
    }
    case 'barrier': {
      stripes ??= stripeTexture('#e8e8e8', '#d0281e');
      const t = stripes.clone();
      t.repeat.set(hx, 1);
      t.needsUpdate = true;
      add(g, new THREE.BoxGeometry(hx * 2, 0.32, 0.3), std(0xffffff, { map: t, emissive: 0x220000 }), 0, 0.45, 0);
      for (let x = -hx + 0.3; x <= hx; x += 2.5) add(g, new THREE.BoxGeometry(0.08, 0.45, 0.5), std(0x333333), x, 0.22, 0);
      break;
    }
    case 'fence': {
      fenceStripes ??= stripeTexture('#ff8a1e', '#1b1b1b');
      const t = fenceStripes.clone();
      t.repeat.set(hx, 1);
      t.needsUpdate = true;
      add(g, new THREE.BoxGeometry(hx * 2, 1.6, 0.12), std(0xffffff, { map: t, emissive: 0x331500 }), 0, 1.0, 0);
      for (let x = -hx; x <= hx + 0.01; x += Math.max(1, hx)) add(g, new THREE.BoxGeometry(0.3, 0.15, 0.7), std(0x222222), x, 0.08, 0);
      // Мигающая лампа на ограждении.
      add(g, new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffb000, toneMapped: false }), hx * 0.8, 1.9, 0).name = 'blink';
      break;
    }
    case 'car': {
      const body = std(color, { metalness: 0.5, roughness: 0.4 });
      add(g, new THREE.BoxGeometry(hx * 2, 0.75, hz * 2), body, 0, 0.6, 0);
      add(g, new THREE.BoxGeometry(hx * 1.8, 0.6, hz * 1.1), std(0x0a0d12, { metalness: 0.8, roughness: 0.15 }), 0, 1.25, -0.2);
      const wheel = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10);
      for (const [x, z] of [[-hx, hz * 0.62], [hx, hz * 0.62], [-hx, -hz * 0.62], [hx, -hz * 0.62]]) {
        const w = add(g, wheel, std(0x050505), x, 0.3, z);
        w.rotation.z = Math.PI / 2;
      }
      break;
    }
    case 'trolley': {
      add(g, new THREE.BoxGeometry(hx * 2, 2.6, hz * 2), std(0x3c7a6a, { metalness: 0.3 }), 0, 1.75, 0);
      add(g, new THREE.BoxGeometry(hx * 2 + 0.02, 0.9, hz * 1.9), std(0x0d141a, { emissive: 0x1a2a30 }), 0, 2.3, 0);
      add(g, new THREE.BoxGeometry(hx * 2 + 0.02, 0.3, hz * 2 + 0.02), std(0xdddddd), 0, 0.6, 0);
      for (const x of [-0.4, 0.4]) {
        const pole = add(g, new THREE.CylinderGeometry(0.03, 0.03, 5, 4), std(0x222222), x, 4.2, -hz * 0.5);
        pole.rotation.x = -0.9;
      }
      break;
    }
  }
  return g;
};
