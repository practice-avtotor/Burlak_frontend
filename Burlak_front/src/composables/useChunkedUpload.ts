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
  type Job,
} from '@/lib/api';

const CHUNK_SIZE = 20 * 1024 * 1024; // 20 МБ (по документации)

export function useChunkedUpload() {
  const isUploading = ref(false);
  const progress = ref(0);
  const error = ref<string | null>(null);
  const jobId = ref<string | null>(null);
  const jobStatus = ref<Job | null>(null);
  
  const uploadedChunks = ref(0);
  const totalChunks = ref(0);
  const currentRole = ref<'bom' | 'archive'>('bom');

  const uploadFile = async (file: File, role: 'bom' | 'archive') => {
    isUploading.value = true;
    progress.value = 0;
    error.value = null;
    currentRole.value = role;
    
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
    
    try {
      // 2. Нарезка и загрузка чанков (строго по порядку!)
      for (let i = 0; i < totalChunks.value; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        if (chunk.size === 0) {
          console.warn(`⚠️ Чанк ${i} пустой, пропускаем`);
          continue;
        }
        
        console.log(`📤 Отправка чанка ${i + 1}/${totalChunks.value} (${chunk.size} байт)`);
        
        // ✅ Загрузка чанка с повтором (идемпотентность)
        let retries = 0;
        let success = false;
        while (!success && retries < 3) {
          try {
            await uploadChunk(jobId.value!, role, i, chunk, totalChunks.value);
            success = true;
          } catch (err) {
            retries++;
            console.warn(`⚠️ Повторная попытка ${retries}/3 для чанка ${i}`);
            if (retries >= 3) throw err;
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        }
        
        uploadedChunks.value = i + 1;
        progress.value = ((i + 1) / totalChunks.value) * 100;
      }
      
      console.log(`✅ Все чанки ${role} загружены!`);
      
      // 3. Завершаем загрузку файла
      await completeUpload(jobId.value!, role);
      console.log(`✅ Загрузка ${role} завершена`);
      
      // 4. Если это archive — запускаем обработку
      if (role === 'archive') {
        console.log('🔄 Запуск обработки...');
        await startProcessing(jobId.value!);
        console.log('✅ Обработка запущена');
        
        // 5. Опрашиваем статус
        await pollStatus(jobId.value!);
      }
      
    } catch (err) {
      error.value = (err as Error).message;
      console.error('❌ Ошибка:', err);
      throw err;
    } finally {
      isUploading.value = false;
    }
  };
  
  const pollStatus = async (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const status = await getJobStatus(id);
          jobStatus.value = status;
          console.log(`📊 Статус: ${status.status}, этап: ${status.stage}`);
          
          if (status.status === 'done') {
            clearInterval(interval);
            resolve();
          } else if (status.status === 'error') {
            clearInterval(interval);
            reject(new Error(status.error || 'Ошибка обработки'));
          }
        } catch (err) {
          console.error('Ошибка опроса:', err);
        }
      }, 3000);
    });
  };
  
  const downloadDiffResult = () => {
    if (jobId.value) downloadDiff(jobId.value);
  };
  
  const downloadCardsResult = () => {
    if (jobId.value) downloadCards(jobId.value);
  };
  
  const resetJob = () => {
    jobId.value = null;
    jobStatus.value = null;
    uploadedChunks.value = 0;
    totalChunks.value = 0;
    progress.value = 0;
    error.value = null;
  };
  
  return {
    uploadFile,
    isUploading,
    progress,
    error,
    jobId,
    jobStatus,
    uploadedChunks,
    totalChunks,
    currentRole,
    downloadDiffResult,
    downloadCardsResult,
    resetJob,
  };
}