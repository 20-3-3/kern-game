// Пустая сцена для проверки каркаса: пол, свет, камера.

import * as THREE from 'three';
import type { GameScene } from '../core/scene';
import type { InputFrame } from '../core/input';
import type { EventBus } from '../core/events';
import type { GameEvents } from '../core/game-events';
import type { Renderer } from '../render/renderer';

export class SandboxScene implements GameScene {
  readonly id = 'sandbox';
  private t = 0;
  private cube!: THREE.Mesh;

  constructor(
    private renderer: Renderer,
    _bus: EventBus<GameEvents>,
  ) {}

  async load(): Promise<void> {
    const scene = this.renderer.scene;
    scene.background = new THREE.Color(0x0a1018);
    scene.fog = new THREE.FogExp2(0x0a1018, 0.03);
    scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x1a1410, 0.8));
    const lamp = new THREE.PointLight(0xffc27a, 30, 30, 1.6);
    lamp.position.set(3, 6, 2);
    scene.add(lamp);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    this.cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x7fd8ff, emissive: 0x113344 }),
    );
    this.cube.position.y = 0.5;
    scene.add(this.cube);
    this.renderer.camera.position.set(0, 3, 7);
    this.renderer.camera.lookAt(0, 0.5, 0);
  }

  update(dt: number, _input: InputFrame): void {
    this.t += dt;
  }

  render(): void {
    this.cube.rotation.y = this.t;
    this.renderer.render();
  }

  dispose(): void {
    this.renderer.clearScene();
  }
}
