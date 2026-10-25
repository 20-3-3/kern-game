// Ночная Тула из примитивов: проспект Ленина, площадь и стена кремля.
// Геометрия и коллайдеры строятся из одних данных (src/data/levels/prologue-map.ts).

import * as THREE from 'three';
import type { Physics } from '../../core/physics';
import { makeRng, vec3 } from '../../core/math';
import { MAP, SIGNS, TOWERS } from '../../data/levels/prologue-map';
import {
  brickTexture,
  buildingBox,
  facadeTextures,
  floodGradient,
  groundTexture,
  instanced,
  LightPool,
  merge,
  neonSign,
  skyDome,
} from '../../render/world-kit';

export interface City {
  lights: LightPool;
  /** Обновление «живого» окружения (мигание вывесок, огни). */
  update(focus: THREE.Vector3, t: number): void;
  /** Холодная подсветка у стены кремля (усиливается при появлении записи). */
  coldLight: THREE.PointLight;
  /** Место для дополнительных объектов уровня. */
  root: THREE.Group;
}

/** lights — сколько настоящих источников света у фонарей (меньше — быстрее). */
export const buildCity = (scene: THREE.Scene, physics: Physics, lights = 5): City => {
  const root = new THREE.Group();
  scene.add(root);
  const rng = makeRng(1380);
  const { startZ, avenueEndZ, roadHalfWidth: RW, sidewalkWidth: SW, square: SQ, wall: W } = MAP;

  scene.background = new THREE.Color(MAP.sky.horizon);
  scene.fog = new THREE.FogExp2(MAP.fog.color, MAP.fog.density);
  root.add(skyDome(MAP.sky.top, MAP.sky.horizon));

  // Свет: небо, луна и пул фонарей.
  root.add(new THREE.HemisphereLight(0x4a5c80, 0x14100c, 1.3));
  const moon = new THREE.DirectionalLight(0x8aa6d8, 0.55);
  moon.position.set(-60, 120, -80);
  root.add(moon);

  // Земля под всем уровнем (коллайдер).
  physics.addBox(vec3(0, -1, (startZ + W.z) / 2), vec3(120, 1, (startZ - W.z) / 2 + 40));

  // Дорога.
  const avenueLen = startZ - avenueEndZ;
  const asphalt = groundTexture('#24272c', 3);
  asphalt.repeat.set(4, avenueLen / 5);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(RW * 2, avenueLen + 40),
    new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.75, metalness: 0.1 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.001, (startZ + avenueEndZ) / 2 + 20);
  root.add(road);

  // Тротуары с бордюрами.
  const tilesTex = groundTexture('#4a4c50', 5, true);
  tilesTex.repeat.set(SW / 2, avenueLen / 2);
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: tilesTex, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const cx = side * (RW + SW / 2);
    const sw = new THREE.Mesh(new THREE.BoxGeometry(SW, 0.15, avenueLen), sidewalkMat);
    sw.position.set(cx, 0.075, (startZ + avenueEndZ) / 2);
    root.add(sw);
    physics.addBox(vec3(cx, 0.075, (startZ + avenueEndZ) / 2), vec3(SW / 2, 0.075, avenueLen / 2));
  }

  // Разметка: двойная сплошная и прерывистые полосы.
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xb8bcc2 });
  const dashes: { pos: THREE.Vector3; scale: THREE.Vector3 }[] = [];
  for (let z = startZ; z > avenueEndZ; z -= 6) {
    dashes.push({ pos: new THREE.Vector3(-5, 0.01, z), scale: new THREE.Vector3(0.15, 0.01, 3) });
    dashes.push({ pos: new THREE.Vector3(5, 0.01, z), scale: new THREE.Vector3(0.15, 0.01, 3) });
  }
  root.add(instanced(new THREE.BoxGeometry(1, 1, 1), lineMat, dashes));
  for (const x of [-0.15, 0.15]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, avenueLen), lineMat);
    l.position.set(x, 0.01, (startZ + avenueEndZ) / 2);
    root.add(l);
  }
  // Зебра перед площадью.
  const zebra: { pos: THREE.Vector3; scale: THREE.Vector3 }[] = [];
  for (let x = -RW + 1; x < RW; x += 1.6) zebra.push({ pos: new THREE.Vector3(x, 0.012, avenueEndZ + 8), scale: new THREE.Vector3(0.8, 0.01, 4) });
  root.add(instanced(new THREE.BoxGeometry(1, 1, 1), lineMat, zebra));

  // Дома вдоль проспекта — одна слитая геометрия, один материал.
  const facade = facadeTextures(11);
  const facadeMat = new THREE.MeshStandardMaterial({
    map: facade.map,
    emissiveMap: facade.emissiveMap,
    emissive: 0xffffff,
    emissiveIntensity: 0.9,
    roughness: 0.9,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x8a8076, roughness: 0.9, flatShading: true });
  const houses: THREE.BufferGeometry[] = [];
  const trims: THREE.BufferGeometry[] = [];
  const addHouse = (cx: number, cz: number, w: number, d: number, h: number) => {
    houses.push(buildingBox(w, h, d, new THREE.Vector3(cx, h / 2, cz), rng));
    // Карниз «сталинки» и цоколь.
    const cornice = new THREE.BoxGeometry(w + 0.8, 0.7, d + 0.8);
    cornice.translate(cx, h + 0.35, cz);
    trims.push(cornice);
    const plinth = new THREE.BoxGeometry(w + 0.2, 1.2, d + 0.2);
    plinth.translate(cx, 0.6, cz);
    trims.push(plinth);
    physics.addBox(vec3(cx, h / 2, cz), vec3(w / 2, h / 2, d / 2));
  };
  for (const side of [-1, 1]) {
    let z = startZ + 10;
    while (z > avenueEndZ + 30) {
      const len = 22 + rng() * 26;
      const zEnd = Math.max(avenueEndZ + 30, z - len);
      const l = z - zEnd;
      const depth = 14 + rng() * 6;
      const h = 13 + Math.floor(rng() * 5) * 3;
      addHouse(side * (RW + SW + depth / 2), (z + zEnd) / 2, depth, l, h);
      // Изредка — переулок между домами.
      z = zEnd - (rng() < 0.25 ? 8 : 0.5);
    }
  }
  // Дома по бокам площади.
  for (const side of [-1, 1]) {
    addHouse(side * (SQ.maxX + 9), (SQ.maxZ + SQ.minZ) / 2 + 6, 18, SQ.maxZ - SQ.minZ - 12, 16);
    // Угловые дома между проспектом и площадью.
    addHouse(side * ((RW + SW + SQ.maxX) / 2 + 5), SQ.maxZ + 15, SQ.maxX - RW - SW + 10, 30, 19);
  }
  root.add(new THREE.Mesh(merge(houses), facadeMat));
  root.add(new THREE.Mesh(merge(trims), trimMat));

  // Площадь.
  const sqTex = groundTexture('#55524e', 9, true);
  sqTex.repeat.set((SQ.maxX - SQ.minX) / 2, (SQ.maxZ - SQ.minZ + 20) / 2);
  const sq = new THREE.Mesh(
    new THREE.PlaneGeometry(SQ.maxX - SQ.minX + 40, SQ.maxZ - SQ.minZ + 20),
    new THREE.MeshStandardMaterial({ map: sqTex, roughness: 0.85 }),
  );
  sq.rotation.x = -Math.PI / 2;
  sq.position.set(0, 0.005, (SQ.maxZ + SQ.minZ) / 2 - 10);
  root.add(sq);

  // Стена кремля с зубцами «ласточкин хвост» и башнями.
  const brick = brickTexture();
  brick.repeat.set((W.halfLength * 2) / 4, W.height / 4);
  const flood = floodGradient();
  const wallMat = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.85, emissive: 0xff9a60, emissiveMap: flood, emissiveIntensity: 0.9 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(W.halfLength * 2, W.height, W.thickness), wallMat);
  wall.position.set(0, W.height / 2, W.z);
  root.add(wall);
  physics.addBox(vec3(0, W.height / 2, W.z), vec3(W.halfLength, W.height / 2, W.thickness / 2));

  const merlonShape = new THREE.Shape();
  merlonShape.moveTo(-0.6, 0);
  merlonShape.lineTo(0.6, 0);
  merlonShape.lineTo(0.6, 1.6);
  merlonShape.lineTo(0.2, 1.1);
  merlonShape.lineTo(0, 1.25);
  merlonShape.lineTo(-0.2, 1.1);
  merlonShape.lineTo(-0.6, 1.6);
  merlonShape.closePath();
  const merlonGeo = new THREE.ExtrudeGeometry(merlonShape, { depth: 0.8, bevelEnabled: false });
  merlonGeo.translate(0, 0, -0.4);
  const merlonMat = new THREE.MeshStandardMaterial({ color: 0x8a3626, roughness: 0.85, flatShading: true, emissive: 0x220a06 });
  const merlons: { pos: THREE.Vector3 }[] = [];
  for (let x = -W.halfLength + 1; x < W.halfLength; x += 2) merlons.push({ pos: new THREE.Vector3(x, W.height, W.z + W.thickness / 2 - 0.4) });
  root.add(instanced(merlonGeo, merlonMat, merlons));

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2b3a33, roughness: 0.7, flatShading: true });
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x8e3a2a, roughness: 0.85, flatShading: true, emissive: 0xff9a60, emissiveMap: flood, emissiveIntensity: 0.45 });
  for (const t of TOWERS) {
    const g = new THREE.Group();
    g.position.set(t.x, 0, W.z);
    if (t.kind === 'round') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(t.size / 2, t.size / 2 + 0.4, t.height, 12), towerMat);
      body.position.y = t.height / 2;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(t.size / 2 + 0.6, t.size * 1.1, 12), roofMat);
      roof.position.y = t.height + t.size * 0.55;
      g.add(body, roof);
      physics.addCylinder(vec3(t.x, t.height / 2, W.z), t.height / 2, t.size / 2 + 0.3);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(t.size, t.height, t.size), towerMat);
      body.position.y = t.height / 2;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(t.size * 0.78, t.size * 1.2, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = t.height + t.size * 0.6;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.5, 6), roofMat);
      spire.position.y = t.height + t.size * 1.2 + 1;
      g.add(body, roof, spire);
      if (t.kind === 'gate') {
        // Закрытые ворота: тёмная арка и тусклый фонарь над ней.
        const arch = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 0.4), new THREE.MeshStandardMaterial({ color: 0x1a120e }));
        arch.position.set(0, 3, t.size / 2 + 0.1);
        const archTop = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.4, 12, 1, false, 0, Math.PI), arch.material);
        archTop.rotation.set(Math.PI / 2, 0, Math.PI / 2);
        archTop.position.set(0, 6, t.size / 2 + 0.1);
        g.add(arch, archTop);
      }
      physics.addBox(vec3(t.x, t.height / 2, W.z), vec3(t.size / 2, t.height / 2, t.size / 2));
    }
    root.add(g);
  }

  // Ограда и невидимые стены по краям площади и в начале проспекта.
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 0.6, roughness: 0.4 });
  const fencePosts: { pos: THREE.Vector3 }[] = [];
  for (const side of [-1, 1]) {
    for (let z = SQ.minZ + 8; z > W.z + W.thickness / 2; z -= 1) fencePosts.push({ pos: new THREE.Vector3(side * SQ.maxX, 0.6, z) });
    physics.addBox(vec3(side * (SQ.maxX + 0.5), 3, (SQ.minZ + W.z) / 2), vec3(0.5, 3, 20));
  }
  root.add(instanced(new THREE.BoxGeometry(0.06, 1.2, 0.06), fenceMat, fencePosts));
  physics.addBox(vec3(0, 3, startZ + 6), vec3(RW + SW, 3, 0.5));

  // Фонари: столб, кронштейн, плафон. Свет — из пула.
  const lampSpots: THREE.Vector3[] = [];
  const poles: { pos: THREE.Vector3; rotY: number }[] = [];
  for (let z = startZ; z > avenueEndZ; z -= MAP.lampSpacing) {
    for (const side of [-1, 1]) poles.push({ pos: new THREE.Vector3(side * (RW + 0.8), 0, z), rotY: side > 0 ? Math.PI : 0 });
  }
  for (let x = SQ.minX + 8; x <= SQ.maxX - 8; x += 20) {
    poles.push({ pos: new THREE.Vector3(x, 0, SQ.maxZ - 6), rotY: Math.PI / 2 });
    poles.push({ pos: new THREE.Vector3(x, 0, SQ.minZ - 2), rotY: Math.PI / 2 });
  }
  for (const [x, z] of [[-16, -548], [16, -548], [-16, -590], [16, -590]]) poles.push({ pos: new THREE.Vector3(x, 0, z), rotY: x < 0 ? Math.PI / 2 : -Math.PI / 2 });
  for (const z of [-548, -578]) {
    for (const x of [SQ.minX + 4, SQ.maxX - 4]) poles.push({ pos: new THREE.Vector3(x, 0, z), rotY: x < 0 ? Math.PI / 2 : -Math.PI / 2 });
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.14, 7.5, 6);
  poleGeo.translate(0, 3.75, 0);
  const armGeo = new THREE.BoxGeometry(0.08, 0.08, 1.8);
  armGeo.translate(0, 7.4, 0.9);
  const headGeo = new THREE.BoxGeometry(0.5, 0.18, 0.8);
  headGeo.translate(0, 7.3, 1.7);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x23272c, metalness: 0.5, roughness: 0.5 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false });
  root.add(instanced(merge([poleGeo, armGeo]), poleMat, poles));
  root.add(instanced(headGeo, headMat, poles));
  for (const p of poles) {
    lampSpots.push(new THREE.Vector3(p.pos.x + Math.sin(p.rotY) * 1.7, 7.0, p.pos.z + Math.cos(p.rotY) * 1.7));
    physics.addCylinder(vec3(p.pos.x, 3.75, p.pos.z), 3.75, 0.15);
  }
  // Световые пятна под фонарями (дешёвая подделка освещения на асфальте).
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,190,110,0.55)');
    grad.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const poolGeo = new THREE.PlaneGeometry(9, 9);
  poolGeo.rotateX(-Math.PI / 2);
  root.add(
    instanced(
      poolGeo,
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      lampSpots.map((p) => ({ pos: new THREE.Vector3(p.x, 0.17, p.z) })),
    ),
  );
  const pool = new LightPool(scene, lampSpots, lights, 0xffb366, 55, 26);

  // Деревья вдоль тротуаров.
  const trunks: { pos: THREE.Vector3; scale: number }[] = [];
  for (let z = startZ - 7; z > avenueEndZ + 5; z -= MAP.treeSpacing) {
    for (const side of [-1, 1]) {
      if (rng() < 0.15) continue;
      trunks.push({ pos: new THREE.Vector3(side * (RW + SW - 1.6), 0, z + (rng() - 0.5) * 3), scale: 0.8 + rng() * 0.5 });
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 3, 5);
  trunkGeo.translate(0, 1.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(2.2, 0);
  crownGeo.translate(0, 4.4, 0);
  root.add(instanced(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x2e2218, flatShading: true }), trunks));
  root.add(instanced(crownGeo, new THREE.MeshStandardMaterial({ color: 0x2c4a32, flatShading: true, roughness: 0.9 }), trunks));
  for (const t of trunks) physics.addCylinder(vec3(t.pos.x, 1.5, t.pos.z), 1.5, 0.25 * t.scale);

  // Вывески.
  const signs: THREE.Mesh[] = [];
  for (const s of SIGNS) {
    const m = neonSign(s.text, s.color, 1.2);
    m.position.set(s.side * (RW + SW - 0.05), s.y, s.z);
    m.rotation.y = s.side > 0 ? -Math.PI / 2 : Math.PI / 2;
    root.add(m);
    signs.push(m);
  }

  // Холодный свет у кремля: позже им «дышит» запись.
  const coldLight = new THREE.PointLight(0x7fd8ff, 0, 40, 1.4);
  coldLight.position.set(0, 4, W.z + 12);
  root.add(coldLight);

  return {
    lights: pool,
    coldLight,
    root,
    update(focus, t) {
      pool.update(focus);
      // Одна вывеска «подмигивает», как старая неоновая трубка.
      const flick = signs[3];
      if (flick) (flick.material as THREE.MeshBasicMaterial).opacity = Math.sin(t * 13) > 0.85 || Math.sin(t * 3.1) > 0.97 ? 0.3 : 1;
    },
  };
};
