// Бит «Погоня»: Лёва выходит из пельменной, садится на самокат и уходит от минивэна
// Реставраторов по проспекту Ленина. Обучение бегу и рывку.

import * as THREE from 'three';
import type { InputFrame } from '../../../core/input';
import { dampAngle, lerp, lerpAngle, vec3 } from '../../../core/math';
import type { Beat, PrologueScene } from '../prologue-scene';
import { ScooterController, type Obstacle } from '../../../player/scooter';
import { LOW_KINDS, RIDE, RIDE_TRIGGERS } from '../../../data/levels/prologue-ride';
import { buildObstacle, buildScooter, buildVan } from '../props';
import { createVan, placeVanBehind, updateVan, type VanState } from '../van';
import { BARKS, HINTS, OBJECTIVES, ORDER, PUSHES, RIDE_LINES, SCRIPT_BLOCKED, SCRIPT_INTRO, TITLES } from '../../../data/text/prologue';
import { ORDER_TIMER } from '../../../data/balance';
import { buildRig, poseRig, type Rig } from '../../../render/characters';
import { RESTORER, RESTORER_LEADER } from '../../../data/characters';

type Phase = 'intro' | 'walk' | 'ride' | 'caught' | 'blocked';

const CAR_COLORS = [0x5a2a2a, 0x2a3a5a, 0x7a7a7a, 0x1e1e1e, 0x9a8a5a, 0x2a4a3a, 0xc8c8c8];

export class RideBeat implements Beat {
  private phase: Phase = 'intro';
  private phaseTime = 0;
  private scooter!: ScooterController;
  private obstacles: Obstacle[] = [];
  private obstacleViews = new Map<number, THREE.Object3D>();
  private knockAnim = new Map<number, number>();
  private van: VanState = createVan();
  private vanView!: THREE.Group;
  private scooterView!: ReturnType<typeof buildScooter>;
  private group = new THREE.Group();
  private fired = new Set<number>();
  private checkpointZ: number = RIDE.checkpoints[0];
  private orderTime = ORDER.minutes * 60;
  private timerOn = false;
  private hopTaught = false;
  private crashes = 0;
  private mouseIdle = 0;
  private restorers: Rig[] = [];
  private fadeTimer = 0;
  private timers: { t: number; fn: () => void }[] = [];

  constructor(private s: PrologueScene) {}

  enter(): void {
    const s = this.s;
    s.scene.add(this.group);
    // Препятствия погони.
    let id = 0;
    const defs = [
      ...RIDE.obstacles,
      ...RIDE.parked.map(([x, z]) => ({ kind: 'car' as const, x, z, hx: 1.0, hz: 2.2, rotY: 0 })),
    ];
    for (const d of defs) {
      const o: Obstacle = { x: d.x, z: d.z, hx: d.hx, hz: d.hz, rotY: d.rotY ?? 0, low: LOW_KINDS.includes(d.kind), knocked: false, id: id++ };
      this.obstacles.push(o);
      const v = buildObstacle(d.kind, d.hx, d.hz, CAR_COLORS[o.id % CAR_COLORS.length]);
      v.position.set(d.x, 0, d.z);
      v.rotation.y = o.rotY;
      this.group.add(v);
      this.obstacleViews.set(o.id, v);
    }
    this.scooter = new ScooterController(s.player, s.physics, this.obstacles);
    this.scooterView = buildScooter();
    this.scooterView.group.position.set(RIDE.scooterSpawn.x, 0, RIDE.scooterSpawn.z);
    this.scooterView.group.rotation.y = Math.PI;
    this.group.add(this.scooterView.group);

    this.vanView = buildVan();
    this.vanView.visible = false;
    this.group.add(this.vanView);

    s.controller.teleport(vec3(RIDE.playerSpawn.x, 0.05, RIDE.playerSpawn.z), Math.PI * 1.4);
    s.cam.yaw = Math.PI * 1.25;
    s.playerView.setWeapon('none');
    s.ui.title(TITLES.intro.main, TITLES.intro.sub);
    s.ui.fade(1, 0);
    s.player.controllable = false;
    s.bus.emit('serious', { on: false });
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseTime = 0;
  }

  onCue(name: string): void {
    const s = this.s;
    if (name === 'blockedCam') {
      s.cutCam = { pos: vec3(9, 3.2, RIDE.blockVanZ + 14), look: vec3(0, 1.2, RIDE.blockVanZ + 2) };
    }
    if (name === 'restorersExit') {
      const specs = [RESTORER, RESTORER_LEADER, RESTORER];
      specs.forEach((spec, i) => {
        const rig = buildRig(spec);
        rig.root.position.set(-2.4 + i * 2.4, 0, RIDE.blockVanZ + 1.9);
        rig.root.rotation.y = 0;
        this.group.add(rig.root);
        this.restorers.push(rig);
      });
    }
  }

  /** Отложенное действие в игровом времени (останавливается на паузе). */
  private later(sec: number, fn: () => void): void {
    this.timers.push({ t: sec, fn });
  }

