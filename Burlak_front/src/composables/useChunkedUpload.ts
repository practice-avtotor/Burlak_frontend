// src/composables/useChunkedUpload.ts
import { ref } from 'vue';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 МБ

export function useChunkedUpload() {
  const isUploading = ref(false);
  const progress = ref(0);
  const error = ref<string | null>(null);
  
  // Загрузка файла
  const uploadFile = async (file: File) => {
    isUploading.value = true;
    progress.value = 0;
    error.value = null;
    
    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      console.log(`📦 Файл: ${file.name}, размер: ${file.size} байт, чанков: ${totalChunks}`);
      
      // Загружаем чанки
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        
        //  Создаём чанк через slice
        const chunk = file.slice(start, end);
        
        console.log(`📤 Чанк ${i + 1}/${totalChunks}: ${chunk.size} байт`);
        
        // Создаём FormData
        const formData = new FormData();
        
        //  ПРОСТОЙ СПОСОБ: добавляем чанк без имени файла
        formData.append('chunk', chunk);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileName', file.name);
        
        // Отправляем на сервер
        const response = await fetch('/api/upload-chunk', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Ошибка загрузки чанка ${i + 1}: ${response.status}`);
        }
        
        // Обновляем прогресс
        progress.value = ((i + 1) / totalChunks) * 100;
      }
      
      console.log('✅ Все чанки загружены!');
      
      // Запускаем обработку
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
      
      // Опрашиваем статус
      await pollStatus(processId);
      
      console.log('🎉 Готово!');
      
    } catch (err) {
      error.value = (err as Error).message;
      console.error('❌ Ошибка:', err);
      throw err;
    } finally {
      isUploading.value = false;
    }
  };
  
  // Опрос статуса
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
  
  return { 
    uploadFile, 
    isUploading, 
    progress, 
    error,
  };
}