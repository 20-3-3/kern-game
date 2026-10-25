// Персонажи из примитивов: общий «скелет» из групп-суставов и процедурная анимация.
// Когда появятся glTF-модели, их можно подставить через models.ts, не трогая логику.

import * as THREE from 'three';

export type Accessory = 'cap' | 'courierBag' | 'helmet' | 'shield' | 'beard' | 'hood' | 'coat' | 'glasses' | 'ponytail' | 'chainmail' | 'headset';

export interface RigSpec {
  height: number;
  skin: number;
  top: number;
  bottom: number;
  shoes: number;
  hair: number;
  accessories: Accessory[];
  /** Отпечатки светятся холодным светом и полупрозрачны. */
  imprint?: { color: number; opacity: number };
  /** Ширина плеч (множитель). */
  bulk?: number;
}

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  foreL: THREE.Group;
  foreR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  handR: THREE.Group;
  handL: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  spec: RigSpec;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
const cached = (key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry => {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
};

export const box = (w: number, h: number, d: number) => cached(`b${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt: number, rb: number, h: number, seg = 8) =>
  cached(`c${rt}:${rb}:${h}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const sphere = (r: number) => cached(`s${r}`, () => new THREE.SphereGeometry(r, 10, 8));

/** Геометрии из кэша не освобождаем при очистке сцены. */
export const isSharedGeometry = (g: THREE.BufferGeometry): boolean => {
  for (const v of geoCache.values()) if (v === g) return true;
  return false;
};

export const buildRig = (spec: RigSpec): Rig => {
  const materials: THREE.MeshStandardMaterial[] = [];
  const mat = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, flatShading: true, ...opts });
    if (spec.imprint) {
      m.color.lerp(new THREE.Color(spec.imprint.color), 0.55);
      m.emissive = new THREE.Color(spec.imprint.color);
      m.emissiveIntensity = 0.55;
      m.transparent = true;
      m.opacity = spec.imprint.opacity;
      m.depthWrite = true;
    }
    materials.push(m);
    return m;
  };
  const s = spec.height / 1.75;
  const bulk = spec.bulk ?? 1;
  const mSkin = mat(spec.skin);
  const mTop = mat(spec.top);
  const mBottom = mat(spec.bottom);
  const mShoes = mat(spec.shoes);
  const mHair = mat(spec.hair);

  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    return o;
  };

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(s);
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = 0.92;
  body.add(hips);
  hips.add(mesh(box(0.34 * bulk, 0.18, 0.22), mBottom, 0, 0, 0));

  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);
  torso.add(mesh(box(0.42 * bulk, 0.5, 0.26), mTop, 0, 0.27, 0));

  const head = new THREE.Group();
  head.position.y = 0.6;
  torso.add(head);
  head.add(mesh(box(0.1, 0.08, 0.1), mSkin, 0, 0.02, 0));
  head.add(mesh(box(0.22, 0.25, 0.23), mSkin, 0, 0.17, 0));
  head.add(mesh(box(0.235, 0.08, 0.245), mHair, 0, 0.3, -0.005));

  const makeArm = (side: 1 | -1) => {
    const arm = new THREE.Group();
    arm.position.set(0.25 * bulk * side, 0.48, 0);
    torso.add(arm);
    arm.add(mesh(box(0.12, 0.32, 0.13), mTop, 0, -0.15, 0));
    const fore = new THREE.Group();
    fore.position.y = -0.3;
    arm.add(fore);
    fore.add(mesh(box(0.1, 0.28, 0.11), mTop, 0, -0.13, 0));
    const hand = new THREE.Group();
    hand.position.y = -0.3;
    fore.add(hand);
    hand.add(mesh(box(0.09, 0.09, 0.09), mSkin, 0, 0, 0));
    return { arm, fore, hand };
  };
  const L = makeArm(1);
  const R = makeArm(-1);

  const makeLeg = (side: 1 | -1) => {
    const leg = new THREE.Group();
    leg.position.set(0.1 * side, -0.05, 0);
    hips.add(leg);
    leg.add(mesh(box(0.14, 0.42, 0.15), mBottom, 0, -0.2, 0));
    const shin = new THREE.Group();
    shin.position.y = -0.42;
    leg.add(shin);
    shin.add(mesh(box(0.12, 0.4, 0.13), mBottom, 0, -0.2, 0));
    shin.add(mesh(box(0.13, 0.08, 0.24), mShoes, 0, -0.42, 0.04));
    return { leg, shin };
  };
  const LL = makeLeg(1);
  const RL = makeLeg(-1);

  for (const acc of spec.accessories) {
    switch (acc) {
      case 'cap': {
        const m = mat(0x1d2a35);
        head.add(mesh(box(0.25, 0.07, 0.26), m, 0, 0.33, 0));
        head.add(mesh(box(0.2, 0.025, 0.14), m, 0, 0.3, 0.17));
        break;
      }
      case 'headset': {
        const m = mat(0x111111);
        head.add(mesh(box(0.03, 0.08, 0.08), m, 0.125, 0.17, 0));
        head.add(mesh(box(0.03, 0.08, 0.08), m, -0.125, 0.17, 0));
        break;
      }
      case 'courierBag': {
        const m = mat(0xff8a1e, { emissive: new THREE.Color(0x2a1200) });
        const bag = mesh(box(0.44, 0.44, 0.3), m, 0, 0.3, -0.3);
        bag.name = 'backBag';
        torso.add(bag);
        const stripe = mesh(box(0.45, 0.06, 0.31), mat(0xdde6ee, { emissive: new THREE.Color(0x445566) }), 0, 0.38, -0.3);
        stripe.name = 'backBagStripe';
        torso.add(stripe);
        break;
      }
      case 'helmet': {
        const m = mat(0x9aa3ad, { metalness: 0.6, roughness: 0.4 });
        const dome = new THREE.Mesh(cyl(0.02, 0.15, 0.24, 8), m);
        dome.position.set(0, 0.42, 0);
        head.add(dome);
        head.add(mesh(box(0.25, 0.06, 0.25), m, 0, 0.29, 0));
        head.add(mesh(box(0.03, 0.14, 0.03), m, 0, 0.2, 0.125));
        break;
      }
      case 'chainmail': {
        const m = mat(0x6d7680, { metalness: 0.5, roughness: 0.5 });
        torso.add(mesh(box(0.46 * bulk, 0.42, 0.3), m, 0, 0.18, 0));
        hips.add(mesh(box(0.4 * bulk, 0.3, 0.26), m, 0, -0.1, 0));
        break;
      }
      case 'shield': {
        const m = mat(0x7a1e1e);
        const sh = new THREE.Mesh(cyl(0.34, 0.34, 0.05, 10), m);
        sh.rotation.x = Math.PI / 2;
        sh.position.set(0.04, 0.05, 0.08);
        sh.name = 'shield';
        L.fore.add(sh);
        const boss = new THREE.Mesh(sphere(0.07), mat(0xb8a066, { metalness: 0.7, roughness: 0.3 }));
        boss.position.set(0.04, 0.05, 0.12);
        L.fore.add(boss);
        break;
      }
      case 'beard':
        head.add(mesh(box(0.2, 0.12, 0.08), mHair, 0, 0.06, 0.1));
        break;
      case 'hood': {
        const m = mat(spec.top);
        head.add(mesh(box(0.28, 0.3, 0.28), m, 0, 0.18, -0.03));
        break;
      }
      case 'coat': {
        hips.add(mesh(box(0.4 * bulk, 0.42, 0.27), mTop, 0, -0.18, 0));
        break;
      }
      case 'glasses': {
        const m = mat(0x0a0a0a, { metalness: 0.4, roughness: 0.2 });
        head.add(mesh(box(0.2, 0.04, 0.02), m, 0, 0.2, 0.12));
        break;
      }
      case 'ponytail':
        head.add(mesh(box(0.08, 0.22, 0.08), mHair, 0, 0.17, -0.15));
        break;
    }
  }

  return {
    root,
    body,
    hips,
    torso,
    head,
    armL: L.arm,
    armR: R.arm,
    foreL: L.fore,
    foreR: R.fore,
    legL: LL.leg,
    legR: RL.leg,
    shinL: LL.shin,
    shinR: RL.shin,
    handR: R.hand,
    handL: L.hand,
    materials,
    spec,
  };
};

