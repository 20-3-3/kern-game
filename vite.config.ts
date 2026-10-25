/// <reference types="vitest" />
import { defineConfig } from 'vite';

// base должен совпадать с именем репозитория, иначе на GitHub Pages ассеты не найдутся.
export default defineConfig({
  base: '/kern-game/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4096,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
