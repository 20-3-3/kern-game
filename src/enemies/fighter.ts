// Базовый враг ближнего боя (люди-Реставраторы и Отпечатки-ратники).
// Конечный автомат: подход → кружение → замах → удар → восстановление;
// парирование «открывает» врага, урон оглушает, ноль здоровья — нокаут или растворение.

import { DEFENSE, ENEMIES, MAX_ATTACKERS, THROW, type EnemyAttackDef, type EnemyDef } from '../data/combat';
import { cloneVec, copyVec, dampAngle, vec3, wrapAngle, yawTo, type Vec3 } from '../core/math';
import type { Mover } from '../core/physics';
import { inArc, inRadius } from '../combat/hitbox';

export type FighterState =
  | 'spawn'
  | 'idle'
  | 'approach'
  | 'circle'
  | 'windup'
  | 'strike'
  | 'recover'
  | 'hurt'
  | 'open'
  | 'thrown'
  | 'down'
  | 'dead';

export interface Fighter {
  id: number;
  physId: number;
  def: EnemyDef;
  pos: Vec3;
  prevPos: Vec3;
  yaw: number;
  prevYaw: number;
  hp: number;
  state: FighterState;
  stateTime: number;
  attack: EnemyAttackDef | null;
  cooldown: number;
  hasToken: boolean;
  circleDir: 1 | -1;
  knock: { x: number; z: number };
  /** Время с последнего попадания (для анимации вспышки). */
  hitFlash: number;
  speed: number;
  /** Отпечаток растворяется после смерти; люди лежат в нокауте. */
  removed: boolean;
  /** Активен ли ИИ (до сюжетной метки враги стоят). */
  active: boolean;
  spawnTime: number;
  /** Поза для кат-сцен (ИИ не трогает). */
  cutscenePose: 'kneel' | null;
}

export const createFighter = (id: number, physId: number, kind: string, pos: Vec3, yaw = 0): Fighter => {
  const def = ENEMIES[kind];
  return {
    id,
    physId,
    def,
    pos: cloneVec(pos),
    prevPos: cloneVec(pos),
    yaw,
    prevYaw: yaw,
    hp: def.hp,
    state: 'idle',
    stateTime: 0,
    attack: null,
    cooldown: 0.8 + (id % 3) * 0.5,
    hasToken: false,
    circleDir: id % 2 ? 1 : -1,
    knock: { x: 0, z: 0 },
    hitFlash: 9,
    speed: 0,
    removed: false,
    active: true,
    spawnTime: 0,
    cutscenePose: null,
  };
};

export const isAlive = (f: Fighter): boolean => f.state !== 'down' && f.state !== 'dead';

/** Сколько врагов сейчас атакуют: не больше MAX_ATTACKERS одновременно. */
export class AttackTokens {
  private holders = new Set<number>();
  constructor(private max = MAX_ATTACKERS) {}
  take(id: number): boolean {
    if (this.holders.has(id)) return true;
    if (this.holders.size >= this.max) return false;
    this.holders.add(id);
    return true;
  }
  release(id: number): void {
    this.holders.delete(id);
  }
  clear(): void {
    this.holders.clear();
  }
}

export interface FighterContext {
  target: Vec3;
  /** Неуязвим ли игрок (для ИИ не важно, но полезно для отладки). */
  mover: Mover;
  tokens: AttackTokens;
  rng: () => number;
  /** Ускорение врагов от «заедания»: >1 — быстрее. */
  speedMul: number;
}

export interface StrikeEvent {
  fighter: Fighter;
  attack: EnemyAttackDef;
  /** Попал ли удар в зону, где стоит игрок (защиту решает боевая система игрока). */
  inRange: boolean;
}

const setState = (f: Fighter, s: FighterState) => {
  f.state = s;
  f.stateTime = 0;
};

const pickAttack = (f: Fighter, rng: () => number): EnemyAttackDef => {
  const total = f.def.attacks.reduce((a, b) => a + b.weight, 0);
  let r = rng() * total;
  for (const a of f.def.attacks) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return f.def.attacks[0];
};