  update(dt: number, f: InputFrame): void {
    const s = this.s;
    this.phaseTime += dt;
    for (const t of [...this.timers]) {
      t.t -= dt;
      if (t.t <= 0) {
        this.timers.splice(this.timers.indexOf(t), 1);
        t.fn();
      }
    }
    if (this.timerOn) {
      this.orderTime -= dt * ORDER_TIMER.rate;
      s.ui.orderTimer(formatTimer(this.orderTime), this.orderTime < 0);
    }
    this.mouseIdle = Math.abs(f.lookX) + Math.abs(f.lookY) > 0 ? 0 : this.mouseIdle + dt;

    switch (this.phase) {
      case 'intro':
        s.movePlayer(dt, f, null);
        if (this.phaseTime > 2.2) {
          s.ui.title(null);
          s.ui.fade(0, 1.2);
          s.player.controllable = true;
          s.ui.hint(HINTS.move);
          s.ui.objective(OBJECTIVES.scooter);
          s.play(SCRIPT_INTRO);
          this.setPhase('walk');
        }
        break;
      case 'walk': {
        s.movePlayer(dt, f, null);
        const d = Math.hypot(s.player.pos.x - RIDE.scooterSpawn.x, s.player.pos.z - RIDE.scooterSpawn.z);
        if (this.phaseTime > 6 && d > 2) s.ui.hint(HINTS.mount);
        if (d < 1.7) this.mount();
        break;
      }
      case 'ride':
        this.updateRide(dt, f);
        break;
      case 'caught':
        if (this.phaseTime > 0.6 && this.fadeTimer === 0) {
          this.fadeTimer = 1;
          this.restartFromCheckpoint();
          s.ui.fade(0, 0.6);
        }
        if (this.phaseTime > 1.4) {
          s.player.controllable = true;
          this.setPhase('ride');
        }
        break;
      case 'blocked':
        this.scooter.update(dt, { mx: 0, my: -1, lookX: 0, lookY: 0, held: 0, pressed: 0 });
        s.cam.update(dt, 0, 0, s.player.pos, null);
        break;
    }
  }

  private mount(): void {
    const s = this.s;
    s.controller.teleport(vec3(RIDE.scooterSpawn.x, 0.05, RIDE.scooterSpawn.z), Math.PI);
    this.scooter.reset();
    this.scooterView.headlight.intensity = 30;
    s.ui.hint(HINTS.ride, 6);
    s.ui.objective(OBJECTIVES.deliver);
    s.bus.emit('push', { text: PUSHES.order });
    this.timerOn = true;
    this.setPhase('ride');
  }

  private updateRide(dt: number, f: InputFrame): void {
    const s = this.s;
    const p = s.player;
    const events = this.scooter.update(dt, f);
    for (const e of events) {
      if (e.type === 'hop') {
        s.bus.emit('sfx', { id: 'hop' });
        if (!this.hopTaught && this.fired.has(2)) {
          this.hopTaught = true;
          s.ui.hint(HINTS.hopAgain, 4);
        }
      }
      if (e.type === 'knock') {
        this.knockAnim.set(e.obstacle.id, 0);
        s.bus.emit('sfx', { id: 'cone' });
      }
      if (e.type === 'crash') {
        s.bus.emit('sfx', { id: 'crash' });
        s.cam.kick(1);
        const line = RIDE_LINES.crash[this.crashes % RIDE_LINES.crash.length];
        s.ui.say('leva', line, 1.6);
        if (this.crashes % 2 === 1) {
          const b = BARKS.crash[(this.crashes >> 1) % BARKS.crash.length];
          s.bus.emit('bark', b);
        }
        this.crashes++;
      }
    }

    // Камера-преследователь: если мышь не трогают, она сама встаёт за спину.
    s.cam.update(dt, f.lookX, f.lookY, p.pos, null);
    if (this.mouseIdle > 0.8) {
      s.cam.yaw = dampAngle(s.cam.yaw, p.yaw, 3.5, dt);
      s.cam.pitch = lerp(s.cam.pitch, 0.18, Math.min(1, dt * 2));
    }

    // Сюжетные триггеры по оси Z.
    RIDE_TRIGGERS.forEach((t, i) => {
      if (this.fired.has(i) || p.pos.z > t.z) return;
      this.fired.add(i);
      this.trigger(t.cue, t.z);
    });

    // Минивэн.
    if (this.van.active) {
      const caught = updateVan(this.van, dt, p.pos.x, p.pos.z, this.scooter.sc.speed, this.fired.has(8) ? 1.2 : 0);
      // Минивэн сносит конусы и ограждения на своём пути.
      for (const o of this.obstacles) {
        if (o.knocked || !o.low) continue;
        if (Math.abs(o.z - this.van.z) < 2.6 && Math.abs(o.x - this.van.x) < o.hx + 1.1) {
          o.knocked = true;
          this.knockAnim.set(o.id, 0);
        }
      }
      if (caught) this.caught();
    }

    if (p.pos.z < RIDE.endZ) this.blocked();
  }

