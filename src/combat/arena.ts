// Арена боя: связывает Лёву, его боевую систему, захват цели и врагов.
// Драка с Реставраторами, тренировка с керном и бой с боссом используют её одинаково.

import * as THREE from 'three';
import type { InputFrame } from '../core/input';
import { lerp, makeRng, type Vec3 } from '../core/math';
import { PlayerCombat, type DefenseResult, type IncomingAttack, type PlayerHit } from './player-combat';
import type { Target } from './hitbox';
import { LockOn } from '../player/lock-on';
import {
  AttackTokens,
  createFighter,
  damageFighter,
  isAlive,
  isThrowable,
  parryFighter,
  throwFighter,
  updateFighter,
  type Fighter,
  type FighterState,
} from '../enemies/fighter';
import { FighterView } from '../enemies/view';
import { DEFENSE } from '../data/combat';
import { PLAYER } from '../data/balance';
import type { LevelScene } from '../levels/level-scene';
import type { TouchButton } from '../core/scene';
import { TOUCH_TEXT } from '../data/text/ui';

export class Arena {
  fighters: Fighter[] = [];
  private views = new Map<number, FighterView>();
  private prevStates = new Map<number, FighterState>();
  readonly tokens = new AttackTokens();
  readonly combat: PlayerCombat;
  readonly lock = new LockOn();
  readonly root = new THREE.Group();
  private rng = makeRng(77);
  private nextId = 100;
  /** Ускорение врагов (заедание). */
  speedMul = 1;
  /** Множитель входящего урона по Лёве. */
  incomingMul = 1;
  /** Дополнительные цели (босс). */
  extraTargets: () => Target[] = () => [];
  onExtraHit: (h: PlayerHit) => void = () => undefined;
  /** Можно ли бросить дополнительную цель. */
  onPlayerAction: (a: string) => void = () => undefined;
  /** Вызывается, когда враг выбыл. */
  onDefeated: (f: Fighter) => void = () => undefined;
  private tmp = new THREE.Vector3();
  /** Время «каста» (Аккорд, Последняя нота): Лёва стоит на месте. */
  castTime = -1;
  private castDur = 0;

  constructor(private s: LevelScene) {
    this.combat = new PlayerCombat(s.player);
    s.scene.add(this.root);
  }

  private get bus() {
    return this.s.ctx.bus;
  }

  spawn(kind: string, pos: Vec3, yaw = 0, active = true): Fighter {
    const def = { radius: 0.4, height: 1.8 };
    const physId = this.s.physics.addCharacter(pos, def.radius, def.height);
    const f = createFighter(this.nextId++, physId, kind, pos, yaw);
    f.active = active;
    this.fighters.push(f);
    this.views.set(f.id, new FighterView(this.root, f));
    return f;
  }

  get alive(): Fighter[] {
    return this.fighters.filter(isAlive);
  }

  get targets(): Target[] {
    const list: Target[] = this.fighters.map((f) => ({ id: f.id, pos: f.pos, radius: f.def.radius, alive: isAlive(f) }));
    return list.concat(this.extraTargets());
  }

  lockedTarget(): Target | null {
    if (this.lock.target === null) return null;
    return this.targets.find((t) => t.id === this.lock.target && t.alive) ?? null;
  }

