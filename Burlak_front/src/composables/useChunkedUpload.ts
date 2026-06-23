// src/composables/useChunkedUpload.ts
import { ref } from 'vue';
import {
  createJob,
  uploadChunk,
  completeUpload,
  startProcessing,
  getJobStatus,
  downloadDiff,
  downloadCards,
  ApiError,
  type Job,
} from '@/lib/api';

const CHUNK_SIZE = 20 * 1024 * 1024; // 20 МБ

export interface UploadError {
  code: string;
  message: string;
  status?: number;
  details?: Record<string, any>;
}

export function useChunkedUpload() {
  const isUploading = ref(false);
  const progress = ref(0);
  const error = ref<string | null>(null);
  const jobId = ref<string | null>(null);
  const jobStatus = ref<Job | null>(null);
  
  const uploadedChunks = ref(0);
  const totalChunks = ref(0);
  const currentRole = ref<'bom' | 'archive'>('bom');
  const isComplete = ref(false);

  // Сброс ошибки
  const clearError = () => {
    error.value = null;
  };

  // Обработка ошибок API
  const handleApiError = (err: unknown): string => {
    console.error('API Error:', err);
    
    if (err instanceof ApiError) {
      // Специфичные коды ошибок
      switch (err.code) {
        case 'NETWORK_ERROR':
          return 'Ошибка сети. Проверьте подключение к интернету.';
        case 'ABORTED':
          return 'Загрузка отменена пользователем';
        case 'FILE_UPLOAD_ERROR':
          return `Ошибка загрузки файла: ${err.message}`;
        case 'FILE_NOT_FOUND':
          return 'Файл не найден на сервере';
        case 'INVALID_CHUNK':
          return `Неверный чанк: ${err.message}`;
        case 'CHUNK_ORDER_ERROR':
          return 'Нарушен порядок отправки чанков. Попробуйте заново.';
        case 'JOB_NOT_FOUND':
          return 'Задача не найдена. Возможно, сессия истекла.';
        case 'JOB_ALREADY_COMPLETED':
          return 'Эта задача уже завершена';
        case 'PROCESSING_ERROR':
          return `Ошибка обработки: ${err.message}`;
        case 'VALIDATION_ERROR':
          return `Ошибка валидации: ${err.message}`;
        default:
          return err.message || 'Произошла ошибка на сервере';
      }
    }
    
    if (err instanceof Error) {
      // Ошибки сети
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        return 'Ошибка сети. Проверьте подключение к интернету.';
      }
      if (err.message.includes('abort')) {
        return 'Загрузка отменена пользователем';
      }
      if (err.message.includes('timeout')) {
        return 'Превышено время ожидания ответа от сервера';
      }
      return err.message || 'Произошла неизвестная ошибка';
    }
    
    return 'Произошла неизвестная ошибка';
  };

  const uploadFile = async (file: File, role: 'bom' | 'archive') => {
    isUploading.value = true;
    progress.value = 0;
    error.value = null;
    currentRole.value = role;
    isComplete.value = false;
    
    try {
      // 1. Создаём задачу
      if (!jobId.value) {
        const job = await createJob();
        jobId.value = job.id;
        console.log(`📋 Создана задача: ${jobId.value}`);
      }
      
      totalChunks.value = Math.ceil(file.size / CHUNK_SIZE);
      console.log(`📦 Файл: ${file.name} (${role})`);
      console.log(`📊 Размер: ${(file.size / 1024 / 1024).toFixed(2)} МБ`);
      console.log(`📊 Всего чанков: ${totalChunks.value}`);
      
      // 2. Загружаем чанки (строго по порядку)
      for (let i = 0; i < totalChunks.value; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        if (chunk.size === 0) {
          console.warn(`⚠️ Чанк ${i} пустой, пропускаем`);
          continue;
        }
        
        console.log(`📤 Отправка чанка ${i + 1}/${totalChunks.value} (${chunk.size} байт)`);
        
        // Retry-логика (идемпотентность)
        let retries = 0;
        let success = false;
        let lastError: Error | null = null;
        
        while (!success && retries < 3) {
          try {
            await uploadChunk(
              jobId.value!,
              role,
              i,
              chunk,
              totalChunks.value
            );
            success = true;
          } catch (err) {
            lastError = err as Error;
            retries++;
            console.warn(`⚠️ Повторная попытка ${retries}/3 для чанка ${i}`);
            
            if (retries >= 3) {
              throw err;
            }
            
            // Экспоненциальная задержка: 1с, 2с, 4с
            const delay = 1000 * Math.pow(2, retries - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        uploadedChunks.value = i + 1;
        progress.value = ((i + 1) / totalChunks.value) * 100;
      }
      
      console.log(`✅ Все чанки ${role} загружены!`);
      
      // 3. Завершаем загрузку файла
      try {
        await completeUpload(jobId.value!, role);
        console.log(`✅ Загрузка ${role} завершена`);
      } catch (err) {
        // Обработка 422: "No chunks found"
        if (err instanceof ApiError && err.status === 422) {
          throw new Error(`Файл ${role} не содержит чанков. Проверьте файл.`);
        }
        if (err instanceof ApiError && err.code === 'FILE_UPLOAD_ERROR') {
          console.warn(`⚠️ Файл ${role} уже завершён, пропускаем`);
        } else {
          throw err;
        }
      }
      
      // 4. Если это archive — запускаем обработку
      if (role === 'archive') {
        console.log('🔄 Запуск обработки...');
        try {
          await startProcessing(jobId.value!);
          console.log('✅ Обработка запущена');
        } catch (err) {
          if (err instanceof ApiError && err.code === 'JOB_ALREADY_COMPLETED') {
            console.warn('⚠️ Задача уже завершена');
          } else {
            throw err;
          }
        }
        
        // 5. Опрашиваем статус
        await pollStatus(jobId.value!);
      }
      
      isComplete.value = true;
      
    } catch (err) {
      const userMessage = handleApiError(err);
      error.value = userMessage;
      console.error('❌ Ошибка:', userMessage);
      throw new Error(userMessage);
    } finally {
      isUploading.value = false;
    }
  };
  
  const pollStatus = async (id: string): Promise<void> => {
    let attempts = 0;
    const maxAttempts = 300; // 300 * 3с = 15 минут
    
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        attempts++;
        
        try {
          const status = await getJobStatus(id);
          jobStatus.value = status;
          
          console.log(`📊 Статус: ${status.status}, этап: ${status.stage} (${attempts}/${maxAttempts})`);
          
          // Обновляем прогресс обработки
          if (status.processed && status.total) {
            progress.value = (status.processed / status.total) * 100;
          }
          
          if (status.status === 'done') {
            clearInterval(interval);
            progress.value = 100;
            resolve();
          } else if (status.status === 'error') {
            clearInterval(interval);
            reject(new Error(status.error || 'Ошибка обработки на сервере'));
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            reject(new Error('Превышено время ожидания обработки (15 минут)'));
          }
          
        } catch (err) {
          // При ошибке опроса не прерываем, продолжаем
          console.error('Ошибка опроса статуса:', err);
        }
      }, 3000);
    });
  };
  
  const downloadDiffResult = async (): Promise<void> => {
    if (!jobId.value) {
      throw new Error('Нет активной задачи');
    }
    
    if (jobStatus.value?.status !== 'done') {
      throw new Error('Результаты ещё не готовы');
    }
    
    try {
      const blob = await downloadDiff(jobId.value);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diff_${jobId.value}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const userMessage = handleApiError(err);
      error.value = userMessage;
      throw new Error(userMessage);
    }
  };
  
  const downloadCardsResult = async (): Promise<void> => {
    if (!jobId.value) {
      throw new Error('Нет активной задачи');
    }
    
    if (jobStatus.value?.status !== 'done') {
      throw new Error('Результаты ещё не готовы');
    }
    
    try {
      const blob = await downloadCards(jobId.value);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cards_${jobId.value}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const userMessage = handleApiError(err);
      error.value = userMessage;
      throw new Error(userMessage);
    }
  };
  
  const resetJob = () => {
    jobId.value = null;
    jobStatus.value = null;
    uploadedChunks.value = 0;
    totalChunks.value = 0;
    progress.value = 0;
    error.value = null;
    isComplete.value = false;
  };
  
  return {
    uploadFile,
    isUploading,
    progress,
    error,
    clearError,
    jobId,
    jobStatus,
    uploadedChunks,
    totalChunks,
    currentRole,
    isComplete,
    downloadDiffResult,
    downloadCardsResult,
    resetJob,
  };
}