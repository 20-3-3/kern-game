// Бит «Драка»: трое Реставраторов у минивэна. Обучение удару, блоку, парированию,
// броску и рывку. Керн против людей не используется — только термосумка.

import * as THREE from 'three';
import type { InputFrame } from '../../../core/input';
import { vec3 } from '../../../core/math';
import type { Beat, PrologueScene } from '../prologue-scene';
import { Arena } from '../../../combat/arena';
import { RIDE } from '../../../data/levels/prologue-ride';
import { BRAWL_BARKS, BRAWL_HINTS, BRAWL_LINES, SCRIPT_SUMMON } from '../../../data/text/prologue';
import { isAlive, type Fighter } from '../../../enemies/fighter';
import { MAP } from '../../../data/levels/prologue-map';

type Phase = 'fight' | 'down' | 'summon';

const START = [
  { kind: 'restorer', x: -2.4 },
  { kind: 'restorerLeader', x: 0 },
  { kind: 'restorer', x: 2.4 },
] as const;

export class BrawlBeat implements Beat {
  private arena!: Arena;
  private phase: Phase = 'fight';
  private phaseTime = 0;
  private tutorial = 0;
  private tutorialTime = 0;
  private parried = false;
  private thrown = false;
  private retry = false;
  private hitLine = 0;
  private leader: Fighter | null = null;
  private ring: THREE.Mesh | null = null;

  constructor(private s: PrologueScene) {}

  enter(): void {
    const s = this.s;
    s.player.controllable = true;
    s.playerView.setWeapon('bag');
    s.ctx.hud.show(true);
    s.ctx.hud.setKernMode(false);
    s.ui.objective('Отбиться от Реставраторов');
    this.arena = new Arena(s);
    this.arena.combat.mode = 'bag';
    this.arena.onPlayerAction = (a) => this.onAction(a);
    this.arena.onDefeated = () => this.onDefeated();
    s.bus.on('hit', this.onHit);
    this.setup();
    s.bus.emit('bark', BRAWL_BARKS.start);
    s.bus.emit('music', { mode: 'fight' });
  }

  private setup(): void {
    const s = this.s;
    this.arena.clear();
    s.player.hp = s.player.maxHp;
    s.controller.setAction('idle');
    s.controller.teleport(vec3(0.5, 0.05, RIDE.blockVanZ + 9), Math.PI);
    s.cam.yaw = Math.PI;
    START.forEach((e, i) => {
      const f = this.arena.spawn(e.kind, vec3(e.x, 0.05, RIDE.blockVanZ + 2.5), 0, this.retry || i === 0);
      if (e.kind === 'restorerLeader') this.leader = f;
    });
    if (!this.retry) {
      this.tutorial = 0;
      this.tutorialTime = 0;
      s.ui.hint(BRAWL_HINTS.attack);
      s.ui.say('leader', BRAWL_LINES.leaderTaunt, 3);
    }
    this.phase = 'fight';
  }

  private onHit = (e: { attacker: number; target: number }) => {
    if (e.attacker !== this.s.player.id || this.phase !== 'fight') return;
    if (Math.random() < 0.3) {
      const t = BRAWL_LINES.restorerHit;
      this.s.ui.say('restorer', t[this.hitLine++ % t.length], 1.5);
    }
  };

  private onAction(a: string): void {
    const s = this.s;
    if (a === 'parry' && !this.parried) {
      this.parried = true;
      s.ui.hint(BRAWL_HINTS.throw, 6);
      s.bus.emit('bark', BRAWL_BARKS.parry);
    }
    if (a === 'throw' && !this.thrown) {
      this.thrown = true;
      s.bus.emit('bark', BRAWL_BARKS.throwDone);
    }
  }

  private onDefeated(): void {
    const left = this.arena.alive.length;
    if (left === 1) this.s.bus.emit('bark', BRAWL_BARKS.last);
    if (left === 0) this.startSummon();
  }

