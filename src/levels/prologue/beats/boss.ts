// Бит «Босс»: Дружинник. Три фазы, ритм атак по долям, «Где князь?» каждые 40 секунд,
// громкость, датчик «Тишина», момент обрыва: доиграть Последней нотой или добить.

import * as THREE from 'three';
import type { InputFrame } from '../../../core/input';
import { isPressed } from '../../../core/input';
import { distXZ, vec3 } from '../../../core/math';
import type { Beat, PrologueScene } from '../prologue-scene';
import { Arena } from '../../../combat/arena';
import { KernCombat } from '../kern-combat';
import { DruzhinnikBoss, type BossEvent } from '../../../bosses/druzhinnik';
import { DruzhinnikView } from '../../../bosses/druzhinnik-view';
import { DRUZHINNIK_BOSS as CFG } from '../../../data/bosses/druzhinnik';
import { PROLOGUE_ARENA } from '../../../data/levels/prologue-arena';
import { Loudness } from '../../../systems/loudness';
import { SILENCE } from '../../../data/balance';
import { HUD_TEXT } from '../../../data/text/ui';
import {
  BOSS_BARKS,
  BOSS_HINTS,
  BOSS_NAME,
  BOSS_OBJECTIVES,
  BOSS_PUSHES,
  BOSS_STREAM,
  SCRIPT_BOSS_INTRO,
  SCRIPT_KILL,
  SCRIPT_LAST_NOTE,
  TAIL_TEXT,
} from '../../../data/text/prologue';
import type { PlayerHit } from '../../../combat/player-combat';

const BOSS_TARGET_ID = 900;

type Phase = 'intro' | 'fight' | 'down' | 'lastNote' | 'killed' | 'done';

export class BossBeat implements Beat {
  private arena!: Arena;
  private kc!: KernCombat;
  private boss!: DruzhinnikBoss;
  private view!: DruzhinnikView;
  private loud = new Loudness();
  private phase: Phase = 'intro';
  private phaseTime = 0;
  private group = new THREE.Group();
  private fires: THREE.Group[] = [];
  private sensor: THREE.Mesh | null = null;
  private barrier = -1;
  private barrierMesh!: THREE.Mesh;
  private told = new Set<string>();
  private streamTimer = 25;
  private pushIndex = 0;
  private streamIndex = 0;
  private cineTime = 0;

  constructor(private s: PrologueScene) {}

  enter(): void {
    const s = this.s;
    s.scene.add(this.group);
    s.bus.emit('serious', { on: false });
    this.arena = new Arena(s);
    this.arena.combat.mode = 'kern';
    this.kc = new KernCombat(s, this.arena);
    this.kc.onAccord = () => this.onAccord();
    // Запись не выпускает с площади: холодная стена поперёк проспекта.
    this.barrier = s.physics.addBox(vec3(0, 3, -522), vec3(16, 3, 0.5));
    this.barrierMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(32, 6),
      new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
    );
    this.barrierMesh.position.set(0, 3, -522);
    this.group.add(this.barrierMesh);
    this.buildFires();

    // Дружинник из кат-сцены превращается в босса.
    const npc = s.druzhinnikNpc();
    npc.opacity = 0;
    const start = vec3(0, 0.05, -576);
    const physId = s.physics.addCharacter(start, CFG.radius, CFG.height);
    this.boss = new DruzhinnikBoss(start, s.physics, physId);
    this.view = new DruzhinnikView(this.group, this.boss);
    this.boss.yaw = 0;
    this.boss.prevYaw = 0;

    this.arena.extraTargets = () =>
      this.boss.vulnerable ? [{ id: BOSS_TARGET_ID, pos: this.boss.pos, radius: CFG.radius, alive: true }] : [];
    this.arena.onExtraHit = (h) => this.hitBoss(h);

