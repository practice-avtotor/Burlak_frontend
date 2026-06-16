// Нарезка файла на чанки в фоновом потоке
self.onmessage = async (e: MessageEvent) => {
  const { file, chunkSize } = e.data;
  const chunks: Blob[] = [];
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    chunks.push(file.slice(start, end));
    
    // Отправляем прогресс
    self.postMessage({ 
      type: 'progress', 
      value: ((i + 1) / totalChunks) * 100 
    });
  }
  
  self.postMessage({ type: 'complete', chunks, totalChunks });
};