  private trigger(cue: string, z: number): void {
    const s = this.s;
    switch (cue) {
      case 'rideStart':
        s.bus.emit('bark', BARKS.rideStart[0]);
        break;
      case 'vanAppears':
        placeVanBehind(this.van, s.player.pos.x, s.player.pos.z);
        this.vanView.visible = true;
        s.bus.emit('sfx', { id: 'tuningFork' });
        s.bus.emit('bark', BARKS.vanAppears[0]);
        s.ui.objective(OBJECTIVES.escape);
        this.later(2.5, () => s.ui.say('leva', RIDE_LINES.vanAppears));
        break;
      case 'hopHint':
        s.ui.hint(HINTS.hop, 7);
        break;
      case 'checkpoint':
        this.checkpointZ = z;
        break;
      case 'vanya1':
        s.bus.emit('bark', BARKS.vanya1[0]);
        break;
      case 'late':
        s.bus.emit('push', { text: PUSHES.late });
        break;
      case 'vanBoost':
        s.bus.emit('bark', BARKS.vanBoost[0]);
        break;
      case 'kremlinAhead':
        s.ui.say('leva', RIDE_LINES.kremlinAhead);
        break;
    }
  }

  private caught(): void {
    const s = this.s;
    s.player.controllable = false;
    s.ui.fade(1, 0.5);
    s.ui.hint(HINTS.caught, 3);
    s.bus.emit('bark', BARKS.caught[0]);
    s.bus.emit('sfx', { id: 'crash' });
    this.fadeTimer = 0;
    this.setPhase('caught');
  }

  private restartFromCheckpoint(): void {
    const s = this.s;
    const z = this.checkpointZ;
    s.controller.teleport(vec3(2, 0.05, z), Math.PI);
    s.cam.yaw = Math.PI;
    this.scooter.reset();
    this.scooter.sc.speed = 5;
    if (this.van.active) placeVanBehind(this.van, 2, z);
    this.van.travelled = RIDE.checkpoints[0] - z;
    for (const o of this.obstacles) {
      if (o.z < z) {
        o.knocked = false;
        this.knockAnim.delete(o.id);
        const v = this.obstacleViews.get(o.id)!;
        v.position.set(o.x, 0, o.z);
        v.rotation.set(0, o.rotY, 0);
      }
    }
  }

  private blocked(): void {
    const s = this.s;
    this.setPhase('blocked');
    s.player.controllable = false;
    this.van.active = false;
    this.vanView.visible = false;
    this.timerOn = false;
    s.ui.hint(null);
    s.bus.emit('sfx', { id: 'brake' });
    s.play(SCRIPT_BLOCKED, () => {
      s.cutCam = null;
      s.goTo('brawl');
    });
  }

  render(alpha: number, frameDt: number): void {
    const s = this.s;
    const p = s.player;
    const riding = this.phase === 'ride' || this.phase === 'caught' || this.phase === 'blocked';
    s.playerView.update(p, alpha, frameDt, { scooter: riding, lean: riding ? this.scooter.sc.lean : 0 });
    if (riding) {
      const sv = this.scooterView.group;
      const root = s.playerView.rig.root;
      root.position.y += this.scooter.sc.hopY + 0.12;
      sv.position.set(root.position.x, root.position.y - 0.12, root.position.z);
      sv.rotation.set(0, root.rotation.y, root.rotation.z * 0.6);
    }
    // Минивэн.
    if (this.van.active) {
      this.vanView.position.set(lerp(this.van.prevX, this.van.x, alpha), 0, lerp(this.van.prevZ, this.van.z, alpha));
      this.vanView.rotation.y = lerpAngle(this.vanView.rotation.y, this.van.yaw, Math.min(1, frameDt * 8));
    }
    // Разлетающиеся конусы и ограждения.
    for (const [id, t] of this.knockAnim) {
      const nt = t + frameDt;
      this.knockAnim.set(id, nt);
      const v = this.obstacleViews.get(id)!;
      if (nt < 1.2) {
        v.position.y = Math.max(0, Math.sin(nt * 3) * 1.2);
        v.position.z -= frameDt * 6;
        v.rotation.x += frameDt * 9;
      }
    }
    // Мигающие лампы на ограждениях.
    const blink = Math.floor(s.time * 2) % 2 === 0;
    for (const v of this.obstacleViews.values()) {
      const b = v.getObjectByName('blink');
      if (b) b.visible = blink;
    }
    for (const r of this.restorers) poseRig(r, { stride: 0, speed: 0, idleTime: s.time });
  }

  exit(): void {
    this.s.ui.orderTimer(null);
    this.s.ui.hint(null);
    this.s.scene.remove(this.group);
  }
}

const formatTimer = (sec: number): string => {
  const late = sec < 0;
  const a = Math.abs(Math.floor(sec));
  const m = Math.floor(a / 60);
  const ss = String(a % 60).padStart(2, '0');
  return `${late ? ORDER.lateLabel : ORDER.timerLabel} ${late ? '+' : ''}${m}:${ss}`;
};
