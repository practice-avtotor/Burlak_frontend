// src/workers/chunker.worker.ts

/**
 * Web Worker для нарезки файла на чанки
 * Работает в фоновом потоке, чтобы не блокировать интерфейс
 */

self.onmessage = async (e: MessageEvent) => {
  const { file, chunkSize } = e.data;
  
  try {
    const chunks: Blob[] = [];
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    console.log(`🔄 Worker: нарезка ${file.name} на ${totalChunks} чанков`);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      
      // Создаём чанк
      const chunk = file.slice(start, end);
      
      // Проверяем, что чанк не пустой
      if (chunk.size === 0) {
        console.warn(`⚠️ Worker: чанк ${i} пустой, пропускаем`);
        continue;
      }
      
      chunks.push(chunk);
      
      // Отправляем прогресс нарезки (каждый 5-й чанк)
      if (i % 5 === 0 || i === totalChunks - 1) {
        self.postMessage({
          type: 'progress',
          value: ((i + 1) / totalChunks) * 100,
        });
      }
    }
    
    console.log(`✅ Worker: нарезка завершена, создано ${chunks.length} чанков`);
    
    self.postMessage({
      type: 'complete',
      chunks,
      totalChunks: chunks.length,
    });
    
  } catch (error) {
    console.error('❌ Worker: ошибка нарезки:', error);
    self.postMessage({
      type: 'error',
      error: (error as Error).message,
    });
  }
};