/** Шаг ИИ. Возвращает событие удара, если удар состоялся на этом шаге. */
export const updateFighter = (f: Fighter, dt: number, c: FighterContext): StrikeEvent | null => {
  copyVec(f.prevPos, f.pos);
  f.prevYaw = f.yaw;
  f.stateTime += dt;
  f.hitFlash += dt;
  f.cooldown -= dt * c.speedMul;
  let event: StrikeEvent | null = null;
  let moveX = 0;
  let moveZ = 0;
  const toT = { x: c.target.x - f.pos.x, z: c.target.z - f.pos.z };
  const dist = Math.hypot(toT.x, toT.z);
  const faceTarget = (lambda = 8) => (f.yaw = dampAngle(f.yaw, yawTo(f.pos, c.target), lambda, dt));
  const sm = c.speedMul;

  switch (f.state) {
    case 'spawn':
      if (f.stateTime >= f.spawnTime) setState(f, 'idle');
      break;
    case 'idle':
      if (f.active) setState(f, 'approach');
      break;
    case 'approach':
    case 'circle': {
      if (!f.active) {
        setState(f, 'idle');
        break;
      }
      faceTarget();
      const next = f.attack ?? (f.attack = pickAttack(f, c.rng));
      const ready = f.cooldown <= 0;
      if (ready && c.tokens.take(f.id)) {
        f.hasToken = true;
        if (dist <= next.range * 0.85) {
          setState(f, 'windup');
          break;
        }
        // Не держим очередь вечно, если подойти не получается.
        if (f.state === 'approach' && f.stateTime > 3) {
          endAttack(f, c);
          setState(f, 'circle');
          break;
        }
        // Идём на дистанцию удара.
        moveX = (toT.x / dist) * f.def.speed * sm;
        moveZ = (toT.z / dist) * f.def.speed * sm;
        if (f.state !== 'approach') setState(f, 'approach');
      } else {
        // Ждём очереди: держим дистанцию и обходим по кругу.
        const want = f.def.circleDist;
        const radial = dist > want + 0.5 ? 1 : dist < want - 0.7 ? -1 : 0;
        const tx = -toT.z / (dist || 1);
        const tz = toT.x / (dist || 1);
        moveX = ((toT.x / (dist || 1)) * radial * 0.9 + tx * f.circleDir * 0.45) * f.def.speed * sm;
        moveZ = ((toT.z / (dist || 1)) * radial * 0.9 + tz * f.circleDir * 0.45) * f.def.speed * sm;
        if (f.stateTime > 2.5 + c.rng() * 2) {
          f.circleDir = f.circleDir === 1 ? -1 : 1;
          f.stateTime = 0;
        }
        if (f.state !== 'circle') setState(f, 'circle');
      }
      break;
    }
    case 'windup': {
      const a = f.attack!;
      // Во время замаха враг доворачивается, но медленнее — удар можно обойти рывком.
      if (f.stateTime < a.windup * 0.7) faceTarget(5);
      if (f.stateTime >= a.windup / sm) {
        setState(f, 'strike');
      }
      break;
    }
    case 'strike': {
      const a = f.attack!;
      // Выпад вперёд в момент удара.
      const lungeV = a.lunge / a.strike;
      moveX = Math.sin(f.yaw) * lungeV;
      moveZ = Math.cos(f.yaw) * lungeV;
      if (f.stateTime >= a.strike * 0.5 && f.stateTime - dt < a.strike * 0.5) {
        const inRange = a.radial ? inRadius(f.pos, c.target, 0.35, a.range) : inArc(f.pos, f.yaw, c.target, 0.35, a.range, a.arc);
        event = { fighter: f, attack: a, inRange };
      }
      if (f.stateTime >= a.strike) setState(f, 'recover');
      break;
    }
    case 'recover':
      if (f.stateTime >= f.attack!.recover / sm) {
        endAttack(f, c);
        setState(f, 'circle');
      }
      break;
    case 'hurt':
      moveX = f.knock.x;
      moveZ = f.knock.z;
      f.knock.x *= 0.85;
      f.knock.z *= 0.85;
      if (f.stateTime >= f.def.hurtStun) setState(f, 'circle');
      break;
    case 'open':
      moveX = f.knock.x;
      moveZ = f.knock.z;
      f.knock.x *= 0.85;
      f.knock.z *= 0.85;
      if (f.stateTime >= DEFENSE.parryOpenTime) setState(f, 'circle');
      break;
    case 'thrown': {
      const k = Math.max(0, 1 - f.stateTime / 0.5);
      moveX = f.knock.x * k;
      moveZ = f.knock.z * k;
      if (f.stateTime >= THROW.downTime) {
        if (f.hp <= 0) setState(f, f.def.human ? 'down' : 'dead');
        else setState(f, 'circle');
      }
      break;
    }
    case 'down':
      break;
    case 'dead':
      if (f.stateTime > 1.2) f.removed = true;
      break;
  }

  if (moveX || moveZ) {
    const res = c.mover.move(f.physId, vec3(moveX * dt, -1 * dt, moveZ * dt));
    f.pos.x += res.delta.x;
    f.pos.z += res.delta.z;
    f.pos.y = Math.max(0, f.pos.y + res.delta.y);
  }
  f.speed = Math.hypot(f.pos.x - f.prevPos.x, f.pos.z - f.prevPos.z) / dt;
  return event;
};

