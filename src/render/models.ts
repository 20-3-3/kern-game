// Единый загрузчик glTF. Если файла для модели нет, возвращает null —
// тогда вызывающий код строит заглушку из примитивов.

import type * as THREE from 'three';
import { MODELS } from '../data/models';

const cache = new Map<string, Promise<THREE.Object3D | null>>();

export const loadModel = (id: string): Promise<THREE.Object3D | null> => {
  const entry = MODELS[id];
  if (!entry?.url) return Promise.resolve(null);
  let p = cache.get(id);
  if (!p) {
    const url = `${import.meta.env.BASE_URL}${entry.url}`;
    p = import('three/examples/jsm/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(url))
      .then((gltf) => {
        if (entry.scale) gltf.scene.scale.setScalar(entry.scale);
        return gltf.scene;
      })
      .catch((err) => {
        console.warn(`Модель ${id} не загрузилась, используется заглушка`, err);
        return null;
      });
    cache.set(id, p);
  }
  return p.then((o) => (o ? o.clone(true) : null));
};
