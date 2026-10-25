// Набор для сборки окружения из примитивов: дома с окнами, вывески, фонари, небо.
// Повторяющиеся объекты рисуются инстансингом или сливаются в одну геометрию.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng } from '../core/math';

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** Текстура фасада: сетка 8×8 окон. Возвращает карту цвета и карту свечения. */
export const facadeTextures = (seed: number, litRatio = 0.28) => {
  const N = 8;
  const S = 32;
  const col = canvas(N * S, N * S);
  const emi = canvas(N * S, N * S);
  const c = col.getContext('2d')!;
  const e = emi.getContext('2d')!;
  const rng = makeRng(seed);
  c.fillStyle = '#6b6259';
  c.fillRect(0, 0, N * S, N * S);
  e.fillStyle = '#000';
  e.fillRect(0, 0, N * S, N * S);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = i * S + 8;
      const y = j * S + 7;
      const lit = rng() < litRatio;
      const warm = rng() < 0.8;
      // Межэтажная тяга.
      c.fillStyle = '#5a524a';
      c.fillRect(i * S, j * S + S - 3, S, 3);
      c.fillStyle = lit ? (warm ? '#f3c27a' : '#a9d4ff') : '#1a1f26';
      c.fillRect(x, y, S - 16, S - 12);
      if (lit) {
        e.fillStyle = warm ? '#f0b060' : '#90c0ff';
        e.globalAlpha = 0.6 + rng() * 0.4;
        e.fillRect(x, y, S - 16, S - 12);
        e.globalAlpha = 1;
      }
      c.fillStyle = '#3a342e';
      c.fillRect(x + (S - 16) / 2 - 1, y, 2, S - 12);
    }
  }
  const map = new THREE.CanvasTexture(col);
  const emissiveMap = new THREE.CanvasTexture(emi);
  for (const t of [map, emissiveMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.anisotropy = 4;
  }
  return { map, emissiveMap };
};

/** Кирпичная текстура для стен кремля. */
export const brickTexture = () => {
  const c = canvas(128, 128);
  const g = c.getContext('2d')!;
  g.fillStyle = '#6e2a1f';
  g.fillRect(0, 0, 128, 128);
  const rng = makeRng(7);
  for (let row = 0; row < 16; row++) {
    const off = row % 2 ? 8 : 0;
    for (let k = -1; k < 9; k++) {
      const shade = 0.75 + rng() * 0.35;
      g.fillStyle = `rgb(${Math.floor(150 * shade)},${Math.floor(62 * shade)},${Math.floor(45 * shade)})`;
      g.fillRect(k * 16 + off + 1, row * 8 + 1, 14, 6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Вертикальный градиент для «подсветки прожекторами снизу». */
export const floodGradient = () => {
  const c = canvas(4, 64);
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 64, 0, 0);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.6, '#6a6a6a');
  grad.addColorStop(1, '#202020');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Плитка/асфальт: шумная текстура для земли. */
export const groundTexture = (base: string, seed: number, tiles = false) => {
  const c = canvas(128, 128);
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  const rng = makeRng(seed);
  for (let i = 0; i < 900; i++) {
    const v = rng() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${0.03 + rng() * 0.04})`;
    g.fillRect(rng() * 128, rng() * 128, 1 + rng() * 2, 1 + rng() * 2);
  }
  if (tiles) {
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i <= 128; i += 32) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 128);
      g.moveTo(0, i);
      g.lineTo(128, i);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Коробка-дом с UV, растянутыми по размеру (окна одного размера на любом доме). */
export const buildingBox = (
  w: number,
  h: number,
  d: number,
  pos: THREE.Vector3,
  rng: () => number,
  cell = { w: 3.4, h: 3.1 },
): THREE.BufferGeometry => {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  // Порядок граней BoxGeometry: +x, -x, +y, -y, +z, -z (по 4 вершины).
  const faceSize = [
    [d, h],
    [d, h],
    [0, 0],
    [0, 0],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const [fw, fh] = faceSize[f];
    const ou = Math.floor(rng() * 8) / 8;
    const ov = Math.floor(rng() * 8) / 8;
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      if (fw === 0) {
        uv.setXY(i, 0.001, 0.97);
      } else {
        uv.setXY(i, ou + (uv.getX(i) * fw) / (cell.w * 8), ov + (uv.getY(i) * fh) / (cell.h * 8));
      }
    }
  }
  g.translate(pos.x, pos.y, pos.z);
  return g;
};

export const merge = (geos: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const m = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return m;
};

/** Неоновая вывеска: светящийся текст на тёмной подложке. */
export const neonSign = (text: string, color: string, height = 1.1): THREE.Mesh => {
  const fontPx = 72;
  const c = canvas(1, 1);
  let g = c.getContext('2d')!;
  g.font = `bold ${fontPx}px sans-serif`;
  const tw = Math.ceil(g.measureText(text).width) + 60;
  c.width = tw;
  c.height = fontPx + 50;
  g = c.getContext('2d')!;
  g.fillStyle = 'rgba(8,10,14,0.9)';
  g.fillRect(0, 0, c.width, c.height);
  g.font = `bold ${fontPx}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 24;
  g.fillStyle = color;
  g.fillText(text, c.width / 2, c.height / 2 + 4);
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff';
  g.globalAlpha = 0.55;
  g.fillText(text, c.width / 2, c.height / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true });
  const w = (height * c.width) / c.height;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, height), mat);
};

