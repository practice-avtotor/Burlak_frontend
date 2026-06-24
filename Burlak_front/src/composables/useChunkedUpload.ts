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

  // --- Вспомогательные функции ---

  const clearError = () => {
    error.value = null;
  };

  const handleApiError = (err: unknown): string => {
    console.error('API Error:', err);
    
    if (err instanceof ApiError) {
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

  // --- Создание задачи ---

  const ensureJob = async (): Promise<string> => {
    if (jobId.value) return jobId.value;
    
    const job = await createJob();
    jobId.value = job.id;
    console.log(`📋 Создана задача: ${jobId.value}`);
    return jobId.value;
  };

  // --- Загрузка одного чанка с retry ---

  const uploadSingleChunk = async (
    jobId: string,
    role: 'bom' | 'archive',
    chunkIndex: number,
    chunk: Blob,
    totalChunks: number
  ): Promise<void> => {
    if (chunk.size === 0) {
      console.warn(`⚠️ Чанк ${chunkIndex} пустой, пропускаем`);
      return;
    }

    let retries = 0;
    let success = false;
    
    while (!success && retries < 3) {
      try {
        await uploadChunk(jobId, role, chunkIndex, chunk, totalChunks);
        success = true;
      } catch (err) {
        retries++;
        console.warn(`⚠️ Повторная попытка ${retries}/3 для чанка ${chunkIndex}`);
        
        if (retries >= 3) throw err;
        
        const delay = 1000 * Math.pow(2, retries - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  // --- Загрузка всех чанков ---

  const uploadAllChunks = async (
    file: File,
    role: 'bom' | 'archive',
    jobId: string
  ): Promise<void> => {
    totalChunks.value = Math.ceil(file.size / CHUNK_SIZE);
    
    console.log(`📦 Файл: ${file.name} (${role})`);
    console.log(`📊 Размер: ${(file.size / 1024 / 1024).toFixed(2)} МБ`);
    console.log(`📊 Всего чанков: ${totalChunks.value}`);
    
    for (let i = 0; i < totalChunks.value; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      await uploadSingleChunk(jobId, role, i, chunk, totalChunks.value);
      
      uploadedChunks.value = i + 1;
      progress.value = ((i + 1) / totalChunks.value) * 100;
    }
    
    console.log(`✅ Все чанки ${role} загружены!`);
  };

  // --- Завершение загрузки файла ---

  const completeFileUpload = async (jobId: string, role: 'bom' | 'archive'): Promise<void> => {
    try {
      await completeUpload(jobId, role);
      console.log(`✅ Загрузка ${role} завершена`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        throw new Error(`Файл ${role} не содержит чанков. Проверьте файл.`);
      }
      if (err instanceof ApiError && err.code === 'FILE_UPLOAD_ERROR') {
        console.warn(`⚠️ Файл ${role} уже завершён, пропускаем`);
        return;
      }
      throw err;
    }
  };

  // --- Запуск обработки ---

  const startProcessingJob = async (jobId: string): Promise<void> => {
    try {
      await startProcessing(jobId);
      console.log('✅ Обработка запущена');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'JOB_ALREADY_COMPLETED') {
        console.warn('⚠️ Задача уже завершена');
        return;
      }
      throw err;
    }
  };

  // --- Опрос статуса ---

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
          
          if (status.processed && status.total) {
            progress.value = (status.processed / status.total) * 100;
          }
          
          if (status.status === 'done') {
            clearInterval(interval);
            progress.value = 100;
            resolve();
            return;
          }
          
          if (status.status === 'error') {
            clearInterval(interval);
            reject(new Error(status.error || 'Ошибка обработки на сервере'));
            return;
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            reject(new Error('Превышено время ожидания обработки (15 минут)'));
          }
          
        } catch (err) {
          console.error('Ошибка опроса статуса:', err);
        }
      }, 3000);
    });
  };

  // --- Скачивание результатов ---

  const downloadResult = async (type: 'diff' | 'cards'): Promise<void> => {
    if (!jobId.value) {
      throw new Error('Нет активной задачи');
    }
    
    if (jobStatus.value?.status !== 'done') {
      throw new Error('Результаты ещё не готовы');
    }
    
    const blob = type === 'diff' 
      ? await downloadDiff(jobId.value) 
      : await downloadCards(jobId.value);
    
    const url = URL.createObjectURL(blob);
    const filename = type === 'diff' 
      ? `diff_${jobId.value}.xlsx` 
      : `cards_${jobId.value}.zip`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Главная функция загрузки ---

  const uploadFile = async (file: File, role: 'bom' | 'archive') => {
    isUploading.value = true;
    progress.value = 0;
    error.value = null;
    currentRole.value = role;
    isComplete.value = false;
    
    try {
      const currentJobId = await ensureJob();
      
      await uploadAllChunks(file, role, currentJobId);
      await completeFileUpload(currentJobId, role);
      
      if (role === 'archive') {
        await startProcessingJob(currentJobId);
        await pollStatus(currentJobId);
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

  // --- Публичные методы ---

  const downloadDiffResult = () => downloadResult('diff');
  const downloadCardsResult = () => downloadResult('cards');

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