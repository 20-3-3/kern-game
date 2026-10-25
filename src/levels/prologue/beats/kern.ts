// Бит «Керн»: Лёва подходит к воротам, где стоит Дружинник. Керн в сумке просыпается
// и становится мечом. Отзвуки дружины — обучение серии, захвату цели, парированию.
// После второй волны прибегает Ника.

import type { InputFrame } from '../../../core/input';
import { vec3, type Vec3 } from '../../../core/math';
import type { Beat, PrologueScene } from '../prologue-scene';
import { Arena } from '../../../combat/arena';
import { KERN_BARKS, KERN_HINTS, KERN_OBJECTIVES, SCRIPT_MEET, SCRIPT_NIKA } from '../../../data/text/prologue';
import { PROLOGUE_ARENA } from '../../../data/levels/prologue-arena';
import { KernCombat } from '../kern-combat';

type Phase = 'approach' | 'meet' | 'wave' | 'nika' | 'down' | 'done';

export class KernBeat implements Beat {
  private arena!: Arena;
  private kc: KernCombat | null = null;
  private phase: Phase = 'approach';
  private phaseTime = 0;
  private wave = 0;
  private parried = false;
  private hintStage = 0;
  private hintTime = 0;

  constructor(private s: PrologueScene) {}

  enter(): void {
    const s = this.s;
    s.bus.emit('serious', { on: false });
    s.ui.fade(0, 1.2);
    s.player.controllable = true;
    s.player.hp = s.player.maxHp;
    s.playerView.setWeapon('bag');
    s.controller.teleport(vec3(0.5, 0.05, PROLOGUE_ARENA.approachStart), Math.PI);
    s.cam.yaw = Math.PI;
    s.ctx.hud.show(false);
    s.ui.objective(KERN_OBJECTIVES.approach);
    s.city.coldLight.intensity = 45;
    const dr = s.druzhinnikNpc();
    dr.pos = { ...PROLOGUE_ARENA.druzhinnikSpot };
    dr.yaw = 0;
    dr.opacity = 1;
    this.arena = new Arena(s);
    this.arena.combat.mode = 'kern';
    this.arena.onPlayerAction = (a) => {
      if (a === 'parry' && !this.parried) {
        this.parried = true;
        s.bus.emit('bark', KERN_BARKS.parry);
      }
    };
    this.arena.onDefeated = () => {
      if (this.arena.alive.length === 0) this.waveCleared();
    };
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseTime = 0;
  }

  onCue(name: string): void {
    const s = this.s;
    const dr = s.druzhinnikNpc();
    if (name === 'meetCam') {
      const p = s.player.pos;
      s.cutCam = { pos: vec3(p.x + 3, 2.2, p.z + 3.5), look: vec3((p.x + dr.pos.x) / 2, 1.8, (p.z + dr.pos.z) / 2) };
      dr.lookAt = s.player.pos;
    }
    if (name === 'kernWakes') {
      s.bus.emit('sfx', { id: 'kernWake' });
      s.ui.flash('rgba(160,230,255,0.8)', 1.2);
      s.playerView.setWeapon('sword');
      s.cam.kick(0.8);
      s.bus.emit('bark', KERN_BARKS.sword);
    }
    if (name === 'hornCall') {
      s.bus.emit('sfx', { id: 'horn' });
      dr.pose = { raised: 0.6 };
      // Запись отходит к воротам и «крутится» там, пока дерутся отзвуки.
      dr.goTo(vec3(0, 0, -588), 1.6);
    }
    if (name === 'nikaCam') {
      const n = s.nikaNpc();
      n.pos = { ...PROLOGUE_ARENA.nikaEnter };
      n.opacity = 1;
      n.goTo(PROLOGUE_ARENA.nikaSpot, 4.5);
      n.lookAt = s.player.pos;
      s.cutCam = { pos: vec3(s.player.pos.x - 4, 2.4, s.player.pos.z + 5), look: vec3(PROLOGUE_ARENA.nikaSpot.x, 1.4, PROLOGUE_ARENA.nikaSpot.z) };
    }
    if (name === 'wave3') {
      s.cutCam = null;
      this.startWave(2);
    }
  }

