// Пролог «Ваш заказ у двери»: ночная Тула, проспект Ленина и площадь у кремля.

import * as THREE from 'three';
import type { InputFrame } from '../../core/input';
import { LevelScene } from '../level-scene';
import { vec3 } from '../../core/math';
import { MAP } from '../../data/levels/prologue-map';
import { buildCity, type City } from './city';

export class PrologueScene extends LevelScene {
  readonly id = 'prologue';
  private city!: City;
  private focus = new THREE.Vector3();

  protected buildWorld(): void {
    this.city = buildCity(this.scene, this.physics);
  }

  protected spawnPoint() {
    return { pos: vec3(4, 0.05, MAP.startZ - 4), yaw: Math.PI };
  }

  protected tick(dt: number, f: InputFrame): void {
    this.movePlayer(dt, f, null);
  }

  protected renderWorld(alpha: number, frameDt: number): void {
    this.playerView.update(this.player, alpha, frameDt);
    const p = this.interpPlayer(alpha);
    this.focus.set(p.x, p.y, p.z);
    this.city.update(this.focus, this.time);
  }
}