export type SwingStyle = 'horizontal' | 'backhand' | 'overhead' | 'thrust' | 'bash' | 'spin' | 'slam';

export interface PoseParams {
  stride: number;
  /** 0..1 — насколько быстро идёт персонаж относительно бега. */
  speed: number;
  /** Удар: стиль и прогресс 0..1 (0..0.4 — замах, 0.4..0.6 — удар, дальше — возврат). */
  swing?: { style: SwingStyle; t: number };
  block?: number;
  hurt?: number;
  down?: number;
  dash?: number;
  /** Поднятый над головой меч (момент обрыва). */
  raised?: number;
  /** Сидит на самокате. */
  scooter?: boolean;
  idleTime?: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Процедурная поза. Все углы задаются заново каждый кадр. */
export const poseRig = (rig: Rig, p: PoseParams): void => {
  const sp = Math.min(1, p.speed);
  const ph = p.stride * 2.4;
  const sw = Math.sin(ph) * 0.8 * sp;
  const idle = Math.sin((p.idleTime ?? 0) * 2) * 0.03 * (1 - sp);

  rig.body.position.set(0, Math.abs(Math.cos(ph)) * 0.05 * sp, 0);
  rig.body.rotation.set(0.12 * sp, 0, 0);
  rig.hips.rotation.set(0, 0, 0);
  rig.torso.rotation.set(idle, Math.sin(ph) * 0.12 * sp, 0);
  rig.head.rotation.set(0, 0, 0);
  rig.legL.rotation.set(sw, 0, 0);
  rig.legR.rotation.set(-sw, 0, 0);
  rig.shinL.rotation.set(Math.max(0, -Math.sin(ph + 0.6)) * 0.9 * sp, 0, 0);
  rig.shinR.rotation.set(Math.max(0, Math.sin(ph + 0.6)) * 0.9 * sp, 0, 0);
  rig.armL.rotation.set(-sw * 0.8, 0, 0.08);
  rig.armR.rotation.set(sw * 0.8, 0, -0.08);
  rig.foreL.rotation.set(-0.3 - 0.4 * sp, 0, 0);
  rig.foreR.rotation.set(-0.3 - 0.4 * sp, 0, 0);

  if (p.scooter) {
    rig.legL.rotation.set(0.1, 0, 0);
    rig.legR.rotation.set(-0.15, 0, 0);
    rig.shinL.rotation.set(0.1, 0, 0);
    rig.shinR.rotation.set(0.25, 0, 0);
    rig.armL.rotation.set(-1.1, 0, 0.15);
    rig.armR.rotation.set(-1.1, 0, -0.15);
    rig.foreL.rotation.set(-0.3, 0, 0);
    rig.foreR.rotation.set(-0.3, 0, 0);
    rig.body.rotation.set(0.18, 0, 0);
    rig.body.position.y = 0.12;
  }

  if (p.dash) {
    const d = Math.sin(Math.min(1, p.dash) * Math.PI);
    rig.body.rotation.x = 0.5 * d;
    rig.body.position.y = -0.15 * d;
    rig.legL.rotation.x = 0.9 * d;
    rig.legR.rotation.x = -0.4 * d;
    rig.shinL.rotation.x = 1.0 * d;
    rig.armL.rotation.x = 0.8 * d;
    rig.armR.rotation.x = 0.8 * d;
  }

  if (p.block) {
    const b = smooth(Math.min(1, p.block));
    rig.armR.rotation.set(-1.3 * b, 0.4 * b, -0.3 * b);
    rig.foreR.rotation.set(-1.0 * b, 0, 0);
    rig.armL.rotation.set(-1.2 * b, -0.3 * b, 0.3 * b);
    rig.foreL.rotation.set(-1.2 * b, 0, 0);
    rig.body.rotation.x = 0.1 * b;
  }

  if (p.raised) {
    const r = smooth(Math.min(1, p.raised));
    rig.armR.rotation.set(-2.9 * r, 0, -0.2 * r);
    rig.armL.rotation.set(-2.7 * r, 0, 0.2 * r);
    rig.foreR.rotation.set(-0.3 * r, 0, 0);
    rig.foreL.rotation.set(-0.3 * r, 0, 0);
    rig.torso.rotation.x = -0.25 * r;
    rig.head.rotation.x = -0.3 * r;
  }

  if (p.swing) applySwing(rig, p.swing.style, Math.min(1, Math.max(0, p.swing.t)));

  if (p.hurt) {
    const h = Math.sin(Math.min(1, p.hurt) * Math.PI);
    rig.body.rotation.x = -0.35 * h;
    rig.head.rotation.x = -0.3 * h;
  }

  if (p.down) {
    const d = smooth(Math.min(1, p.down));
    rig.body.rotation.x = -1.45 * d;
    rig.body.position.y = 0.15 * d;
    rig.armL.rotation.set(-2.6 * d, 0, 0.6 * d);
    rig.armR.rotation.set(-2.4 * d, 0, -0.7 * d);
    rig.legL.rotation.set(0.1 * d, 0, 0.15 * d);
    rig.legR.rotation.set(-0.1 * d, 0, -0.15 * d);
  }
};

const applySwing = (rig: Rig, style: SwingStyle, t: number) => {
  // Три участка: замах (0..0.4), удар (0.4..0.6), возврат (0.6..1).
  const wind = smooth(Math.min(1, t / 0.4));
  const strike = smooth(Math.min(1, Math.max(0, (t - 0.4) / 0.2)));
  const back = smooth(Math.min(1, Math.max(0, (t - 0.6) / 0.4)));
  const k = 1 - back;
  switch (style) {
    case 'horizontal': {
      const yaw = (0.9 * wind - 2.0 * strike) * k;
      rig.torso.rotation.y = yaw * 0.6;
      rig.armR.rotation.set(-1.4 * k, 0, (-1.1 * wind + 0.2 * strike) * k);
      rig.armR.rotation.y = yaw;
      rig.foreR.rotation.set(-0.3 * k, 0, 0);
      break;
    }
    case 'backhand': {
      const yaw = (-0.9 * wind + 2.0 * strike) * k;
      rig.torso.rotation.y = yaw * 0.6;
      rig.armR.rotation.set(-1.4 * k, yaw, 0.3 * k);
      rig.foreR.rotation.set(-0.5 * k, 0, 0);
      break;
    }
    case 'overhead':
    case 'slam': {
      const x = (-2.8 * wind + 2.2 * strike) * k;
      rig.armR.rotation.set(x, 0, -0.1);
      rig.armL.rotation.set(style === 'slam' ? x : rig.armL.rotation.x, 0, 0.1);
      rig.foreR.rotation.set(-0.4 * wind * k, 0, 0);
      rig.torso.rotation.x = (-0.25 * wind + 0.5 * strike) * k;
      if (style === 'slam') rig.body.position.y -= 0.15 * strike * k;
      break;
    }
    case 'thrust': {
      rig.armR.rotation.set((-0.6 - 0.9 * strike) * k, 0, 0);
      rig.foreR.rotation.set((-1.6 * wind + 1.5 * strike) * k, 0, 0);
      rig.torso.rotation.y = (0.5 * wind - 0.6 * strike) * k;
      rig.body.rotation.x = 0.2 * strike * k;
      break;
    }
    case 'bash': {
      rig.armL.rotation.set((-1.2 * wind - 0.4 * strike) * k, 0, 0.2);
      rig.foreL.rotation.set(-0.9 * k, 0, 0);
      rig.torso.rotation.y = (-0.5 * wind + 0.8 * strike) * k;
      rig.body.rotation.x = 0.3 * strike * k;
      break;
    }
    case 'spin': {
      rig.armR.rotation.set(-1.5 * k, 0, -1.2 * k);
      rig.root.rotation.y += strike * Math.PI * 2 * k;
      break;
    }
  }
};
