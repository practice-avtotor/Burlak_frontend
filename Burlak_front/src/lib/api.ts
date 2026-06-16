const API_BASE = 'http://localhost:8080/api'; // Замени на свой бэкенд

export const api = {
  // Загрузка чанка
  uploadChunk: async (chunk: Blob, index: number, fileName: string) => {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('index', index.toString());
    formData.append('fileName', fileName);
    
    const response = await fetch(`${API_BASE}/upload-chunk`, {
      method: 'POST',
      body: formData,
    });
    
    return response.json();
  },
  
  // Запуск обработки
  startProcessing: async (fileName: string) => {
    const response = await fetch(`${API_BASE}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    });
    
    return response.json();
  },
  
  // Получение статуса
  getStatus: async (processId: string) => {
    const response = await fetch(`${API_BASE}/status/${processId}`);
    return response.json();
  },
  
  // Скачивание результата
  downloadResult: async (taskId: string) => {
    window.open(`${API_BASE}/download/${taskId}`, '_blank');
  },
};