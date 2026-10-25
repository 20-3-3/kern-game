// Простые эффекты: ударные волны, искры, вспышки. Пул мешей, без частиц-библиотек.

import * as THREE from 'three';

interface Ring {
  mesh: THREE.Mesh;
  t: number;
  dur: number;
  radius: number;
}

interface Spark {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  t: number;
  dur: number;
}

const ringGeo = new THREE.RingGeometry(0.85, 1, 48);
ringGeo.rotateX(-Math.PI / 2);
const sparkGeo = new THREE.OctahedronGeometry(0.06, 0);

export class Fx {
  readonly root = new THREE.Group();
  private rings: Ring[] = [];
  private sparks: Spark[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  ring(pos: { x: number; y?: number; z: number }, color: number, radius: number, dur = 0.6): void {
    const mesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    mesh.position.set(pos.x, (pos.y ?? 0) + 0.08, pos.z);
    mesh.scale.setScalar(0.1);
    this.root.add(mesh);
    this.rings.push({ mesh, t: 0, dur, radius });
  }

  burst(pos: { x: number; y: number; z: number }, color: number, count = 10, speed = 4): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
      mesh.position.set(pos.x, pos.y, pos.z);
      this.root.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.8 + 0.2;
      this.sparks.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(a) * speed * (0.4 + Math.random()), up * speed, Math.sin(a) * speed * (0.4 + Math.random())),
        t: 0,
        dur: 0.35 + Math.random() * 0.3,
      });
    }
  }

  update(dt: number): void {
    for (const r of [...this.rings]) {
      r.t += dt;
      const k = r.t / r.dur;
      r.mesh.scale.setScalar(0.1 + k * r.radius);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k));
      if (k >= 1) {
        this.root.remove(r.mesh);
        (r.mesh.material as THREE.Material).dispose();
        this.rings.splice(this.rings.indexOf(r), 1);
      }
    }
    for (const s of [...this.sparks]) {
      s.t += dt;
      s.vel.y -= 12 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      const k = s.t / s.dur;
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k);
      if (k >= 1) {
        this.root.remove(s.mesh);
        (s.mesh.material as THREE.Material).dispose();
        this.sparks.splice(this.sparks.indexOf(s), 1);
      }
    }
  }

  clear(): void {
    for (const r of this.rings) (r.mesh.material as THREE.Material).dispose();
    for (const s of this.sparks) (s.mesh.material as THREE.Material).dispose();
    this.rings = [];
    this.sparks = [];
    this.root.clear();
  }
}
