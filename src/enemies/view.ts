// Отображение врагов-бойцов: фигура из примитивов, оружие, поза по состоянию ИИ.

import * as THREE from 'three';
import { buildRig, poseRig, type PoseParams, type Rig, type RigSpec } from '../render/characters';
import { RATNIK, RESTORER, RESTORER_LEADER } from '../data/characters';
import { lerp, lerpAngle } from '../core/math';
import type { Fighter } from './fighter';

const SPECS: Record<string, RigSpec> = {
  restorer: RESTORER,
  restorerLeader: RESTORER_LEADER,
  ratnik: RATNIK,
};

/** Стальной камертон Реставраторов: рукоять и две ножки. */
const tuningFork = (): THREE.Group => {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8d0d8, metalness: 0.9, roughness: 0.25, emissive: 0x111820 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.25, 6), steel);
  handle.rotation.x = Math.PI / 2;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.04), steel);
  base.position.z = 0.14;
  const prongGeo = new THREE.BoxGeometry(0.025, 0.025, 0.45);
  const p1 = new THREE.Mesh(prongGeo, steel);
  p1.position.set(-0.06, 0, 0.37);
  const p2 = new THREE.Mesh(prongGeo, steel);
  p2.position.set(0.06, 0, 0.37);
  g.add(handle, base, p1, p2);
  return g;
};

/** Оружие ратника-Отпечатка: топорик или копьё, светятся холодным светом. */
const imprintWeapon = (spear: boolean): THREE.Group => {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x9fdfff, emissive: 0x4fbfff, emissiveIntensity: 1.1, transparent: true, opacity: 0.8 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, spear ? 1.9 : 0.8, 5), mat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = spear ? 0.6 : 0.25;
  g.add(shaft);
  if (spear) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 4), mat);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 1.65;
    g.add(tip);
  } else {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.18), mat);
    head.position.set(0, 0.08, 0.6);
    g.add(head);
  }
  return g;
};

export class FighterView {
  readonly rig: Rig;
  private idle = Math.random() * 10;
  private baseEmissive: THREE.Color[];

  constructor(
    scene: THREE.Object3D,
    private f: Fighter,
  ) {
    this.rig = buildRig(SPECS[f.def.kind] ?? RESTORER);
    scene.add(this.rig.root);
    const weapon = f.def.human ? tuningFork() : imprintWeapon(f.id % 2 === 0);
    this.rig.handR.add(weapon);
    this.baseEmissive = this.rig.materials.map((m) => m.emissive.clone());
  }

  update(alpha: number, frameDt: number): void {
    const f = this.f;
    const r = this.rig.root;
    this.idle += frameDt;
    r.visible = !f.removed;
    if (f.removed) return;
    r.position.set(lerp(f.prevPos.x, f.pos.x, alpha), lerp(f.prevPos.y, f.pos.y, alpha), lerp(f.prevPos.z, f.pos.z, alpha));
    r.rotation.set(0, lerpAngle(f.prevYaw, f.yaw, alpha), 0);
    const a = f.attack;
    let swing: PoseParams['swing'];
    if (a && f.state === 'windup') swing = { style: a.style, t: Math.min(0.4, (f.stateTime / a.windup) * 0.4) };
    if (a && f.state === 'strike') swing = { style: a.style, t: 0.4 + (f.stateTime / a.strike) * 0.2 };
    if (a && f.state === 'recover') swing = { style: a.style, t: 0.6 + Math.min(0.4, (f.stateTime / a.recover) * 0.4) };
    poseRig(this.rig, {
      stride: this.idle * (f.speed > 0.3 ? f.speed * 0.9 : 0),
      speed: Math.min(1, f.speed / 4),
      swing,
      hurt: f.state === 'hurt' ? f.stateTime / f.def.hurtStun : f.state === 'open' ? 0.5 + Math.sin(this.idle * 8) * 0.1 : undefined,
      down: f.cutscenePose === 'kneel' ? 0.45 : f.state === 'down' || f.state === 'thrown' ? Math.min(1, f.stateTime * 3) : undefined,
      idleTime: this.idle,
    });
    // Вспышка при попадании и подсветка «открытого» врага.
    const flash = Math.max(0, 1 - f.hitFlash * 6);
    const open = f.state === 'open' && !f.cutscenePose ? 0.5 + Math.sin(this.idle * 14) * 0.3 : 0;
    const windupGlow = f.state === 'windup' ? 0.12 + Math.abs(Math.sin(this.idle * 18)) * 0.18 : 0;
    this.rig.materials.forEach((m, i) => {
      m.emissive.copy(this.baseEmissive[i]);
      if (flash > 0) m.emissive.lerp(WHITE, flash);
      if (open > 0) m.emissive.lerp(OPEN, open);
      if (windupGlow > 0) m.emissive.lerp(WINDUP, windupGlow);
      if (f.state === 'dead') {
        m.transparent = true;
        m.opacity = Math.max(0, 0.8 - f.stateTime * 0.7);
      }
    });
    if (f.state === 'dead') r.position.y += f.stateTime * 0.6;
  }

  dispose(): void {
    this.rig.root.removeFromParent();
  }
}

const WHITE = new THREE.Color(0xffffff);
const OPEN = new THREE.Color(0xffd24d);
const WINDUP = new THREE.Color(0xff3020);
