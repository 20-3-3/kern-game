// Отображение Дружинника: крупная светящаяся фигура-запись, поза по состоянию босса.

import * as THREE from 'three';
import { buildRig, poseRig, type PoseParams, type Rig } from '../render/characters';
import { DRUZHINNIK } from '../data/characters';
import { lerp, lerpAngle } from '../core/math';
import { armDruzhinnik } from '../levels/prologue/npc';
import type { DruzhinnikBoss } from './druzhinnik';

export class DruzhinnikView {
  readonly rig: Rig;
  private blade: THREE.Mesh;
  private t = 0;
  private base: THREE.Color[];
  /** Громкость записи 0..1 — ярче и «дрожит». */
  loudness = 0.3;
  silenced = false;

  constructor(
    parent: THREE.Object3D,
    private b: DruzhinnikBoss,
  ) {
    this.rig = buildRig(DRUZHINNIK);
    this.blade = armDruzhinnik(this.rig);
    parent.add(this.rig.root);
    this.base = this.rig.materials.map((m) => m.emissive.clone());
  }

  update(alpha: number, frameDt: number): void {
    const b = this.b;
    const r = this.rig.root;
    this.t += frameDt;
    r.visible = b.state !== 'gone';
    if (!r.visible) return;
    r.position.set(lerp(b.prevPos.x, b.pos.x, alpha), 0, lerp(b.prevPos.z, b.pos.z, alpha));
    r.rotation.set(0, lerpAngle(b.prevYaw, b.yaw, alpha), 0);
    const beat = b.stateBeats + b.beatPhase;
    const p: PoseParams = { stride: this.t * Math.min(3, b.speed), speed: Math.min(1, b.speed / 3), idleTime: this.t };
    const a = b.currentAttack;
    switch (b.state) {
      case 'attack':
        if (a) {
          const first = a.impacts[0];
          const last = a.impacts[a.impacts.length - 1];
          let t: number;
          if (beat < first) t = 0.4 * Math.min(1, beat / Math.max(0.5, first - 0.15));
          else if (beat < last + 0.4) t = 0.4 + 0.2 * Math.min(1, ((beat - first) % 1) / 0.25);
          else t = 0.6 + 0.4 * Math.min(1, (beat - last - 0.4) / Math.max(0.3, a.length - last - 0.4));
          const style = a.impacts.length > 1 && Math.floor(beat - first) % 2 === 1 ? 'backhand' : a.style;
          p.swing = { style, t };
        }
        break;
      case 'ask':
        p.raised = 0.15 + Math.sin(this.t * 2) * 0.05;
        break;
      case 'horn':
        p.raised = 0.6;
        break;
      case 'open':
        p.hurt = 0.5 + Math.sin(this.t * 10) * 0.2;
        break;
      case 'phaseBreak':
        p.down = 0.45;
        break;
      case 'cutoff':
        p.raised = 1;
        break;
      case 'lastNote':
        // Запись доигрывается: меч медленно опускается.
        p.raised = Math.max(0, 1 - b.endTime / 3);
        break;
      case 'dying':
        p.hurt = 0.8;
        break;
    }
    poseRig(this.rig, p);
    if (b.state === 'cutoff') {
      // Дрожит на самой высокой ноте.
      r.position.x += Math.sin(this.t * 60) * 0.03;
    }

    // Свет записи: громче — ярче, под «Тишиной» — тусклее.
    const flash = Math.max(0, 1 - b.hitFlash * 6);
    let glow = 0.45 + this.loudness * 0.9 + (b.state === 'cutoff' ? 0.8 : 0);
    if (this.silenced) glow *= 0.45;
    let opacity = 0.88;
    if (b.state === 'lastNote') opacity = Math.max(0, 0.88 - Math.max(0, b.endTime - 8) * 0.4);
    if (b.state === 'dying') opacity = Math.max(0, 0.88 - b.endTime * 0.6) * (Math.sin(this.t * 50) > 0 ? 1 : 0.4);
    this.rig.materials.forEach((m, i) => {
      m.emissive.copy(this.base[i]);
      m.emissiveIntensity = glow;
      if (flash > 0) m.emissive.lerp(WHITE, flash);
      if (b.state === 'open') m.emissive.lerp(OPEN, 0.4 + Math.sin(this.t * 14) * 0.2);
      if (b.state === 'attack' && a && beat < a.impacts[0]) m.emissive.lerp(WINDUP, 0.12 + Math.abs(Math.sin(this.t * 16)) * 0.15);
      m.opacity = opacity;
    });
    (this.blade.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + glow;
    if (b.state === 'dying') {
      const k = 1 + Math.sin(this.t * 40) * 0.05;
      r.scale.set(k, 1 / k, k);
    } else {
      r.scale.set(1, 1, 1);
    }
  }

  dispose(): void {
    this.rig.root.removeFromParent();
  }
}

const WHITE = new THREE.Color(0xffffff);
const OPEN = new THREE.Color(0xffd24d);
const WINDUP = new THREE.Color(0xff3020);