  /** Обучение по шагам: сначала один противник, потом все. */
  private updateTutorial(dt: number): void {
    const s = this.s;
    this.tutorialTime += dt;
    const first = this.arena.fighters[0];
    if (this.tutorial === 0 && (first.state === 'windup' || this.tutorialTime > 8)) {
      this.tutorial = 1;
      s.ui.hint(BRAWL_HINTS.block);
    }
    if (this.tutorial === 1 && (this.parried || this.tutorialTime > 22 || first.hp < first.def.hp * 0.5 || !isAlive(first))) {
      this.tutorial = 2;
      if (!this.parried) s.ui.hint(BRAWL_HINTS.dash, 7);
      for (const f of this.arena.fighters) f.active = true;
    }
    if (this.tutorial === 2 && this.parried && this.tutorialTime > 30) {
      this.tutorial = 3;
      s.ui.hint(BRAWL_HINTS.dash, 7);
    }
  }

  private startSummon(): void {
    const s = this.s;
    this.phase = 'summon';
    this.phaseTime = 0;
    s.player.controllable = false;
    s.ui.hint(null);
    s.ctx.hud.show(false);
    this.arena.lock.target = null;
    s.ui.objective(null);
    s.bus.emit('music', { mode: 'serious' });
    // Старший Реставратор приподнимается для последней реплики.
    if (this.leader) this.leader.cutscenePose = 'kneel';
    s.play(SCRIPT_SUMMON, () => {
      s.cutCam = null;
      s.goTo('kern');
    });
  }

  onCue(name: string): void {
    const s = this.s;
    const L = this.leader;
    if (name === 'summonCam' && L) {
      s.cutCam = { pos: vec3(L.pos.x + 3.5, 1.8, L.pos.z + 4.5), look: vec3(L.pos.x, 0.9, L.pos.z) };
    }
    if (name === 'forkStrike' && L) {
      s.bus.emit('sfx', { id: 'forkStrike', pos: { ...L.pos } });
      s.ui.flash('rgba(160,230,255,0.5)', 0.8);
      s.cam.kick(1);
      // Звуковая волна от камертона.
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 1.0, 48),
        new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(L.pos.x, 0.1, L.pos.z);
      s.scene.add(ring);
      this.ring = ring;
    }
    if (name === 'recordRises') {
      s.bus.emit('serious', { on: true });
      s.bus.emit('sfx', { id: 'recordRise' });
      s.cutCam = { pos: vec3(7, 4.5, RIDE.blockVanZ + 12), look: vec3(0, 7, MAP.wall.z) };
    }
    if (name === 'restorersFlee') {
      s.ui.fade(1, 1);
    }
  }

  update(dt: number, f: InputFrame): void {
    const s = this.s;
    this.phaseTime += dt;
    if (this.phase === 'fight') {
      this.updateTutorial(dt);
      this.arena.update(dt, f);
      if (s.player.action === 'down') {
        this.phase = 'down';
        this.phaseTime = 0;
        s.ui.hint(BRAWL_HINTS.down, 3);
        s.ui.fade(1, 1);
      }
    } else if (this.phase === 'down') {
      s.movePlayer(dt, f, null);
      if (this.phaseTime > 1.4) {
        this.retry = true;
        this.setup();
        s.ui.fade(0, 0.8);
      }
    } else {
      // Во время кат-сцены враги лежат, а Лёва стоит.
      s.movePlayer(dt, f, null);
      if (this.ring) {
        const k = this.phaseTime * 22;
        this.ring.scale.setScalar(1 + (k % 60));
        (this.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - (k % 60) / 60);
      }
      s.city.coldLight.intensity = Math.min(60, s.city.coldLight.intensity + dt * 20);
    }
    s.ctx.hud.hp(s.player.hp, s.player.maxHp, dt);
  }

  render(alpha: number, frameDt: number): void {
    const s = this.s;
    s.playerView.update(s.player, alpha, frameDt, this.arena.playerVisual());
    this.arena.render(alpha, frameDt);
  }

  exit(): void {
    const s = this.s;
    s.bus.off('hit', this.onHit);
    this.arena.dispose();
    this.ring?.removeFromParent();
    s.ctx.hud.lock(null, s.ctx.renderer.camera);
  }
}
