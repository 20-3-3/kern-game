// Контроллер Лёвы: бег, повороты, рывок, гравитация. Чистая логика без Three.js.

import { PLAYER } from '../data/balance';
import { cloneVec, copyVec, dampAngle, vec3, yawTo, type Vec3 } from '../core/math';
import type { Mover } from '../core/physics';
import { isPressed, type InputFrame } from '../core/input';

export type PlayerAction = 'idle' | 'run' | 'dash' | 'attack' | 'block' | 'hurt' | 'down' | 'cast' | 'throw' | 'replay';

export interface PlayerState {
  id: number;
  pos: Vec3;
  prevPos: Vec3;
  vel: Vec3;
  yaw: number;
  prevYaw: number;
  grounded: boolean;
  hp: number;
  maxHp: number;
  action: PlayerAction;
  /** Время с начала текущего действия. */
  actionTime: number;
  dashTimer: number;
  dashCooldown: number;
  dashDir: { x: number; z: number };
  iframes: number;
  hurtTimer: number;
  /** Фаза шага для анимации. */
  stride: number;
  /** Скорость по земле (для анимации). */
  groundSpeed: number;
  /** Можно ли управлять (кат-сцены отключают). */
  controllable: boolean;
  /** Цель, к которой игрок развёрнут (захват цели). */
  facingTarget: Vec3 | null;
  /** Разрешён ли рывок (до обучения — нет). */
  dashEnabled: boolean;
  timeSinceCombat: number;
}

export const createPlayerState = (id: number, pos: Vec3, yaw = 0): PlayerState => ({
  id,
  pos: cloneVec(pos),
  prevPos: cloneVec(pos),
  vel: vec3(),
  yaw,
  prevYaw: yaw,
  grounded: true,
  hp: PLAYER.maxHp,
  maxHp: PLAYER.maxHp,
  action: 'idle',
  actionTime: 0,
  dashTimer: 0,
  dashCooldown: 0,
  dashDir: { x: 0, z: 1 },
  iframes: 0,
  hurtTimer: 0,
  stride: 0,
  groundSpeed: 0,
  controllable: true,
  facingTarget: null,
  dashEnabled: true,
  timeSinceCombat: 99,
});

/** Перевод ввода (относительно камеры) в направление в мире. */
export const inputToWorld = (mx: number, my: number, camYaw: number): { x: number; z: number } => {
  // Камера смотрит вдоль camYaw; «вперёд» — от камеры, «вправо» — перпендикуляр.
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  // Правый вектор при взгляде вдоль +Z — это -X.
  const rx = -fz;
  const rz = fx;
  return { x: fx * my + rx * mx, z: fz * my + rz * mx };
};

export interface LocomotionOptions {
  camYaw: number;
  /** Скорость перемещения задаёт боевая система (атака/блок замедляют). */
  speedOverride?: number;
  /** Запрет поворота по вводу (во время удара). */
  lockTurn?: boolean;
  /** Принудительная скорость (шаг вперёд при ударе, отброс). */
  forced?: { x: number; z: number };
  /** Запрет рывка (во время броска, кат-сцены). */
  noDash?: boolean;
}

export class PlayerController {
  constructor(
    public s: PlayerState,
    private mover: Mover,
    private onDash: (pos: Vec3) => void = () => undefined,
  ) {}

  setAction(a: PlayerAction): void {
    if (this.s.action !== a) {
      this.s.action = a;
      this.s.actionTime = 0;
    }
  }

  /** Получить урон. Возвращает false, если урон поглощён неуязвимостью. */
  hurt(damage: number): boolean {
    const s = this.s;
    if (s.iframes > 0 || s.action === 'down') return false;
    s.hp = Math.max(0, s.hp - damage);
    s.timeSinceCombat = 0;
    if (s.hp <= 0) {
      this.setAction('down');
    } else if (damage >= 6) {
      s.hurtTimer = PLAYER.hurtStun;
      this.setAction('hurt');
    }
    return true;
  }

