// Дружинник: запись 1380 года. Логика босса без рендера.
// Всё привязано к долям такта: замах, удар, повтор «Где князь?» в начале каждой 40-секундной записи.
// Три фазы; Аккорд ломает фазу; в конце третьей — момент обрыва, где можно доиграть
// запись Последней нотой или просто добить.

import { cloneVec, copyVec, dampAngle, vec3, yawTo, type Vec3 } from '../core/math';
import type { Mover } from '../core/physics';
import { inArc, inRadius } from '../combat/hitbox';
import { DRUZHINNIK_BOSS, type BossAttackDef, type BossMove } from '../data/bosses/druzhinnik';

export type BossState =
  | 'intro'
  | 'ask'
  | 'walk'
  | 'idle'
  | 'attack'
  | 'horn'
  | 'open'
  | 'phaseBreak'
  | 'cutoff'
  | 'lastNote'
  | 'dying'
  | 'gone';

export type BossEvent =
  | { type: 'beat'; index: number; loopBeat: number }
  | { type: 'ask' }
  | { type: 'windup'; attack: BossAttackDef }
  | { type: 'warn'; attack: BossAttackDef }
  | { type: 'impact'; attack: BossAttackDef; inRange: boolean }
  | { type: 'phaseBroken'; phase: number; byAccord: boolean }
  | { type: 'phaseStart'; phase: number }
  | { type: 'summon'; count: number }
  | { type: 'cutoff'; active: boolean }
  | { type: 'killed' }
  | { type: 'lastNote' };

export interface BossContext {
  target: Vec3;
  /** Ускорение движения (заедание, громкость). */
  speedMul: number;
}

export class DruzhinnikBoss {
  readonly cfg = DRUZHINNIK_BOSS;
  pos: Vec3;
  prevPos: Vec3;
  yaw = 0;
  prevYaw = 0;
  phase = 0;
  hp: number;
  state: BossState = 'intro';
  /** Сколько долей прошло в текущем состоянии. */
  stateBeats = 0;
  /** Время внутри текущей доли, с. */
  beatTime = 0;
  beatIndex = -1;
  private moveIndex = 0;
  private attack: BossAttackDef | null = null;
  private stateLen = 0;
  private cutoffPending = false;
  /** Пропущенный обрыв повторится на cutoffLoopBeat следующей записи. */
  private cutoffMissed = false;
  /** Время с начала «смерти» или Последней ноты, с. */
  endTime = 0;
  speed = 0;
  hitFlash = 9;

  constructor(
    pos: Vec3,
    private mover: Mover,
    readonly physId: number,
  ) {
    this.pos = cloneVec(pos);
    this.prevPos = cloneVec(pos);
    this.hp = this.cfg.phases[0].hp;
  }

  get beatLen(): number {
    return 60 / this.cfg.bpm;
  }

  get loopBeat(): number {
    return ((this.beatIndex % this.cfg.loopBeats) + this.cfg.loopBeats) % this.cfg.loopBeats;
  }

  get maxHp(): number {
    return this.cfg.phases[this.phase].hp;
  }

  get hpFrac(): number {
    return this.hp / this.maxHp;
  }

  get alive(): boolean {
    return this.state !== 'dying' && this.state !== 'gone' && this.state !== 'lastNote';
  }

  get vulnerable(): boolean {
    return this.alive && this.state !== 'intro' && this.state !== 'phaseBreak';
  }

  get currentAttack(): BossAttackDef | null {
    return this.attack;
  }

  /** Прогресс текущей доли 0..1. */
  get beatPhase(): number {
    return this.beatTime / this.beatLen;
  }

  /** Начать запись (после вступительной кат-сцены). */
  start(): void {
    this.beatIndex = -1;
    this.beatTime = this.beatLen - 1e-6;
    this.setState('idle', 0);
  }

  private setState(s: BossState, beats: number): void {
    this.state = s;
    this.stateBeats = 0;
    this.stateLen = beats;
  }

  update(dt: number, c: BossContext): BossEvent[] {
    const ev: BossEvent[] = [];
    copyVec(this.prevPos, this.pos);
    this.prevYaw = this.yaw;
    this.hitFlash += dt;
    if (this.state === 'lastNote' || this.state === 'dying') {
      this.endTime += dt;
      return ev;
    }
    if (this.state === 'intro' || this.state === 'gone') return ev;

    this.beatTime += dt;
    while (this.beatTime >= this.beatLen) {
      this.beatTime -= this.beatLen;
      this.onBeat(c, ev);
    }
    this.continuous(dt, c);
    return ev;
  }

