<template>
  <div class="uploader">
    <h1>📁 Добро пожаловать в Burlak</h1>
    <p class="subtitle">Загрузите свой файл</p>

    <!-- Зона загрузки -->
    <div 
      class="dropzone"
      @dragenter="isDragging = true"
      @dragleave="isDragging = false"
      @dragover.prevent
      @drop.prevent="handleDrop"
      :class="{ dragging: isDragging }"
    >
      <div class="dropzone-content">
        <span class="icon">📂</span>
        <p>Перетащите файлы сюда</p>
        <button @click="selectFile" class="btn">Выбрать файл</button>
        <input type="file" ref="fileInput" @change="handleFileSelect" style="display: none">
      </div>
    </div>

    <!-- Список файлов -->
    <div v-if="files.length > 0" class="files-list">
      <div v-for="file in files" :key="file.id" class="file-item">
        <div class="file-info">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ formatSize(file.size) }}</span>
          <span class="status" :class="file.status">{{ file.statusText }}</span>
        </div>
        
        <div v-if="file.status === 'uploading'" class="progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: file.progress + '%' }"></div>
          </div>
          <span class="progress-text">{{ Math.round(file.progress) }}%</span>
        </div>
        
        <div v-if="file.status === 'error'" class="error">
          {{ file.error }}
        </div>

        <div v-if="file.status === 'done'" class="file-actions">
          <button class="btn btn-download" @click="downloadResult(file.id)">📥 Скачать результат</button>
          <button class="btn btn-remove" @click="removeFile(file.id)">🗑 Удалить</button>
        </div>
      </div>
    </div>

    <div v-else class="empty">
      ✨ Нет активных загрузок
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useChunkedUpload } from '@/composables/useChunkedUpload';

// Подключаем хук загрузки
const { uploadFile, isUploading, progress } = useChunkedUpload();

// Локальное состояние
const files = ref<Array<{
  id: string | number;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  statusText: string;
  progress: number;
  error?: string;
}>>([]);

const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

// Форматирование размера
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Открыть выбор файлов
const selectFile = () => {
  fileInput.value?.click();
};

// Обработка выбора файлов
const handleFileSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const selectedFiles = Array.from(target.files || []);
  
  for (const file of selectedFiles) {
    await uploadFileHandler(file);
  }
  
  target.value = '';
};

// Обработка Drop
const handleDrop = async (e: DragEvent) => {
  isDragging.value = false;
  const droppedFiles = Array.from(e.dataTransfer?.files || []);
  
  for (const file of droppedFiles) {
    await uploadFileHandler(file);
  }
};

// Загрузка файла
const uploadFileHandler = async (file: File) => {
  const id = Date.now() + Math.random();
  const newFile = {
    id,
    name: file.name,
    size: file.size,
    status: 'uploading' as const,
    statusText: 'Загрузка...',
    progress: 0,
  };
  
  files.value.push(newFile);
  
  try {
    // Реальная загрузка с чанками
    await uploadFile(file);
    
    const item = files.value.find(f => f.id === id);
    if (item) {
      item.status = 'done';
      item.statusText = 'Готово ✅';
      item.progress = 100;
    }
  } catch (err) {
    const item = files.value.find(f => f.id === id);
    if (item) {
      item.status = 'error';
      item.statusText = 'Ошибка ❌';
      item.error = (err as Error).message;
    }
  }
};

// Скачивание результата
const downloadResult = (id: string | number) => {
  window.open(`/api/download/${id}`, '_blank');
};

// Удаление файла
const removeFile = (id: string | number) => {
  files.value = files.value.filter(f => f.id !== id);
};
</script>

<style scoped>
.uploader {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  font-family: system-ui, -apple-system, sans-serif;
}

h1 {
  text-align: center;
  color: #4f46e5;
  margin-bottom: 8px;
}

.subtitle {
  text-align: center;
  color: #6b7280;
  margin-bottom: 32px;
}

.dropzone {
  border: 2px dashed #cbd5e1;
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #f8fafc;
}

.dropzone:hover {
  border-color: #4f46e5;
  background: #f1f5f9;
}

.dropzone.dragging {
  border-color: #4f46e5;
  background: #eef2ff;
  transform: scale(1.01);
}

.dropzone-content {
  pointer-events: none;
}

.icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.btn {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 12px;
  pointer-events: auto;
  transition: background 0.2s;
}

.btn:hover {
  background: #4338ca;
}

.btn-download {
  background: #10b981;
  font-size: 12px;
  padding: 4px 12px;
  margin-top: 0;
}

.btn-download:hover {
  background: #059669;
}

.btn-remove {
  background: #ef4444;
  font-size: 12px;
  padding: 4px 12px;
  margin-top: 0;
}

.btn-remove:hover {
  background: #dc2626;
}

.files-list {
  margin-top: 24px;
}

.file-item {
  background: #f8fafc;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 12px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.file-name {
  flex: 1;
  font-weight: 500;
  color: #1e293b;
  word-break: break-all;
}

.file-size {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
}

.status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 20px;
  white-space: nowrap;
}

.status.uploading {
  background: #dbeafe;
  color: #3b82f6;
}

.status.done {
  background: #d1fae5;
  color: #10b981;
}

.status.error {
  background: #fee2e2;
  color: #ef4444;
}

.progress {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4f46e5;
  transition: width 0.3s;
  border-radius: 3px;
}

.progress-text {
  font-size: 12px;
  color: #64748b;
  min-width: 36px;
  text-align: right;
}

.error {
  margin-top: 8px;
  font-size: 12px;
  color: #ef4444;
}

.file-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}

.empty {
  text-align: center;
  padding: 48px;
  color: #94a3b8;
}
</style>