  private startWave(i: number): void {
    const s = this.s;
    this.wave = i;
    s.cutCam = null;
    s.player.controllable = true;
    s.ctx.hud.show(true);
    this.kc ??= new KernCombat(s, this.arena);
    s.ui.objective(KERN_OBJECTIVES.echoes);
    const spots = PROLOGUE_ARENA.waves[i];
    spots.forEach((p: Vec3, k: number) => {
      const f = this.arena.spawn('ratnik', p, Math.PI, true);
      f.state = 'spawn';
      f.spawnTime = 0.9 + k * 0.4;
      s.bus.emit('sfx', { id: 'imprintSpawn', pos: { ...p } });
    });
    this.setPhase('wave');
    if (i === 0) {
      this.hintStage = 0;
      this.hintTime = 0;
      s.ui.hint(KERN_HINTS.combo, 8);
    }
    if (i === 1) {
      s.ui.hint(KERN_HINTS.parry, 9);
      s.bus.emit('bark', KERN_BARKS.wave2);
    }
    if (i === 2) s.ui.hint(KERN_HINTS.dash, 7);
  }

  private waveCleared(): void {
    const s = this.s;
    if (this.wave === 0) this.startWave(1);
    else if (this.wave === 1) {
      this.setPhase('nika');
      s.player.controllable = false;
      s.ui.hint(null);
      s.play(SCRIPT_NIKA);
    } else {
      this.setPhase('done');
      s.ui.hint(null);
      s.goTo('boss');
    }
  }

  update(dt: number, f: InputFrame): void {
    const s = this.s;
    this.phaseTime += dt;
    const dr = s.druzhinnikNpc();
    dr.update(dt);
    s.nikaNpc().update(dt);
    switch (this.phase) {
      case 'approach':
        s.movePlayer(dt, f, null);
        if (s.player.pos.z < PROLOGUE_ARENA.meetZ) {
          this.setPhase('meet');
          s.player.controllable = false;
          s.ui.objective(null);
          s.play(SCRIPT_MEET, () => {
            s.cutCam = null;
            dr.pose = {};
            this.startWave(0);
          });
        }
        break;
      case 'meet':
      case 'nika':
        s.movePlayer(dt, f, null);
        break;
      case 'wave':
        this.arena.update(dt, this.kc ? this.kc.update(dt, f, true) : f);
        this.waveHints(dt);
        if (s.player.action === 'down') {
          this.setPhase('down');
          s.ui.hint(KERN_HINTS.down, 3);
          s.ui.fade(1, 0.8);
        }
        break;
      case 'down':
        s.movePlayer(dt, f, null);
        if (this.phaseTime > 1.2) {
          this.arena.clear();
          s.player.hp = s.player.maxHp;
          s.controller.setAction('idle');
          s.ui.fade(0, 0.8);
          this.startWave(this.wave);
        }
        break;
      case 'done':
        break;
    }
    s.ctx.hud.hp(s.player.hp, s.player.maxHp, dt);
  }

  private waveHints(dt: number): void {
    if (this.wave !== 0) return;
    this.hintTime += dt;
    if (this.hintStage === 0 && this.hintTime > 7) {
      this.hintStage = 1;
      this.s.ui.hint(KERN_HINTS.lock, 7);
    }
  }

  render(alpha: number, frameDt: number): void {
    const s = this.s;
    s.playerView.update(s.player, alpha, frameDt, this.arena.playerVisual());
    this.arena.render(alpha, frameDt);
    this.kc?.render(frameDt);
    s.druzhinnikNpc().render();
    s.nikaNpc().render();
  }

  exit(): void {
    const s = this.s;
    this.kc?.dispose();
    this.arena.dispose();
    s.ctx.hud.lock(null, s.ctx.renderer.camera);
  }
}