  update(dt: number, f: InputFrame, opt: LocomotionOptions): void {
    const s = this.s;
    copyVec(s.prevPos, s.pos);
    s.prevYaw = s.yaw;
    s.actionTime += dt;
    s.dashCooldown = Math.max(0, s.dashCooldown - dt);
    s.iframes = Math.max(0, s.iframes - dt);
    s.timeSinceCombat += dt;
    if (s.timeSinceCombat > 6 && s.hp > 0 && s.hp < s.maxHp) {
      s.hp = Math.min(s.maxHp, s.hp + PLAYER.regenOutOfCombat * dt);
    }

    const ctrl = s.controllable && s.action !== 'down';
    const wish = ctrl ? inputToWorld(f.mx, f.my, opt.camYaw) : { x: 0, z: 0 };
    const wishLen = Math.hypot(wish.x, wish.z);

    if (s.action === 'hurt') {
      s.hurtTimer -= dt;
      if (s.hurtTimer <= 0) this.setAction('idle');
    }

    // Рывок: начинается по нажатию, если не на перезарядке.
    if (
      ctrl &&
      s.dashEnabled &&
      !opt.noDash &&
      isPressed(f, 'dash') &&
      s.dashCooldown <= 0 &&
      s.action !== 'hurt' &&
      s.action !== 'cast' &&
      s.action !== 'throw'
    ) {
      const dir = wishLen > 0.1 ? { x: wish.x / wishLen, z: wish.z / wishLen } : { x: Math.sin(s.yaw), z: Math.cos(s.yaw) };
      s.dashDir = dir;
      s.dashTimer = PLAYER.dash.duration;
      s.dashCooldown = PLAYER.dash.cooldown;
      s.iframes = PLAYER.dash.iframes;
      this.setAction('dash');
      this.onDash(cloneVec(s.pos));
    }

    let targetVx = 0;
    let targetVz = 0;
    if (s.action === 'dash') {
      s.dashTimer -= dt;
      targetVx = s.dashDir.x * PLAYER.dash.speed;
      targetVz = s.dashDir.z * PLAYER.dash.speed;
      s.vel.x = targetVx;
      s.vel.z = targetVz;
      if (s.dashTimer <= 0) {
        this.setAction('idle');
        // После рывка сохраняем часть скорости, чтобы он ощущался плавно.
        s.vel.x *= 0.35;
        s.vel.z *= 0.35;
      }
    } else if (opt.forced) {
      s.vel.x = opt.forced.x;
      s.vel.z = opt.forced.z;
    } else {
      const speed = opt.speedOverride ?? PLAYER.runSpeed;
      const canMove = s.action !== 'hurt' && s.action !== 'down' && s.action !== 'cast';
      if (canMove && wishLen > 0.01) {
        targetVx = wish.x * speed;
        targetVz = wish.z * speed;
      }
      const rate = wishLen > 0.01 ? PLAYER.accel : PLAYER.decel;
      s.vel.x = approach(s.vel.x, targetVx, rate * dt);
      s.vel.z = approach(s.vel.z, targetVz, rate * dt);
      if (s.action === 'idle' || s.action === 'run') {
        this.setAction(wishLen > 0.01 ? 'run' : 'idle');
      }
    }

    // Поворот: к цели (захват) или по направлению движения.
    if (s.facingTarget && s.action !== 'dash') {
      s.yaw = dampAngle(s.yaw, yawTo(s.pos, s.facingTarget), PLAYER.turnRate, dt);
    } else if (!opt.lockTurn) {
      const vx = s.action === 'dash' ? s.dashDir.x : wish.x;
      const vz = s.action === 'dash' ? s.dashDir.z : wish.z;
      if (Math.hypot(vx, vz) > 0.05) {
        s.yaw = dampAngle(s.yaw, Math.atan2(vx, vz), PLAYER.turnRate, dt);
      }
    }

    // Гравитация.
    s.vel.y = s.grounded ? -2 : s.vel.y - PLAYER.gravity * dt;
    const res = this.mover.move(s.id, { x: s.vel.x * dt, y: s.vel.y * dt, z: s.vel.z * dt });
    s.pos.x += res.delta.x;
    s.pos.y += res.delta.y;
    s.pos.z += res.delta.z;
    s.grounded = res.grounded;
    if (s.pos.y < -20) {
      // Страховка от падения сквозь мир.
      s.pos.y = 1;
      this.mover.setPosition(s.id, s.pos);
    }
    s.groundSpeed = Math.hypot(res.delta.x, res.delta.z) / dt;
    s.stride += s.groundSpeed * dt;
  }

  /** Телепорт без интерполяции (смена точки, перезапуск). */
  teleport(pos: Vec3, yaw: number): void {
    const s = this.s;
    copyVec(s.pos, pos);
    copyVec(s.prevPos, pos);
    s.yaw = yaw;
    s.prevYaw = yaw;
    s.vel = vec3();
    this.mover.setPosition(s.id, pos);
  }
}

const approach = (v: number, target: number, step: number): number =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);
