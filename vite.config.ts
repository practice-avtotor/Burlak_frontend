import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  
  // Настройка путей (алиас @)
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  
  // Настройка сервера
  server: {
    port: 3000,
    host: true,
    
    // Прокси для API (на будущее, когда появится бэкенд)
   // proxy: {
     // '/api': {
       // target: 'http://localhost:8080',   // Сюда будет обращаться бэкенд
        //changeOrigin: true,
        //secure: false,
      //},
    //},
  },
  
  // Настройка Web Workers
  worker: {
    format: 'es',
    plugins: () => [vue()],
  },
  
  // Настройка сборки
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});