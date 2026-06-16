// src/composables/useChunkedUpload.ts
import { ref } from 'vue';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 МБ

export function useChunkedUpload() {
  const isUploading = ref(false);
  const progress = ref(0);
  const error = ref<string | null>(null);
  const uploadedChunks = ref(0);
  const totalChunks = ref(0);
  
  // 🔪 НАРЕЗКА ЧЕРЕЗ WEB WORKER
  const splitFileInWorker = (file: File): Promise<Blob[]> => {
    return new Promise((resolve, reject) => {
      try {
        const worker = new Worker(
          new URL('@/workers/chunker.worker.ts', import.meta.url),
          { type: 'module' }
        );
        
        worker.postMessage({ file, chunkSize: CHUNK_SIZE });
        
        worker.onmessage = (e) => {
          if (e.data.type === 'complete') {
            resolve(e.data.chunks);
            worker.terminate();
          }
          if (e.data.type === 'progress') {
            console.log(`🔄 Нарезка: ${Math.round(e.data.value)}%`);
          }
        };
        
        worker.onerror = (err) => {
          reject(err);
          worker.terminate();
        };
      } catch (err) {
        reject(err);
      }
    });
  };

  const uploadFile = async (file: File) => {
    isUploading.value = true;
    progress.value = 0;
    error.value = null;
    uploadedChunks.value = 0;
    
    totalChunks.value = Math.ceil(file.size / CHUNK_SIZE);
    
    console.log(`📦 Файл: ${file.name}`);
    console.log(`📊 Размер: ${(file.size / 1024 / 1024).toFixed(2)} МБ`);
    console.log(`📊 Всего чанков: ${totalChunks.value}`);
    
    try {
      // 1. Нарезка через Worker (в фоне)
      console.log('🔄 Нарезка файла на чанки...');
      const chunks = await splitFileInWorker(file);
      
      console.log(`✅ Нарезано ${chunks.length} чанков`);
      
      // 2. Загружаем каждый чанк
      for (let i = 0; i < chunks.length; i++) {
        // ПРОВЕРКА: убеждаемся, что чанк существует
        const chunk = chunks[i];
        if (!chunk) {
          throw new Error(`Чанк ${i} не существует`);
        }
        
        // ПРОВЕРКА: убеждаемся, что это Blob
        if (!(chunk instanceof Blob)) {
          throw new Error(`Чанк ${i} не является Blob`);
        }
        
        // ПРОВЕРКА: чанк не пустой
        if (chunk.size === 0) {
          console.warn(`⚠️ Чанк ${i} пустой, пропускаем`);
          continue;
        }
        
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', chunks.length.toString());
        formData.append('fileName', file.name);
        
        console.log(` Отправка чанка ${i + 1}/${chunks.length} (${chunk.size} байт)`);
        
        // Симуляция загрузки (без бэкенда)
        if (import.meta.env.DEV) {
          await new Promise(resolve => setTimeout(resolve, 150));
        } else {
          const response = await fetch('/api/upload-chunk', {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error(`Ошибка загрузки чанка ${i + 1}: ${response.status}`);
          }
        }
        
        // Обновляем прогресс
        uploadedChunks.value = i + 1;
        progress.value = ((i + 1) / chunks.length) * 100;
      }
      
      console.log('✅ Все чанки загружены!');
      
      // 3. Симуляция обработки
      if (import.meta.env.DEV) {
        console.log('🔄 Симуляция обработки на сервере...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log('🎉 Обработка завершена!');
      } else {
        const processResponse = await fetch('/api/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name }),
        });
        
        if (!processResponse.ok) {
          throw new Error(`Ошибка запуска обработки: ${processResponse.status}`);
        }
        
        const { processId } = await processResponse.json();
        console.log(`🔄 Обработка запущена (${processId})`);
        await pollStatus(processId);
      }
      
    } catch (err) {
      error.value = (err as Error).message;
      console.error('❌ Ошибка:', err);
      throw err;
    } finally {
      isUploading.value = false;
    }
  };
  
  // Опрос статуса (для реального бэкенда)
  const pollStatus = async (processId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/status/${processId}`);
          
          if (!response.ok) {
            if (response.status === 404) {
              console.log('⏳ Ожидание статуса...');
              return;
            }
            throw new Error(`Ошибка получения статуса: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`📊 Статус: ${data.status}`);
          
          if (data.status === 'completed') {
            clearInterval(interval);
            resolve();
          } else if (data.status === 'error') {
            clearInterval(interval);
            reject(new Error('Ошибка обработки на сервере'));
          }
        } catch (err) {
          console.error('Ошибка опроса:', err);
        }
      }, 2000);
    });
  };
  
  // Отмена загрузки
  const cancelUpload = () => {
    isUploading.value = false;
    error.value = 'Загрузка отменена';
    console.log('⏹ Загрузка отменена');
  };
  
  return {
    uploadFile,
    isUploading,
    progress,
    error,
    uploadedChunks,
    totalChunks,
    cancelUpload,
  };
}