    s.controller.teleport(vec3(0, 0.05, -556), Math.PI);
    s.cam.yaw = Math.PI;
    s.player.controllable = false;
    s.player.hp = s.player.maxHp;
    s.playerView.setWeapon('sword');
    const nika = s.nikaNpc();
    nika.opacity = 1;
    nika.pos = { ...PROLOGUE_ARENA.nikaSpot };
    nika.lookAt = this.boss.pos;
    s.ctx.hud.show(false);
    s.play(SCRIPT_BOSS_INTRO);
  }

  private buildFires(): void {
    for (const f of CFG.fires) {
      const g = new THREE.Group();
      g.position.set(f.x, 0, f.z);
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.9, 10),
        new THREE.MeshStandardMaterial({ color: 0x3a2a20, metalness: 0.5, roughness: 0.6 }),
      );
      barrel.position.y = 0.45;
      g.add(barrel);
      for (let i = 0; i < 3; i++) {
        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.28 - i * 0.06, 0.9 - i * 0.15, 6),
          new THREE.MeshBasicMaterial({ color: i === 0 ? 0xff6a1a : i === 1 ? 0xffa030 : 0xffe080, transparent: true, opacity: 0.85, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        flame.position.y = 1.2;
        flame.name = 'flame';
        g.add(flame);
      }
      this.s.physics.addCylinder(vec3(f.x, 0.45, f.z), 0.45, 0.45);
      this.group.add(g);
      this.fires.push(g);
    }
  }

  onCue(name: string): void {
    const s = this.s;
    if (name === 'bossCam') {
      s.cutCam = { pos: vec3(4, 2.6, -562), look: vec3(0, 2, -576) };
    }
    if (name === 'fightStart') {
      s.cutCam = null;
      s.player.controllable = true;
      s.ctx.hud.show(true);
      s.ui.objective(BOSS_OBJECTIVES.fight);
      s.ui.hint(BOSS_HINTS.rhythm, 8);
      this.boss.start();
      this.phase = 'fight';
      this.phaseTime = 0;
    }
  }

  private hitBoss(h: PlayerHit): void {
    const s = this.s;
    const r = this.boss.takeHit(h.damage);
    if (r.dealt <= 0) return;
    this.loud.onHit();
    s.bus.emit('hit', { attacker: s.player.id, target: BOSS_TARGET_ID, damage: r.dealt, kind: h.kind, blocked: false, pos: { ...this.boss.pos } });
    s.bus.emit('sfx', { id: 'kernHit', pos: { ...this.boss.pos } });
    s.fx.burst({ x: this.boss.pos.x, y: 1.6, z: this.boss.pos.z }, 0xbff4ff, 6, 3);
    s.cam.kick(h.kind === 'heavy' ? 0.6 : 0.3);
    this.handleBossEvents(r.events);
  }

  private onAccord(): void {
    const ev = this.boss.accord();
    if (distXZ(this.boss.pos, this.s.player.pos) < 12) {
      this.s.fx.burst({ x: this.boss.pos.x, y: 1.5, z: this.boss.pos.z }, 0xffffff, 16, 6);
    }
    this.handleBossEvents(ev);
  }

  private say(key: keyof typeof BOSS_BARKS, once = true): void {
    if (once && this.told.has(key)) return;
    this.told.add(key);
    const b = BOSS_BARKS[key];
    if (typeof b === 'string') return;
    this.s.ui.say(b.speaker, b.text, 3.5);
    this.s.bus.emit('sfx', { id: 'nikaVoice' });
  }

  private handleBossEvents(events: BossEvent[]): void {
    const s = this.s;
    const b = this.boss;
    for (const e of events) {
      switch (e.type) {
        case 'beat':
          s.bus.emit('beat', { index: e.index, bar: Math.floor(e.index / 4), bpm: CFG.bpm });
          break;
        case 'ask':
          s.ui.say('druzhinnik', BOSS_BARKS.ask, 2.4);
          s.bus.emit('sfx', { id: 'ask', pos: { ...b.pos } });
          break;
        case 'windup':
          s.bus.emit('enemyWindup', { id: BOSS_TARGET_ID, attack: e.attack.id, pos: { ...b.pos }, heavy: !!e.attack.heavy || !!e.attack.unblockable });
          if (e.attack.radial && e.attack.id === 'slam' && !this.told.has('slamHint')) {
            this.told.add('slamHint');
            s.ui.hint(BOSS_HINTS.slam, 5);
          }
          break;
        case 'warn':
          s.bus.emit('sfx', { id: e.attack.unblockable ? 'bossWarnHeavy' : 'bossWarn', pos: { ...b.pos } });
          break;
        case 'impact': {
          const a = e.attack;
          if (a.radial) {
            s.fx.ring(b.pos, 0x9fe8ff, a.range, 0.45);
            s.cam.kick(0.9);
            s.bus.emit('sfx', { id: 'slam', pos: { ...b.pos } });
          } else {
            s.bus.emit('sfx', { id: 'bossSwing', pos: { ...b.pos } });
          }
          if (e.inRange && s.player.action !== 'down') {
            const muffled = this.loud.silenced ? 0.5 : 1;
            this.arena.incoming(
              { damage: a.damage * this.loud.damageMul * muffled, heavy: a.heavy, unblockable: a.unblockable, from: b.pos },
              null,
              () => b.parried(),
            );
          }
          break;
        }
        case 'phaseBroken':
          s.bus.emit('phaseBroken', { boss: CFG.id, phase: e.phase, byAccord: e.byAccord });
          s.bus.emit('sfx', { id: 'phaseBreak', pos: { ...b.pos } });
          s.fx.ring(b.pos, 0xffffff, 8, 0.8);
          s.ui.flash('rgba(200,240,255,0.4)', 0.6);
          this.say('phaseBroken');
          break;
        case 'phaseStart':
          this.loud.value = Math.min(1, this.loud.value + CFG.phases[e.phase].loudnessBoost);
          if (e.phase === 1) this.say('phase2');
          if (e.phase === 2) this.say('phase3');
          break;
        case 'summon':
          s.bus.emit('sfx', { id: 'horn', pos: { ...b.pos } });
          for (let i = 0; i < e.count; i++) {
            const a = (i / e.count) * Math.PI * 2 + 0.6;
            const f = this.arena.spawn('ratnik', vec3(b.pos.x + Math.sin(a) * 4, 0.05, b.pos.z + Math.cos(a) * 4), 0, true);
            f.state = 'spawn';
            f.spawnTime = 1 + i * 0.3;
          }
          break;
        case 'cutoff':
          s.bus.emit('cutoff', { boss: CFG.id, active: e.active });
          if (e.active) {
            s.bus.emit('sfx', { id: 'cutoff', pos: { ...b.pos } });
            if (s.kernSys.accord.full) this.say('cutoffReady', false);
            else this.say('cutoffNotReady', false);
          } else {
            s.ui.keyPrompt(null);
            this.say('missed');
          }
          break;
        case 'killed':
          this.onKilled();
          break;
        case 'lastNote':
          break;
      }
    }
  }

  update(dt: number, raw: InputFrame): void {
    const s = this.s;
    this.phaseTime += dt;
    s.nikaNpc().update(dt);
    const b = this.boss;
    if (this.phase === 'intro') {
      s.movePlayer(dt, raw, null);
      return;
    }
    if (this.phase === 'fight') {
      const f = this.kc.update(dt, raw, true);
      // Последняя нота.
      if (isPressed(f, 'lastNote') && b.inCutoff && s.kernSys.accord.full && s.player.action !== 'down') {
        s.kernSys.accord.spend();
        this.startLastNote();
        return;
      }
      if (isPressed(f, 'silence') && this.loud.deploySilence()) this.deploySilence();

      this.arena.update(dt, f);
      const speedMul = s.kernSys.jam.enemySpeedMul * this.loud.speedMul;
      this.handleBossEvents(b.update(dt, { target: s.player.pos, speedMul }));
      const nearFire = CFG.fires.some((fp) => Math.hypot(fp.x - b.pos.x, fp.z - b.pos.z) < 5);
      this.loud.update(dt, nearFire);
      if (nearFire && this.loud.value > 0.5) this.say('fire');
      if (this.loud.value > 0.7) this.say('loud');
      if (b.phase === 2 && s.kernSys.accord.full && !b.inCutoff) this.say('saveAccord');
      this.updateHumor(dt);

      if (b.inCutoff) s.ui.keyPrompt(s.kernSys.accord.full ? BOSS_HINTS.cutoffReady : BOSS_HINTS.cutoffNotReady);
      else s.ui.keyPrompt(null);

      if (this.phaseTime > 14 && !this.told.has('silenceHint')) {
        this.told.add('silenceHint');
        s.ui.hint(BOSS_HINTS.silence, 7);
      }

      if (s.player.action === 'down') {
        this.phase = 'down';
        this.phaseTime = 0;
        s.ui.keyPrompt(null);
        s.ui.hint(BOSS_HINTS.down, 3);
        s.ui.fade(1, 0.8);
      }
    } else if (this.phase === 'down') {
      s.movePlayer(dt, raw, null);
      if (this.phaseTime > 1.2) {
        this.arena.clear();
        s.player.hp = s.player.maxHp;
        s.controller.setAction('idle');
        s.controller.teleport(vec3(0, 0.05, -556), Math.PI);
        b.restartPhase(vec3(0, 0.05, -576));
        this.loud = new Loudness();
        s.ui.fade(0, 0.8);
        this.phase = 'fight';
        this.phaseTime = 15;
      }
    } else if (this.phase === 'lastNote') {
      this.updateLastNote(dt);
      b.update(dt, { target: s.player.pos, speedMul: 1 });
      s.movePlayer(dt, raw, null);
    } else if (this.phase === 'killed') {
      b.update(dt, { target: s.player.pos, speedMul: 1 });
      s.movePlayer(dt, raw, null);
    }

    // Громкость видна только по камере и свету.
    s.cam.shake = this.phase === 'fight' ? Math.max(0, this.loud.value - 0.25) * 1.4 : 0;
    s.city.coldLight.intensity = 25 + this.loud.value * 70 * (this.loud.silenced ? 0.4 : 1);
    s.bus.emit('loudness', { value: this.loud.value });
    s.ctx.hud.hp(s.player.hp, s.player.maxHp, dt);
    const cd = this.loud.silenceCooldown;
    s.ctx.hud.silence(
      this.phase === 'fight' ? (this.loud.silenceReady ? HUD_TEXT.silenceReady : `${HUD_TEXT.silenceCooldown} ${Math.ceil(this.loud.silenced ? this.loud.silenceTime : cd)}`) : null,
      this.loud.silenceReady,
    );
    s.ctx.hud.boss(this.phase === 'fight' || this.phase === 'down' ? BOSS_NAME : null, Math.max(0, b.hpFrac), b.phase, 3, b.inCutoff);
  }

  private updateHumor(dt: number): void {
    const s = this.s;
    this.streamTimer -= dt;
    if (this.streamTimer <= 0) {
      this.streamTimer = 30 + Math.random() * 15;
      if (this.streamIndex < BOSS_STREAM.length) s.bus.emit('bark', BOSS_STREAM[this.streamIndex++]);
      else if (this.pushIndex < BOSS_PUSHES.length) s.bus.emit('push', { text: BOSS_PUSHES[this.pushIndex++] });
    }
  }

  private deploySilence(): void {
    const s = this.s;
    const p = s.player.pos;
    s.bus.emit('playerAction', { action: 'silence' });
    s.bus.emit('silence', { pos: { ...p }, active: true });
    s.bus.emit('sfx', { id: 'silence', pos: { ...p } });
    s.fx.ring(p, 0x9be37a, 10, 0.9);
    this.say('silence');
    this.sensor?.removeFromParent();
    this.sensor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 0.35, 8),
      new THREE.MeshStandardMaterial({ color: 0x223322, emissive: 0x9be37a, emissiveIntensity: 1.5 }),
    );
    this.sensor.position.set(p.x, 0.18, p.z);
    this.group.add(this.sensor);
  }

  private startLastNote(): void {
    const s = this.s;
    const b = this.boss;
    b.lastNote();
    this.phase = 'lastNote';
    this.cineTime = 0;
    this.arena.clear();
    s.player.controllable = false;
    s.ui.keyPrompt(null);
    s.ui.hint(null);
    s.ui.objective(null);
    s.ctx.hud.show(false);
    s.bus.emit('serious', { on: true });
    s.bus.emit('sfx', { id: 'lastNoteStart', pos: { ...b.pos } });
    // Лёва в два шага у цели, удар-«доставка до двери».
    const dir = Math.atan2(s.player.pos.x - b.pos.x, s.player.pos.z - b.pos.z);
    s.controller.teleport(vec3(b.pos.x + Math.sin(dir) * 2, 0.05, b.pos.z + Math.cos(dir) * 2), dir + Math.PI);
    this.arena.cast(1.4);
    s.ctx.loop.timeScale = 0.35;
  }

  private updateLastNote(dt: number): void {
    const s = this.s;
    const b = this.boss;
    this.cineTime += dt;
    const t = this.cineTime;
    const a = t * 0.6;
    s.cutCam = { pos: vec3(b.pos.x + Math.sin(a) * 6, 2.2 + t * 0.2, b.pos.z + Math.cos(a) * 6), look: vec3(b.pos.x, 1.8, b.pos.z) };
    if (t > 0.5 && !this.told.has('lnFlash')) {
      this.told.add('lnFlash');
      s.ui.flash('#ffffff', 1.6);
      s.fx.ring(b.pos, 0xffffff, 14, 1.4);
      s.fx.burst({ x: b.pos.x, y: 1.8, z: b.pos.z }, 0xffffff, 30, 8);
      s.bus.emit('sfx', { id: 'lastNote', pos: { ...b.pos } });
      s.ctx.loop.timeScale = 1;
      s.bus.emit('lastNote', { boss: CFG.id, tail: CFG.id });
      s.bus.emit('choiceMade', { id: 'prologue', value: 'finish' });
      s.play(SCRIPT_LAST_NOTE, () => {
        s.ui.center(TAIL_TEXT.druzhinnik, 4.5);
        this.finish('finish');
      });
    }
  }

  private onKilled(): void {
    const s = this.s;
    const b = this.boss;
    this.phase = 'killed';
    s.killTime = s.time;
    this.arena.clear();
    s.player.controllable = false;
    s.ui.keyPrompt(null);
    s.ui.hint(null);
    s.ui.objective(null);
    s.ctx.hud.show(false);
    s.bus.emit('serious', { on: true });
    s.bus.emit('sfx', { id: 'killed', pos: { ...b.pos } });
    s.bus.emit('bossKilled', { boss: CFG.id });
    s.bus.emit('choiceMade', { id: 'prologue', value: 'kill' });
    s.ui.flash('rgba(255,255,255,0.6)', 0.3);
    s.cutCam = { pos: vec3(s.player.pos.x + 3, 2.4, s.player.pos.z + 4), look: vec3(b.pos.x, 1.6, b.pos.z) };
    s.play(SCRIPT_KILL, () => this.finish('kill'));
  }

  private finish(result: 'finish' | 'kill'): void {
    const s = this.s;
    this.phase = 'done';
    s.prologueResult = result;
    s.prologueJam = s.kernSys.jam.chapterAverage();
    s.cutCam = null;
    s.goTo('aftermath');
  }

  render(alpha: number, frameDt: number): void {
    const s = this.s;
    s.playerView.update(s.player, alpha, frameDt, this.arena.playerVisual());
    this.arena.render(alpha, frameDt);
    this.kc.render(frameDt);
    this.view.loudness = this.loud.value;
    this.view.silenced = this.loud.silenced;
    this.view.update(alpha, frameDt);
    s.nikaNpc().render();
    // Огонь мерцает, датчик пульсирует.
    for (const g of this.fires) {
      g.children.forEach((c, i) => {
        if (c.name !== 'flame') return;
        const k = 1 + Math.sin(s.time * (9 + i * 3) + i) * 0.15;
        c.scale.set(k, 1 + Math.sin(s.time * 13 + i) * 0.25, k);
      });
    }
    if (this.sensor) {
      const on = this.loud.silenced;
      (this.sensor.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1 + Math.sin(s.time * 10) : 0.1;
      if (!on && this.loud.silenceCooldown < SILENCE.cooldown - SILENCE.duration - 2) {
        this.sensor.removeFromParent();
        this.sensor = null;
      }
    }
    (this.barrierMesh.material as THREE.MeshBasicMaterial).opacity = 0.08 + Math.sin(s.time * 2) * 0.04;
  }

  exit(): void {
    const s = this.s;
    s.ctx.loop.timeScale = 1;
    this.kc.dispose();
    this.arena.dispose();
    this.view.dispose();
    s.physics.removeStatic(this.barrier);
    s.physics.removeCharacter(this.boss.physId);
    this.group.removeFromParent();
    s.cam.shake = 0;
    s.ui.keyPrompt(null);
    s.ctx.hud.boss(null);
    s.ctx.hud.silence(null, false);
    s.ctx.hud.lock(null, s.ctx.renderer.camera);
    s.kernSys.enabled = false;
  }
}
