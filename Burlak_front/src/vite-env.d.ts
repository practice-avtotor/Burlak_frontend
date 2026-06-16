// src/vite-env.d.ts

/// <reference types="vite/client" />

// Объявление типов для Vue-компонентов
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// Объявление типов для Web Workers
declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}