  /** Всё, что происходит ровно на доле. */
  private onBeat(c: BossContext, ev: BossEvent[]): void {
    this.beatIndex++;
    ev.push({ type: 'beat', index: this.beatIndex, loopBeat: this.loopBeat });
    this.stateBeats++;
    const lb = this.loopBeat;

    // Удары внутри приёма.
    if (this.state === 'attack' && this.attack) {
      const a = this.attack;
      if (a.impacts.includes(this.stateBeats)) {
        const inRange = a.radial ? inRadius(this.pos, c.target, 0.35, a.range) : inArc(this.pos, this.yaw, c.target, 0.35, a.range, a.arc);
        ev.push({ type: 'impact', attack: a, inRange });
      }
      if (a.impacts.includes(this.stateBeats + 1)) ev.push({ type: 'warn', attack: a });
    }

    if (this.state === 'cutoff' && this.stateBeats >= this.stateLen) {
      // Обрыв пропущен: запись бьёт свой последний удар и крутится дальше.
      ev.push({ type: 'cutoff', active: false });
      this.cutoffMissed = true;
      this.startAttack('finalBlow', ev);
      return;
    }

    // Конец «закрытых» состояний: слом фазы и открытость после парирования.
    if ((this.state === 'phaseBreak' || this.state === 'open') && this.stateBeats >= this.stateLen) {
      if (this.state === 'phaseBreak') {
        this.phase++;
        this.hp = this.maxHp;
        this.moveIndex = 0;
        ev.push({ type: 'phaseStart', phase: this.phase });
        const ph = this.cfg.phases[this.phase];
        if (ph.summon > 0) {
          this.setState('horn', 2);
          ev.push({ type: 'summon', count: ph.summon });
          return;
        }
      }
      this.attack = null;
      this.nextMove(c, ev);
      return;
    }

    // Состояния, которые нельзя прервать началом новой записи.
    const locked =
      this.state === 'phaseBreak' || this.state === 'cutoff' || this.state === 'open' || (this.state === 'attack' && this.attack?.id === 'finalBlow');

    // Начало записи: «Где князь?» — и всё сначала, в том же порядке.
    if (lb === 0 && !locked) {
      this.attack = null;
      this.moveIndex = 0;
      this.setState('ask', this.cfg.askBeats);
      ev.push({ type: 'ask' });
      return;
    }

    // Третья фаза: запись подходит к обрыву.
    if (
      !locked &&
      this.phase === 2 &&
      this.hpFrac <= this.cfg.cutoffThreshold &&
      (this.cutoffPending || (this.cutoffMissed && lb === this.cfg.cutoffLoopBeat))
    ) {
      this.cutoffPending = false;
      this.attack = null;
      this.setState('cutoff', this.cfg.cutoffBeats);
      ev.push({ type: 'cutoff', active: true });
      return;
    }

    // Обычный конец приёма (и последнего удара после обрыва) — следующий по циклу фазы.
    if (this.state !== 'cutoff' && this.stateLen > 0 && this.stateBeats >= this.stateLen) {
      this.attack = null;
      this.nextMove(c, ev);
    }
  }

  private nextMove(c: BossContext, ev: BossEvent[]): void {
    const cycle = this.cfg.phases[this.phase].cycle;
    const m = cycle[this.moveIndex % cycle.length] as BossMove;
    this.moveIndex++;
    switch (m.kind) {
      case 'walk':
        // Если уже рядом — сразу следующий приём.
        if (Math.hypot(c.target.x - this.pos.x, c.target.z - this.pos.z) <= this.cfg.stopDist + 0.3) this.nextMove(c, ev);
        else this.setState('walk', m.beats);
        break;
      case 'idle':
        this.setState('idle', m.beats);
        break;
      case 'horn':
        this.setState('horn', 2);
        break;
      case 'attack':
        this.startAttack(m.id, ev);
        break;
    }
  }

  private startAttack(id: string, ev: BossEvent[]): void {
    const a = (this.cfg.attacks as Record<string, BossAttackDef>)[id];
    this.attack = a;
    this.setState('attack', a.length);
    ev.push({ type: 'windup', attack: a });
    if (a.impacts.includes(1)) ev.push({ type: 'warn', attack: a });
  }

