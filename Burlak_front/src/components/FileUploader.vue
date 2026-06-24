<template>
  <div class="uploader">
    <h1>📁 Burlak</h1>
    <p class="subtitle">Загрузка BOM-файла и архива с картами</p>

    <!-- Статус задачи -->
    <div v-if="jobId" class="job-status">
      <span class="job-id">📋 Задача: {{ jobId }}</span>
      <span class="job-stage" v-if="jobStatus">
        {{ jobStatus.stage }}
      </span>
    </div>

    <!-- Зона загрузки BOM -->
    <div 
      class="dropzone"
      :class="{ dragging: isDraggingBom }"
      @dragenter="isDraggingBom = true"
      @dragleave="isDraggingBom = false"
      @dragover.prevent
      @drop.prevent="(e) => handleDrop(e, 'bom')"
    >
      <div class="dropzone-content">
        <span class="icon">📊</span>
        <p>Загрузите BOM-файл (XLSX)</p>
        <button 
          @click="() => selectFile('bom')" 
          class="btn" 
          :disabled="isUploading && currentRole === 'bom'"
        >
          {{ isUploading && currentRole === 'bom' ? 'Загрузка...' : 'Выбрать BOM' }}
        </button>
        <input 
          type="file" 
          ref="bomInput" 
          accept=".xlsx" 
          @change="(e) => handleFileSelect(e, 'bom')" 
          style="display: none"
        >
      </div>
      <div v-if="bomFile" class="selected-file">
        ✅ {{ bomFile.name }} ({{ formatSize(bomFile.size) }})
      </div>
    </div>

    <!-- Зона загрузки Archive -->
    <div 
      class="dropzone"
      :class="{ dragging: isDraggingArchive }"
      @dragenter="isDraggingArchive = true"
      @dragleave="isDraggingArchive = false"
      @dragover.prevent
      @drop.prevent="(e) => handleDrop(e, 'archive')"
    >
      <div class="dropzone-content">
        <span class="icon">📦</span>
        <p>Загрузите архив с картами (ZIP)</p>
        <button 
          @click="() => selectFile('archive')" 
          class="btn" 
          :disabled="isUploading && currentRole === 'archive'"
        >
          {{ isUploading && currentRole === 'archive' ? 'Загрузка...' : 'Выбрать архив' }}
        </button>
        <input 
          type="file" 
          ref="archiveInput" 
          accept=".zip" 
          @change="(e) => handleFileSelect(e, 'archive')" 
          style="display: none"
        >
      </div>
      <div v-if="archiveFile" class="selected-file">
        ✅ {{ archiveFile.name }} ({{ formatSize(archiveFile.size) }})
      </div>
    </div>

    <!-- Прогресс загрузки -->
    <div v-if="isUploading" class="uploading-status">
      <div class="progress-info">
        <span class="progress-label">⬆ {{ currentRole === 'bom' ? 'BOM' : 'Архив' }}</span>
        <span class="progress-percent">{{ Math.round(progress) }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <div v-if="totalChunks > 0" class="chunks-info">
        📦 Чанк {{ uploadedChunks }} из {{ totalChunks }}
      </div>
    </div>

    <!-- Отображение ошибки -->
    <div v-if="error" class="error-message">
      <div class="error-content">
        <span class="error-icon">❌</span>
        <span class="error-text">{{ error }}</span>
        <button class="error-close" @click="clearError">×</button>
      </div>
    </div>

    <!-- Скачивание результатов -->
    <div v-if="jobStatus?.status === 'done'" class="download-section">
      <h3>📥 Результаты готовы</h3>
      <div class="download-buttons">
        <button class="btn btn-download" @click="() => handleDownload('diff')">
          📊 Скачать diff.xlsx
        </button>
        <button class="btn btn-download" @click="() => handleDownload('cards')">
          📦 Скачать translated_cards.zip
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useChunkedUpload } from '@/composables/useChunkedUpload';

const {
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
  downloadDiffResult,
  downloadCardsResult,
} = useChunkedUpload();

// Состояние файлов
const bomFile = ref<File | null>(null);
const archiveFile = ref<File | null>(null);
const isDraggingBom = ref(false);
const isDraggingArchive = ref(false);
const bomInput = ref<HTMLInputElement | null>(null);
const archiveInput = ref<HTMLInputElement | null>(null);

// --- Утилиты ---

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// --- Единая функция выбора файла ---

const selectFile = (role: 'bom' | 'archive') => {
  if (role === 'bom') {
    bomInput.value?.click();
  } else {
    archiveInput.value?.click();
  }
};

// --- Единая функция выбора файла через input ---

const handleFileSelect = async (e: Event, role: 'bom' | 'archive') => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  // Сохраняем файл в соответствующее состояние
  if (role === 'bom') {
    bomFile.value = file;
  } else {
    archiveFile.value = file;
  }
  
  try {
    await uploadFile(file, role);
  } catch (err) {
    console.error('Upload error:', err);
  }
  
  target.value = '';
};

// --- Единая функция Drop ---

const handleDrop = async (e: DragEvent, role: 'bom' | 'archive') => {
  // Сбрасываем состояние перетаскивания
  if (role === 'bom') {
    isDraggingBom.value = false;
  } else {
    isDraggingArchive.value = false;
  }
  
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  
  // Сохраняем файл в соответствующее состояние
  if (role === 'bom') {
    bomFile.value = file;
  } else {
    archiveFile.value = file;
  }
  
  try {
    await uploadFile(file, role);
  } catch (err) {
    console.error('Upload error:', err);
  }
};

// --- Единая функция скачивания ---

const handleDownload = async (type: 'diff' | 'cards') => {
  try {
    if (type === 'diff') {
      await downloadDiffResult();
    } else {
      await downloadCardsResult();
    }
  } catch (err) {
    console.error('Download error:', err);
  }
};
</script>

<style scoped>
/* ... твои стили (без изменений) ... */
</style>