  update(dt: number, f: InputFrame): void {
    const s = this.s;
    const p = s.player;
    const targets = this.targets;

    if (this.lock.update(f, p.pos, s.cam.yaw, targets)) this.action('lock');
    const lock = this.lockedTarget();
    p.facingTarget = lock && p.action !== 'dash' ? lock.pos : null;

    const res = this.combat.update(dt, f, targets, lock, (id) => {
      const fi = this.fighters.find((x) => x.id === id);
      return !!fi && isThrowable(fi);
    });
    for (const a of res.actions) this.action(a);
    if (res.throwTarget !== null) {
      const fi = this.fighters.find((x) => x.id === res.throwTarget)!;
      const dir = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
      const dealt = throwFighter(fi, dir, this.tokens);
      this.bus.emit('hit', { attacker: p.id, target: fi.id, damage: dealt, kind: 'throw', blocked: false, pos: { ...fi.pos } });
      this.bus.emit('sfx', { id: 'throw' });
      s.cam.kick(0.8);
    }
    for (const h of res.hits) this.applyPlayerHit(h);

    if (this.castTime >= 0) {
      this.castTime += dt;
      if (this.castTime >= this.castDur) {
        this.castTime = -1;
        if (p.action === 'cast') s.controller.setAction('idle');
      }
    }

    // Движение Лёвы с учётом боя.
    const c = this.combat;
    const attacking = c.attackIndex >= 0;
    s.movePlayer(dt, f, lock?.pos ?? null, {
      forced: attacking ? c.lungeVelocity() : c.throwTime >= 0 ? { x: 0, z: 0 } : undefined,
      speedOverride: c.blocking ? PLAYER.blockMoveSpeed : undefined,
      lockTurn: attacking,
      noDash: c.throwTime >= 0,
    });

    // Враги.
    for (const fi of this.fighters) {
      const ev = updateFighter(fi, dt, {
        target: p.pos,
        mover: s.physics,
        tokens: this.tokens,
        rng: this.rng,
        speedMul: this.speedMul,
      });
      const prev = this.prevStates.get(fi.id);
      if (fi.state === 'windup' && prev !== 'windup' && fi.attack) {
        this.bus.emit('enemyWindup', { id: fi.id, attack: fi.attack.id, pos: { ...fi.pos }, heavy: !!fi.attack.heavy });
      }
      this.prevStates.set(fi.id, fi.state);
      if (ev && ev.inRange && p.action !== 'down') {
        this.incoming({ damage: ev.attack.damage, heavy: ev.attack.heavy, unblockable: ev.attack.unblockable, from: fi.pos }, fi);
      } else if (ev) {
        this.bus.emit('sfx', { id: 'whiff', pos: { ...fi.pos } });
      }
      if (fi.removed && this.views.has(fi.id)) {
        this.views.get(fi.id)!.dispose();
        this.views.delete(fi.id);
        s.physics.removeCharacter(fi.physId);
      }
    }
  }

  private action(a: string): void {
    this.bus.emit('playerAction', { action: a });
    this.onPlayerAction(a);
  }

  private applyPlayerHit(h: PlayerHit): void {
    const p = this.s.player;
    p.timeSinceCombat = 0;
    const fi = this.fighters.find((x) => x.id === h.target);
    if (!fi) {
      this.onExtraHit(h);
      return;
    }
    const r = damageFighter(fi, h, this.tokens);
    if (r.dealt <= 0) return;
    this.bus.emit('hit', { attacker: p.id, target: fi.id, damage: r.dealt, kind: h.kind, blocked: false, pos: { ...fi.pos } });
    this.bus.emit('sfx', { id: this.combat.mode === 'kern' ? 'kernHit' : 'bagHit', pos: { ...fi.pos } });
    this.s.cam.kick(h.kind === 'heavy' ? 0.6 : 0.3);
    this.s.fx.burst({ x: fi.pos.x, y: 1.2, z: fi.pos.z }, this.combat.mode === 'kern' ? 0xbff4ff : 0xffc070, h.kind === 'heavy' ? 10 : 5, 3);
    this.s.ctx.loop.hitStop(h.kind === 'heavy' || r.killed ? 0.07 : 0.035);
    if (r.killed) {
      this.bus.emit('enemyDefeated', { id: fi.id, kind: fi.def.kind, pos: { ...fi.pos } });
      if (this.lock.target === fi.id) this.lock.target = null;
      this.onDefeated(fi);
    }
  }

  /** Удар по Лёве (от бойца арены или от босса). */
  incoming(a: IncomingAttack, source: Fighter | null = null, onParry?: () => void): DefenseResult {
    const s = this.s;
    const p = s.player;
    p.timeSinceCombat = 0;
    const result = this.combat.receive(a);
    const pos = { ...p.pos };
    switch (result) {
      case 'parried':
        if (source) parryFighter(source, p.pos, this.tokens);
        onParry?.();
        this.bus.emit('parry', { attacker: source?.id ?? -1, pos });
        this.bus.emit('sfx', { id: 'parry', pos });
        this.action('parry');
        s.cam.kick(0.5);
        s.fx.burst({ x: (p.pos.x + a.from.x) / 2, y: 1.3, z: (p.pos.z + a.from.z) / 2 }, 0xffe7a0, 14, 4);
        s.ctx.loop.hitStop(0.09);
        break;
      case 'blocked': {
        const dmg = a.damage * DEFENSE.blockDamageMul * this.incomingMul;
        s.controller.hurt(dmg);
        this.bus.emit('sfx', { id: 'block', pos });
        this.bus.emit('playerHurt', { damage: dmg, hp: p.hp });
        s.cam.kick(0.25);
        break;
      }
      case 'hit': {
        const dmg = a.damage * this.incomingMul;
        if (s.controller.hurt(dmg)) {
          this.bus.emit('sfx', { id: 'hurt', pos });
          this.bus.emit('playerHurt', { damage: dmg, hp: p.hp });
          s.cam.kick(0.7);
          this.s.ctx.ui.flash('rgba(255,40,40,0.35)', 0.4);
          if (p.hp <= 0) this.bus.emit('playerDown', {});
        }
        break;
      }
      case 'dodged':
        this.bus.emit('sfx', { id: 'dodge', pos });
        this.bus.emit('perfectDodge', { pos });
        break;
    }
    return result;
  }