  /** Движение между долями: ходьба, разворот, выпады. */
  private continuous(dt: number, c: BossContext): void {
    let mx = 0;
    let mz = 0;
    const d = Math.hypot(c.target.x - this.pos.x, c.target.z - this.pos.z);
    const face = (l: number) => (this.yaw = dampAngle(this.yaw, yawTo(this.pos, c.target), l, dt));
    switch (this.state) {
      case 'walk':
      case 'idle':
      case 'ask':
      case 'horn':
        face(this.state === 'walk' ? 6 : 3);
        if (this.state === 'walk' && d > this.cfg.stopDist) {
          const v = this.cfg.walkSpeed * c.speedMul;
          mx = ((c.target.x - this.pos.x) / d) * v;
          mz = ((c.target.z - this.pos.z) / d) * v;
        }
        break;
      case 'attack': {
        const a = this.attack!;
        const first = a.impacts[0];
        const last = a.impacts[a.impacts.length - 1];
        // До удара доворачивается к цели, в последнюю долю перед ударом — уже нет.
        if (this.stateBeats < first - 1) face(7);
        else if (this.stateBeats < last) face(1.5);
        // Выпад на доле перед каждым ударом.
        if (a.lunge > 0 && a.impacts.includes(this.stateBeats + 1) && d > 1.2) {
          const v = a.lunge / this.beatLen / a.impacts.length;
          mx = Math.sin(this.yaw) * v;
          mz = Math.cos(this.yaw) * v;
        }
        break;
      }
      case 'open':
      case 'phaseBreak':
      case 'cutoff':
        break;
    }
    if (mx || mz) {
      const r = this.mover.move(this.physId, vec3(mx * dt, -1 * dt, mz * dt));
      this.pos.x += r.delta.x;
      this.pos.z += r.delta.z;
    }
    this.speed = Math.hypot(this.pos.x - this.prevPos.x, this.pos.z - this.prevPos.z) / dt;
  }

  /** Попадание по записи: фактический урон и события (слом фазы, гибель). */
  takeHit(damage: number): { dealt: number; events: BossEvent[] } {
    const events: BossEvent[] = [];
    if (!this.vulnerable) return { dealt: 0, events };
    let mul = 1;
    if (this.state === 'open') mul = this.cfg.openDamageMul;
    if (this.state === 'cutoff') mul = this.cfg.cutoffDamageMul;
    const dealt = damage * mul;
    this.hp -= dealt;
    this.hitFlash = 0;
    if (this.phase < 2) {
      if (this.hp <= 0) events.push(this.breakPhase(false));
    } else if (this.state === 'cutoff') {
      if (this.hp <= 0) {
        this.hp = 0;
        this.state = 'dying';
        this.endTime = 0;
        events.push({ type: 'killed' });
      }
    } else {
      // До момента обрыва запись не добить: она держится на последней ноте.
      const floor = this.maxHp * 0.02;
      if (this.hp < floor) this.hp = floor;
      if (this.hpFrac <= this.cfg.cutoffThreshold && !this.cutoffMissed) this.cutoffPending = true;
    }
    return { dealt, events };
  }

  /** Парирование: запись сбита с такта и открыта. */
  parried(): void {
    if (!this.alive || this.state === 'cutoff' || this.state === 'phaseBreak') return;
    if (this.attack?.id === 'finalBlow') return;
    this.attack = null;
    this.setState('open', this.cfg.parryOpenBeats);
  }

  /** Аккорд: ломает текущую фазу. В третьей фазе — сразу к обрыву. */
  accord(): BossEvent[] {
    const ev: BossEvent[] = [];
    if (!this.vulnerable || this.state === 'cutoff') return ev;
    if (this.phase < 2) {
      ev.push(this.breakPhase(true));
    } else {
      this.hp = Math.min(this.hp, this.maxHp * this.cfg.cutoffThreshold);
      this.cutoffPending = true;
      this.cutoffMissed = false;
      this.hitFlash = 0;
    }
    return ev;
  }

  private breakPhase(byAccord: boolean): BossEvent {
    this.hp = 0;
    this.attack = null;
    this.setState('phaseBreak', this.cfg.phaseBreakBeats);
    return { type: 'phaseBroken', phase: this.phase, byAccord };
  }

  get inCutoff(): boolean {
    return this.state === 'cutoff';
  }

  /** Перезапуск текущей фазы (Лёву сбили с ног). */
  restartPhase(pos: Vec3): void {
    this.hp = this.maxHp;
    this.attack = null;
    this.cutoffPending = false;
    this.cutoffMissed = false;
    this.moveIndex = 0;
    copyVec(this.pos, pos);
    copyVec(this.prevPos, pos);
    this.mover.setPosition(this.physId, pos);
    this.start();
  }

  /** Последняя нота: доступна только в момент обрыва. */
  lastNote(): boolean {
    if (this.state !== 'cutoff') return false;
    this.state = 'lastNote';
    this.endTime = 0;
    this.attack = null;
    return true;
  }
}
