// Фон главного меню: керн-меч медленно вращается в холодном тумане.

import * as THREE from 'three';
import type { GameScene } from '../core/scene';
import type { InputFrame } from '../core/input';
import type { Renderer } from '../render/renderer';

export class MenuScene implements GameScene {
  readonly id = 'menu';
  private t = 0;
  private sword = new THREE.Group();
  private dust!: THREE.Points;
  private light!: THREE.PointLight;

  constructor(private renderer: Renderer) {}

  async load(): Promise<void> {
    const scene = this.renderer.scene;
    scene.background = new THREE.Color(0x04070c);
    scene.fog = new THREE.FogExp2(0x061019, 0.08);
    scene.add(new THREE.HemisphereLight(0x34506a, 0x060606, 0.8));
    this.light = new THREE.PointLight(0x7fd8ff, 30, 14, 1.5);
    this.light.position.set(1, 1.5, 2);
    scene.add(this.light);
    const stone = new THREE.MeshStandardMaterial({ color: 0x5c6066, roughness: 0.6, flatShading: true });
    const quartz = new THREE.MeshStandardMaterial({ color: 0xbfefff, emissive: 0x5fcfff, emissiveIntensity: 1.6, roughness: 0.2, flatShading: true });
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.6, 6), stone);
    hilt.position.y = -1.1;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.14), stone);
    guard.position.y = -0.78;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.05), quartz);
    blade.position.y = 0.35;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.35, 4), quartz);
    tip.position.y = 1.62;
    this.sword.add(hilt, guard, blade, tip);
    this.sword.position.set(1.6, 0.1, 0);
    this.sword.rotation.z = -0.25;
    scene.add(this.sword);
    const pts: number[] = [];
    for (let i = 0; i < 400; i++) pts.push((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 8);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fdfff, size: 0.03, transparent: true, opacity: 0.7 }));
    scene.add(this.dust);
    this.renderer.camera.position.set(0, 0.2, 5);
    this.renderer.camera.lookAt(0.6, 0.1, 0);
  }

  update(dt: number, _f: InputFrame): void {
    this.t += dt;
  }

  render(): void {
    this.sword.rotation.y = this.t * 0.4;
    this.sword.position.y = 0.1 + Math.sin(this.t * 0.8) * 0.08;
    this.dust.rotation.y = this.t * 0.03;
    this.light.intensity = 26 + Math.sin(this.t * 2.2) * 5;
    this.renderer.render();
  }

  dispose(): void {
    this.renderer.clearScene();
  }
}
