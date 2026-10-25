// Рендер на Three.js. Только отображение: никакой игровой логики здесь нет.

import * as THREE from 'three';

export class Renderer {
  readonly three: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  /** Множитель разрешения: на слабых машинах его можно уменьшить. */
  private pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

  constructor(readonly canvas: HTMLCanvasElement) {
    this.three = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.three.outputColorSpace = THREE.SRGBColorSpace;
    this.three.toneMapping = THREE.ACESFilmicToneMapping;
    this.three.toneMappingExposure = 1.1;
    this.three.shadowMap.enabled = false;
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.three.setPixelRatio(this.pixelRatio);
    this.three.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setQuality(ratio: number): void {
    this.pixelRatio = ratio;
    this.resize();
  }

  render(): void {
    this.three.render(this.scene, this.camera);
  }

  /** Полностью очищает сцену и освобождает GPU-ресурсы. */
  clearScene(): void {
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    this.scene.clear();
    this.scene.fog = null;
    this.scene.background = null;
  }
}
