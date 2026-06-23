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
        <button @click="selectBomFile" class="btn" :disabled="isUploading && currentRole === 'bom'">
          {{ isUploading && currentRole === 'bom' ? 'Загрузка...' : 'Выбрать BOM' }}
        </button>
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
        <button @click="selectArchiveFile" class="btn" :disabled="isUploading && currentRole === 'archive'">
          {{ isUploading && currentRole === 'archive' ? 'Загрузка...' : 'Выбрать архив' }}
        </button>
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
        <button class="btn btn-download" @click="handleDownloadDiff">📊 Скачать diff.xlsx</button>
        <button class="btn btn-download" @click="handleDownloadCards">📦 Скачать translated_cards.zip</button>
      </div>
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
    try {
      await uploadFile(file, 'bom');
    } catch (err) {
      // Ошибка уже обработана в useChunkedUpload
      console.error('Upload error:', err);
    }
  }
  target.value = '';
};

const handleArchiveSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    archiveFile.value = file;
    try {
      await uploadFile(file, 'archive');
    } catch (err) {
      console.error('Upload error:', err);
    }
  }
  target.value = '';
};

const handleDropBom = async (e: DragEvent) => {
  isDraggingBom.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    bomFile.value = file;
    try {
      await uploadFile(file, 'bom');
    } catch (err) {
      console.error('Upload error:', err);
    }
  }
};

const handleDropArchive = async (e: DragEvent) => {
  isDraggingArchive.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    archiveFile.value = file;
    try {
      await uploadFile(file, 'archive');
    } catch (err) {
      console.error('Upload error:', err);
    }
  }
};

const handleDownloadDiff = async () => {
  try {
    await downloadDiffResult();
  } catch (err) {
    console.error('Download error:', err);
  }
};

const handleDownloadCards = async () => {
  try {
    await downloadCardsResult();
  } catch (err) {
    console.error('Download error:', err);
  }
};
</script>

<style scoped>
.uploader {
  max-width: 650px;
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

.job-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #f1f5f9;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}

.job-id {
  font-family: monospace;
  color: #4f46e5;
  font-size: 12px;
}

.job-stage {
  background: #4f46e5;
  color: white;
  padding: 2px 12px;
  border-radius: 20px;
  font-size: 12px;
  text-transform: capitalize;
}

.dropzone {
  border: 2px dashed #cbd5e1;
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #f8fafc;
  margin-bottom: 16px;
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

.dropzone-content .icon {
  font-size: 36px;
  display: block;
  margin-bottom: 8px;
}

.dropzone-content p {
  font-size: 14px;
  color: #475569;
  margin-bottom: 8px;
}

.dropzone-content .btn {
  pointer-events: auto;
}

.selected-file {
  margin-top: 12px;
  font-size: 14px;
  color: #10b981;
  font-weight: 500;
}

.btn {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn:hover:not(:disabled) {
  background: #4338ca;
}

.btn:disabled {
  background: #a5b4fc;
  cursor: not-allowed;
}

.uploading-status {
  margin: 16px 0;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.progress-label {
  font-size: 14px;
  color: #1e293b;
}

.progress-percent {
  font-size: 14px;
  font-weight: 600;
  color: #4f46e5;
}

.progress-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4f46e5;
  transition: width 0.3s;
  border-radius: 4px;
}

.chunks-info {
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
  text-align: center;
}

/* Ошибка */
.error-message {
  margin: 16px 0;
  padding: 12px 16px;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  animation: fadeIn 0.3s ease;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.error-icon {
  font-size: 18px;
}

.error-text {
  flex: 1;
  font-size: 14px;
  color: #dc2626;
}

.error-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0 4px;
}

.error-close:hover {
  color: #4b5563;
}

/* Скачивание результатов */
.download-section {
  margin-top: 24px;
  padding: 16px 20px;
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

.btn-download {
  background: #10b981;
  font-size: 13px;
  padding: 8px 16px;
}

.btn-download:hover {
  background: #059669;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Адаптив */
@media (max-width: 640px) {
  .uploader {
    padding: 12px;
  }
  .dropzone {
    padding: 24px 16px;
  }
  .download-buttons {
    flex-direction: column;
  }
  .btn-download {
    width: 100%;
    justify-content: center;
  }
}
</style>