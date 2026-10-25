// Базовая игровая сцена: физика, Лёва, камера. Уровни и главы наследуют её
// и добавляют своё окружение, врагов и сюжет.

import * as THREE from 'three';
import type { GameScene } from '../core/scene';
import type { InputFrame } from '../core/input';
import type { GameContext } from '../core/context';
import { Physics } from '../core/physics';
import { createPlayerState, PlayerController, type LocomotionOptions, type PlayerState } from '../player/controller';
import { PlayerView } from '../player/view';
import { CameraRig } from '../player/camera';
import { PLAYER, CAMERA } from '../data/balance';
import { lerp, vec3, type Vec3 } from '../core/math';

export abstract class LevelScene implements GameScene {
  abstract readonly id: string;
  physics!: Physics;
  player!: PlayerState;
  controller!: PlayerController;
  playerView!: PlayerView;
  cam!: CameraRig;
  time = 0;
  /** Камера в кат-сцене: если задана, игровая камера не используется. */
  cutCam: { pos: Vec3; look: Vec3 } | null = null;
  private cutCamCur: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;

  constructor(readonly ctx: GameContext) {}

  get scene(): THREE.Scene {
    return this.ctx.renderer.scene;
  }

  /** Построить окружение (геометрия и коллайдеры). */
  protected abstract buildWorld(): Promise<void> | void;
  /** Логика уровня на одном шаге. */
  protected abstract tick(dt: number, f: InputFrame): void;
  protected abstract spawnPoint(): { pos: Vec3; yaw: number };

  async load(): Promise<void> {
    this.physics = new Physics();
    await this.buildWorld();
    const sp = this.spawnPoint();
    const id = this.physics.addCharacter(sp.pos, PLAYER.radius, PLAYER.height);
    this.player = createPlayerState(id, sp.pos, sp.yaw);
    this.controller = new PlayerController(this.player, this.physics, (pos) => this.ctx.bus.emit('dash', { pos }));
    this.playerView = new PlayerView(this.scene);
    this.cam = new CameraRig(this.ctx.settings.mouseSensitivity);
    this.cam.yaw = sp.yaw;
    this.ctx.renderer.camera.fov = CAMERA.fov;
    this.ctx.renderer.camera.updateProjectionMatrix();
    this.physics.step();
  }

  update(dt: number, f: InputFrame): void {
    this.time += dt;
    this.cam.sensitivity = this.ctx.settings.mouseSensitivity;
    this.cam.invertY = this.ctx.settings.invertY;
    this.tick(dt, f);
    // Сцену могли сменить прямо из tick (переход в следующую главу/сцену).
    if (this.disposed) return;
    this.physics.step();
  }

  /** Стандартное движение игрока (уровни могут вызывать со своими опциями). */
  movePlayer(dt: number, f: InputFrame, lockTarget: Vec3 | null, opt: Omit<LocomotionOptions, 'camYaw'> = {}): void {
    this.controller.update(dt, f, { camYaw: this.cam.yaw, ...opt });
    this.cam.update(dt, f.lookX, f.lookY, this.player.pos, lockTarget);
  }

  interpPlayer(alpha: number): Vec3 {
    const s = this.player;
    return vec3(lerp(s.prevPos.x, s.pos.x, alpha), lerp(s.prevPos.y, s.pos.y, alpha), lerp(s.prevPos.z, s.pos.z, alpha));
  }

  /** Плавный переход к камере кат-сцены и обратно. */
  protected applyCamera(alpha: number, frameDt: number): void {
    const camera = this.ctx.renderer.camera;
    if (this.cutCam) {
      const target = { pos: new THREE.Vector3(this.cutCam.pos.x, this.cutCam.pos.y, this.cutCam.pos.z), look: new THREE.Vector3(this.cutCam.look.x, this.cutCam.look.y, this.cutCam.look.z) };
      if (!this.cutCamCur) this.cutCamCur = { pos: camera.position.clone(), look: target.look.clone() };
      const k = 1 - Math.exp(-3 * frameDt);
      this.cutCamCur.pos.lerp(target.pos, k);
      this.cutCamCur.look.lerp(target.look, k);
      camera.position.copy(this.cutCamCur.pos);
      camera.lookAt(this.cutCamCur.look);
      this.ctx.audio.setListener(camera.position.x, camera.position.z, Math.atan2(this.cutCamCur.look.x - camera.position.x, this.cutCamCur.look.z - camera.position.z));
      return;
    }
    this.cutCamCur = null;
    const pose = this.cam.pose(this.interpPlayer(alpha), frameDt, (o, d, m) => this.physics.castRay(o, d, m));
    camera.position.set(pose.pos.x, pose.pos.y, pose.pos.z);
    camera.lookAt(pose.look.x, pose.look.y, pose.look.z);
    this.ctx.audio.setListener(pose.look.x, pose.look.z, this.cam.yaw);
  }

  /** Сколько кадров не перерисовывать («перескок» кадра при заедании). */
  skipFrames = 0;

  render(alpha: number, frameDt: number): void {
    if (this.skipFrames > 0) {
      this.skipFrames--;
      return;
    }
    this.renderWorld(alpha, frameDt);
    this.applyCamera(alpha, frameDt);
    this.ctx.renderer.render();
  }

  /** Обновить визуал уровня (враги, эффекты, игрок). */
  protected abstract renderWorld(alpha: number, frameDt: number): void;

  /** Отладка: перенести Лёву в точку. */
  debugTeleport(x: number, z: number, yaw = Math.PI): void {
    this.controller.teleport(vec3(x, 0.05, z), yaw);
    this.cam.yaw = yaw;
  }

  private disposed = false;

  dispose(): void {
    this.disposed = true;
    this.ctx.renderer.clearScene();
    this.physics?.dispose();
  }
}