/** Небо: градиентный купол и звёзды. На них не действует туман. */
export const skyDome = (top: number, horizon: number): THREE.Group => {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(400, 24, 12);
  const colors: number[] = [];
  const pos = geo.getAttribute('position');
  const ct = new THREE.Color(top);
  const ch = new THREE.Color(horizon);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 400;
    tmp.copy(ch).lerp(ct, Math.min(1, Math.max(0, y * 1.6)));
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  group.add(dome);
  const rng = makeRng(42);
  const starPos: number[] = [];
  for (let i = 0; i < 700; i++) {
    const th = rng() * Math.PI * 2;
    const ph = Math.acos(0.15 + rng() * 0.85);
    starPos.push(380 * Math.sin(ph) * Math.cos(th), 380 * Math.cos(ph), 380 * Math.sin(ph) * Math.sin(th));
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  group.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfd0ff, size: 1.3, sizeAttenuation: false, fog: false })));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: 0xdfe6f0, fog: false }));
  moon.position.set(-140, 210, -280);
  moon.lookAt(0, 0, 0);
  group.add(moon);
  group.renderOrder = -1;
  return group;
};

/**
 * Пул точечных источников света: фонарей сотни, а настоящих источников — несколько.
 * Каждый кадр свет переезжает к ближайшим к камере фонарям.
 */
export class LightPool {
  private lights: THREE.PointLight[] = [];
  constructor(
    scene: THREE.Scene,
    private spots: THREE.Vector3[],
    count: number,
    color: number,
    intensity: number,
    distance: number,
  ) {
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(color, intensity, distance, 1.5);
      l.position.set(0, -100, 0);
      scene.add(l);
      this.lights.push(l);
    }
  }

  update(focus: THREE.Vector3): void {
    const sorted = this.spots
      .map((p) => ({ p, d: p.distanceToSquared(focus) }))
      .sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.lights.length; i++) {
      const s = sorted[i];
      if (s) this.lights[i].position.copy(s.p);
    }
  }
}

/** Инстансинг одинаковых мешей по списку матриц. */
export const instanced = (
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  transforms: { pos: THREE.Vector3; rotY?: number; scale?: THREE.Vector3 | number; color?: number }[],
): THREE.InstancedMesh => {
  const im = new THREE.InstancedMesh(geo, mat, transforms.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  transforms.forEach((t, i) => {
    q.setFromAxisAngle(up, t.rotY ?? 0);
    if (typeof t.scale === 'number') s.setScalar(t.scale);
    else if (t.scale) s.copy(t.scale);
    else s.setScalar(1);
    m.compose(t.pos, q, s);
    im.setMatrixAt(i, m);
    if (t.color !== undefined) im.setColorAt(i, new THREE.Color(t.color));
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
};
