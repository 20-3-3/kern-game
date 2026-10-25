// Тестовая площадка: пол, несколько стен и ящиков. Нужна для проверки контроллера.

import * as THREE from 'three';
import type { InputFrame } from '../core/input';
import { LevelScene } from './level-scene';
import { vec3 } from '../core/math';

export class SandboxScene extends LevelScene {
  readonly id = 'sandbox';

  protected buildWorld(): void {
    const scene = this.scene;
    scene.background = new THREE.Color(0x0a1018);
    scene.fog = new THREE.FogExp2(0x0a1018, 0.025);
    scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x1a1410, 0.9));
    const lamp = new THREE.PointLight(0xffc27a, 60, 40, 1.4);
    lamp.position.set(3, 6, 2);
    scene.add(lamp);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    this.physics.addBox(vec3(0, -0.5, 0), vec3(100, 0.5, 100));
    const mat = new THREE.MeshStandardMaterial({ color: 0x7a3b2e, roughness: 0.8, flatShading: true });
    const boxes: [number, number, number, number, number, number][] = [
      [8, 1.5, 0, 1, 1.5, 6],
      [-6, 0.5, 5, 1, 0.5, 1],
      [0, 2, -10, 10, 2, 1],
      [-4, 0.25, -3, 2, 0.25, 2],
    ];
    for (const [x, y, z, hx, hy, hz] of boxes) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), mat);
      m.position.set(x, y, z);
      scene.add(m);
      this.physics.addBox(vec3(x, y, z), vec3(hx, hy, hz));
    }
  }

  protected spawnPoint() {
    return { pos: vec3(0, 0.05, 4), yaw: Math.PI };
  }

  protected tick(dt: number, f: InputFrame): void {
    this.movePlayer(dt, f, null);
  }

  protected renderWorld(alpha: number, frameDt: number): void {
    this.playerView.update(this.player, alpha, frameDt);
  }
}