  /** Кнопки боя на телефоне. accordFull — полна ли шкала Аккорда (null — бой без керна). */
  touchButtons(accordFull: boolean | null): TouchButton[] {
    const T = TOUCH_TEXT;
    const b: TouchButton[] = [
      { action: 'attack', label: T.attack },
      { action: 'block', label: T.block },
      { action: 'dash', label: T.dash },
      { action: 'lock', label: T.lock, hot: this.lock.target !== null },
    ];
    if (this.lock.target !== null) b.push({ action: 'lockNext', label: T.lockNext });
    if (this.combat.mode === 'bag') {
      const can = this.fighters.some((f) => isAlive(f) && isThrowable(f));
      b.push({ action: 'accord', label: T.throw, hot: can, dim: !can });
    } else if (accordFull !== null) {
      b.push({ action: 'accord', label: T.accord, hot: accordFull, dim: !accordFull });
    }
    return b;
  }

  /** Лёва замирает на время сильного приёма. */
  cast(duration: number): void {
    this.castTime = 0;
    this.castDur = duration;
    this.combat.reset();
    this.s.controller.setAction('cast');
  }

  /** Удар по области: всех бойцов в радиусе. Возвращает число задетых. */
  areaBlast(center: Vec3, radius: number, damage: number): number {
    let n = 0;
    for (const fi of this.fighters) {
      if (!isAlive(fi)) continue;
      const dx = fi.pos.x - center.x;
      const dz = fi.pos.z - center.z;
      const d = Math.hypot(dx, dz);
      if (d > radius + fi.def.radius) continue;
      n++;
      this.applyPlayerHit({
        target: fi.id,
        damage,
        kind: 'accord',
        knockback: 4,
        stagger: 1,
        dir: { x: dx / (d || 1), z: dz / (d || 1) },
        attack: 'accord',
      });
    }
    return n;
  }

  /** Поза Лёвы для отображения (удар, блок, бросок). */
  playerVisual(): { swing?: { style: import('../render/characters').SwingStyle; t: number }; block?: number } {
    const c = this.combat;
    if (this.castTime >= 0) return { swing: { style: 'slam', t: Math.min(1, this.castTime / Math.max(0.1, this.castDur)) } };
    if (c.throwTime >= 0) return { swing: { style: 'slam', t: 0.3 + c.throwTime / 0.6 * 0.7 } };
    const a = c.current;
    if (a) return { swing: { style: a.style, t: c.swingT } };
    return { block: c.blocking ? 1 : 0 };
  }

  render(alpha: number, frameDt: number): void {
    for (const v of this.views.values()) v.update(alpha, frameDt);
    const lock = this.lockedTarget();
    const hud = this.s.ctx.hud;
    if (lock) {
      const fi = this.fighters.find((x) => x.id === lock.id);
      const prev = fi?.prevPos ?? lock.pos;
      this.tmp.set(lerp(prev.x, lock.pos.x, alpha), lock.pos.y + 2.0 + (fi ? 0 : 0.8), lerp(prev.z, lock.pos.z, alpha));
      hud.lock(this.tmp, this.s.ctx.renderer.camera, fi ? fi.hp / fi.def.hp : 1);
    } else {
      hud.lock(null, this.s.ctx.renderer.camera);
    }
  }

  /** Убрать всех врагов (перезапуск боя). */
  clear(): void {
    for (const v of this.views.values()) v.dispose();
    this.views.clear();
    for (const f of this.fighters) if (!f.removed) this.s.physics.removeCharacter(f.physId);
    this.fighters = [];
    this.prevStates.clear();
    this.tokens.clear();
    this.lock.target = null;
    this.combat.reset();
  }

  dispose(): void {
    this.clear();
    this.root.removeFromParent();
  }
}