const endAttack = (f: Fighter, c: FighterContext) => {
  f.attack = null;
  f.hasToken = false;
  c.tokens.release(f.id);
  const [a, b] = f.def.attackCooldown;
  f.cooldown = a + c.rng() * (b - a);
};

export interface DamageInfo {
  damage: number;
  knockback: number;
  stagger: number;
  dir: { x: number; z: number };
}

/** Применить урон. Возвращает фактический урон и было ли это добивание. */
export const damageFighter = (f: Fighter, d: DamageInfo, tokens: AttackTokens): { dealt: number; killed: boolean } => {
  if (!isAlive(f)) return { dealt: 0, killed: false };
  const mul = f.state === 'open' ? DEFENSE.openDamageMul : 1;
  const dealt = d.damage * mul;
  f.hp -= dealt;
  f.hitFlash = 0;
  f.knock = { x: d.dir.x * d.knockback * 4, z: d.dir.z * d.knockback * 4 };
  if (f.hp <= 0) {
    f.hp = 0;
    releaseFighter(f, tokens);
    setState(f, f.def.human ? 'down' : 'dead');
    return { dealt, killed: true };
  }
  // Удар во время удара врага не прерывает его (иначе любой враг беззащитен).
  if (f.state !== 'strike' && f.state !== 'open' && f.state !== 'thrown') {
    if (f.state === 'windup' && d.stagger < 0.5) return { dealt, killed: false };
    releaseFighter(f, tokens);
    setState(f, 'hurt');
  }
  return { dealt, killed: false };
};

/** Парирование: враг открыт и отшатнулся. */
export const parryFighter = (f: Fighter, from: Vec3, tokens: AttackTokens): void => {
  releaseFighter(f, tokens);
  const dir = { x: f.pos.x - from.x, z: f.pos.z - from.z };
  const d = Math.hypot(dir.x, dir.z) || 1;
  f.knock = { x: (dir.x / d) * 3, z: (dir.z / d) * 3 };
  setState(f, 'open');
};

/** Бросок термосумкой/руками: враг летит и падает. */
export const throwFighter = (f: Fighter, dir: { x: number; z: number }, tokens: AttackTokens): number => {
  releaseFighter(f, tokens);
  f.hp = Math.max(0, f.hp - THROW.damage);
  f.hitFlash = 0;
  f.knock = { x: dir.x * (THROW.distance / 0.25), z: dir.z * (THROW.distance / 0.25) };
  f.yaw = Math.atan2(-dir.x, -dir.z);
  setState(f, 'thrown');
  return THROW.damage;
};

const releaseFighter = (f: Fighter, tokens: AttackTokens) => {
  f.attack = null;
  f.hasToken = false;
  tokens.release(f.id);
};

/** Можно ли бросить врага (только открытый после парирования или оглушённый). */
export const isThrowable = (f: Fighter): boolean => f.state === 'open' || (f.state === 'hurt' && f.hp < f.def.hp * 0.35);

/** Угол между взглядом врага и игроком (для анимации и подсказок). */
export const facingError = (f: Fighter, target: Vec3): number => Math.abs(wrapAngle(yawTo(f.pos, target) - f.yaw));
