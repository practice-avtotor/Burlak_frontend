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
      @drop.prevent="handleDropBom"
    >
      <div class="dropzone-content">
        <span class="icon">📊</span>
        <p>Загрузите BOM-файл (XLSX)</p>
        <button @click="selectBomFile" class="btn">Выбрать BOM</button>
        <input type="file" ref="bomInput" accept=".xlsx" @change="handleBomSelect" style="display: none">
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
      @drop.prevent="handleDropArchive"
    >
      <div class="dropzone-content">
        <span class="icon">📦</span>
        <p>Загрузите архив с картами (ZIP)</p>
        <button @click="selectArchiveFile" class="btn">Выбрать архив</button>
        <input type="file" ref="archiveInput" accept=".zip" @change="handleArchiveSelect" style="display: none">
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

    <!-- Скачивание результатов -->
    <div v-if="jobStatus?.status === 'done'" class="download-section">
      <h3>📥 Результаты готовы</h3>
      <div class="download-buttons">
        <button class="btn btn-download" @click="downloadDiffResult">📊 Скачать diff.xlsx</button>
        <button class="btn btn-download" @click="downloadCardsResult">📦 Скачать translated_cards.zip</button>
      </div>
    </div>

    <!-- Ошибка -->
    <div v-if="error" class="error-message">
      ❌ {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useChunkedUpload } from '@/composables/useChunkedUpload';

const {
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
} = useChunkedUpload();

const bomFile = ref<File | null>(null);
const archiveFile = ref<File | null>(null);
const isDraggingBom = ref(false);
const isDraggingArchive = ref(false);
const bomInput = ref<HTMLInputElement | null>(null);
const archiveInput = ref<HTMLInputElement | null>(null);

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const selectBomFile = () => bomInput.value?.click();
const selectArchiveFile = () => archiveInput.value?.click();

const handleBomSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    bomFile.value = file;
    await uploadFile(file, 'bom');
  }
  target.value = '';
};

const handleArchiveSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    archiveFile.value = file;
    await uploadFile(file, 'archive');
  }
  target.value = '';
};

const handleDropBom = async (e: DragEvent) => {
  isDraggingBom.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    bomFile.value = file;
    await uploadFile(file, 'bom');
  }
};

const handleDropArchive = async (e: DragEvent) => {
  isDraggingArchive.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    archiveFile.value = file;
    await uploadFile(file, 'archive');
  }
};
</script>

<style scoped>
/* ... твои стили + новые */
.job-status {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  background: #f1f5f9;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}

.job-id {
  font-family: monospace;
  color: #4f46e5;
}

.job-stage {
  background: #4f46e5;
  color: white;
  padding: 2px 12px;
  border-radius: 20px;
}

.selected-file {
  margin-top: 12px;
  font-size: 14px;
  color: #10b981;
}

.download-section {
  margin-top: 24px;
  padding: 16px;
  background: #f0fdf4;
  border-radius: 12px;
  border: 1px solid #bbf7d0;
}

.download-section h3 {
  font-size: 16px;
  margin-bottom: 12px;
  color: #16a34a;
}

.download-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.error-message {
  margin-top: 16px;
  padding: 12px 16px;
  background: #fef2f2;
  border-radius: 8px;
  color: #dc2626;
  border: 1px solid #fca5a5;
}
</style>