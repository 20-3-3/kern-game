// Сюжетные персонажи вне боя (Ника, Дружинник в кат-сценах): идут к точке, стоят, жестикулируют.

import * as THREE from 'three';
import { buildRig, poseRig, type PoseParams, type Rig, type RigSpec } from '../../render/characters';
import { dampAngle, yawTo, type Vec3 } from '../../core/math';

export class Npc {
  readonly rig: Rig;
  pos: Vec3;
  yaw: number;
  private walkTo: Vec3 | null = null;
  private stride = 0;
  private moving = 0;
  private t = 0;
  speed = 2.2;
  lookAt: Vec3 | null = null;
  pose: Partial<PoseParams> = {};
  /** Прозрачность (для записей, которые появляются и гаснут). */
  opacity = 1;

  constructor(parent: THREE.Object3D, spec: RigSpec, pos: Vec3, yaw = 0) {
    this.rig = buildRig(spec);
    parent.add(this.rig.root);
    this.pos = { ...pos };
    this.yaw = yaw;
  }

  goTo(p: Vec3 | null, speed = 2.2): void {
    this.walkTo = p ? { ...p } : null;
    this.speed = speed;
  }

  get arrived(): boolean {
    return this.walkTo === null;
  }

  update(dt: number): void {
    this.t += dt;
    this.moving = 0;
    if (this.walkTo) {
      const dx = this.walkTo.x - this.pos.x;
      const dz = this.walkTo.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) {
        this.walkTo = null;
      } else {
        const step = Math.min(d, this.speed * dt);
        this.pos.x += (dx / d) * step;
        this.pos.z += (dz / d) * step;
        this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 8, dt);
        this.stride += step;
        this.moving = this.speed;
      }
    } else if (this.lookAt) {
      this.yaw = dampAngle(this.yaw, yawTo(this.pos, this.lookAt), 5, dt);
    }
  }

  render(): void {
    const r = this.rig.root;
    r.position.set(this.pos.x, this.pos.y, this.pos.z);
    r.rotation.set(0, this.yaw, 0);
    poseRig(this.rig, { stride: this.stride, speed: Math.min(1, this.moving / 5), idleTime: this.t, ...this.pose });
    for (const m of this.rig.materials) {
      const base = this.rig.spec.imprint ? this.rig.spec.imprint.opacity : 1;
      m.transparent = this.opacity < 1 || !!this.rig.spec.imprint;
      m.opacity = base * this.opacity;
    }
    r.visible = this.opacity > 0.01;
  }

  dispose(): void {
    this.rig.root.removeFromParent();
  }
}

/** Меч и щит Дружинника — светящаяся запись. */
export const armDruzhinnik = (rig: Rig): THREE.Mesh => {
  const mat = new THREE.MeshStandardMaterial({ color: 0xbfefff, emissive: 0x6fdcff, emissiveIntensity: 1.3, transparent: true, opacity: 0.9 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 1.25), mat);
  blade.position.z = 0.75;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.06), mat);
  guard.position.z = 0.1;
  rig.handR.add(blade, guard);
  return blade;
};

/** Планшет Ники с датчиками. */
export const armNika = (rig: Rig): void => {
  const tablet = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.02, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2a6a3a, emissiveIntensity: 0.9 }),
  );
  tablet.position.set(0, 0, 0.1);
  rig.handL.add(tablet);
};
