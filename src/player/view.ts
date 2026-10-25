// Отображение Лёвы: собирает фигуру из примитивов и ставит позу по состоянию логики.

import * as THREE from 'three';
import { buildRig, poseRig, type Rig, type SwingStyle } from '../render/characters';
import { LEVA } from '../data/characters';
import { lerp, lerpAngle } from '../core/math';
import { PLAYER } from '../data/balance';
import type { PlayerState } from './controller';

export type WeaponForm = 'none' | 'bag' | 'kern' | 'sword';

export interface PlayerVisualExtras {
  swing?: { style: SwingStyle; t: number };
  block?: number;
  scooter?: boolean;
  lean?: number;
}

export class PlayerView {
  readonly rig: Rig;
  private weapon = new THREE.Group();
  private form: WeaponForm = 'none';
  private bagInHand: THREE.Mesh;
  private kernStone: THREE.Mesh;
  private sword: THREE.Group;
  private swordMat: THREE.MeshStandardMaterial;
  private blockT = 0;
  private idle = 0;

  constructor(scene: THREE.Scene) {
    this.rig = buildRig(LEVA);
    scene.add(this.rig.root);
    this.rig.handR.add(this.weapon);

    const bagMat = new THREE.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.7, flatShading: true, emissive: 0x2a1200 });
    this.bagInHand = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.3), bagMat);
    this.bagInHand.position.set(0, -0.28, 0.05);
    this.weapon.add(this.bagInHand);

    // Керн: серый шестигранный столбик породы с прожилками кварца.
    this.kernStone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.32, 6),
      new THREE.MeshStandardMaterial({ color: 0x6f7378, roughness: 0.6, flatShading: true, emissive: 0x0b2230 }),
    );
    this.kernStone.rotation.x = Math.PI / 2;
    this.kernStone.position.set(0, 0, 0.12);
    this.weapon.add(this.kernStone);

    // Меч из керна: рукоять — камень, клинок — светящийся кварц.
    this.sword = new THREE.Group();
    this.swordMat = new THREE.MeshStandardMaterial({
      color: 0xbfefff,
      emissive: 0x5fcfff,
      emissiveIntensity: 1.4,
      roughness: 0.25,
      metalness: 0.2,
      flatShading: true,
    });
    const hilt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.045, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0x5c6066, flatShading: true }),
    );
    hilt.rotation.x = Math.PI / 2;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: 0x5c6066 }));
    guard.position.z = 0.12;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 1.0), this.swordMat);
    blade.position.z = 0.64;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), this.swordMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 1.21;
    this.sword.add(hilt, guard, blade, tip);
    this.weapon.add(this.sword);
    this.setWeapon('none');
  }

  setWeapon(form: WeaponForm): void {
    this.form = form;
    this.bagInHand.visible = form === 'bag';
    this.kernStone.visible = form === 'kern';
    this.sword.visible = form === 'sword';
    const backBag = this.rig.torso.getObjectByName('backBag');
    const stripe = this.rig.torso.getObjectByName('backBagStripe');
    if (backBag) backBag.visible = form !== 'bag';
    if (stripe) stripe.visible = form !== 'bag';
  }

  get weaponForm(): WeaponForm {
    return this.form;
  }

  /** Свечение клинка (растёт со шкалой Аккорда). */
  setGlow(v: number): void {
    this.swordMat.emissiveIntensity = 1.0 + v * 2.5;
  }

  /** Мировая позиция кончика оружия (для следа удара). */
  weaponTip(out: THREE.Vector3): THREE.Vector3 {
    return this.sword.localToWorld(out.set(0, 0, 1.2));
  }

  update(s: PlayerState, alpha: number, frameDt: number, extra: PlayerVisualExtras = {}): void {
    const r = this.rig.root;
    r.position.set(lerp(s.prevPos.x, s.pos.x, alpha), lerp(s.prevPos.y, s.pos.y, alpha), lerp(s.prevPos.z, s.pos.z, alpha));
    r.rotation.set(0, lerpAngle(s.prevYaw, s.yaw, alpha), 0);
    this.idle += frameDt;
    const blockTarget = extra.block ?? 0;
    this.blockT += (blockTarget - this.blockT) * Math.min(1, frameDt * 18);
    // Мигание во время неуязвимости рывка.
    r.visible = !(s.iframes > 0 && s.action === 'dash' && Math.floor(this.idle * 40) % 3 === 0);
    poseRig(this.rig, {
      stride: s.stride,
      speed: extra.scooter ? 0 : s.groundSpeed / PLAYER.runSpeed,
      swing: extra.swing,
      block: this.blockT > 0.01 ? this.blockT : undefined,
      dash: s.action === 'dash' ? s.actionTime / PLAYER.dash.duration : undefined,
      hurt: s.action === 'hurt' ? s.actionTime / PLAYER.hurtStun : undefined,
      down: s.action === 'down' ? s.actionTime * 2 : undefined,
      scooter: extra.scooter,
      idleTime: this.idle,
    });
    if (extra.lean) r.rotation.z = extra.lean;
  }
}
