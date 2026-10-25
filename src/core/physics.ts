// Обёртка над Rapier. Логика видит только интерфейс Mover, поэтому в тестах
// Rapier можно заменить простой заглушкой.

import RAPIER from '@dimforge/rapier3d-compat';
import type { Vec3 } from './math';

export interface Mover {
  /** Сдвигает персонажа с учётом стен. Возвращает фактическое смещение и касание земли. */
  move(id: number, delta: Vec3): { delta: Vec3; grounded: boolean };
  setPosition(id: number, pos: Vec3): void;
}

/** Заглушка без коллизий (для тестов и логики без физики). */
export class FreeMover implements Mover {
  move(_id: number, delta: Vec3) {
    return { delta: { ...delta }, grounded: true };
  }
  setPosition(): void {}
}

let rapierReady: Promise<void> | null = null;
export const initRapier = (): Promise<void> => {
  rapierReady ??= RAPIER.init();
  return rapierReady;
};

interface Character {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  pos: Vec3;
}

export class Physics implements Mover {
  readonly world: RAPIER.World;
  private controller: RAPIER.KinematicCharacterController;
  private chars = new Map<number, Character>();
  private nextId = 1;
  private statics: RAPIER.Collider[] = [];

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.controller = this.world.createCharacterController(0.02);
    this.controller.setSlideEnabled(true);
    this.controller.enableAutostep(0.35, 0.2, false);
    this.controller.enableSnapToGround(0.3);
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
  }

  /** Статичный ящик. rotY — поворот вокруг вертикали. */
  addBox(center: Vec3, half: Vec3, rotY = 0): void {
    const desc = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setTranslation(center.x, center.y, center.z);
    if (rotY) desc.setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) });
    this.statics.push(this.world.createCollider(desc));
  }

  addCylinder(center: Vec3, halfHeight: number, radius: number): void {
    const desc = RAPIER.ColliderDesc.cylinder(halfHeight, radius).setTranslation(center.x, center.y, center.z);
    this.statics.push(this.world.createCollider(desc));
  }

  /** Создаёт персонажа-капсулу; pos — точка у ног. */
  addCharacter(pos: Vec3, radius: number, height: number): number {
    const halfHeight = Math.max(0.05, height / 2 - radius);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y + height / 2, pos.z),
    );
    const collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(halfHeight, radius), body);
    const id = this.nextId++;
    this.chars.set(id, { body, collider, pos: { ...pos } });
    return id;
  }

  removeCharacter(id: number): void {
    const c = this.chars.get(id);
    if (!c) return;
    this.world.removeRigidBody(c.body);
    this.chars.delete(id);
  }

  move(id: number, delta: Vec3) {
    const c = this.chars.get(id);
    if (!c) return { delta: { ...delta }, grounded: true };
    this.controller.computeColliderMovement(c.collider, delta);
    const m = this.controller.computedMovement();
    const t = c.body.translation();
    const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z };
    c.body.setTranslation(next, true);
    c.body.setNextKinematicTranslation(next);
    return { delta: { x: m.x, y: m.y, z: m.z }, grounded: this.controller.computedGrounded() };
  }

  setPosition(id: number, pos: Vec3): void {
    const c = this.chars.get(id);
    if (!c) return;
    const h = this.halfHeightOf(c);
    c.body.setTranslation({ x: pos.x, y: pos.y + h, z: pos.z }, true);
  }

  private halfHeightOf(c: Character): number {
    const shape = c.collider.shape as RAPIER.Capsule;
    return shape.halfHeight + shape.radius;
  }

  /** Луч для камеры: расстояние до первой статичной стены или maxDist. */
  castRay(origin: Vec3, dir: Vec3, maxDist: number): number {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRay(ray, maxDist, true, undefined, undefined, undefined, undefined, (col) =>
      col.parent() === null,
    );
    return hit ? hit.timeOfImpact : maxDist;
  }

  /** Обновляет структуры запросов после перемещений. Вызывать раз за шаг логики. */
  step(): void {
    this.world.step();
  }

  dispose(): void {
    this.world.free();
    this.chars.clear();
    this.statics = [];
  }
}
