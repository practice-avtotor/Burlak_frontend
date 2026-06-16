<script setup lang="ts">
import { ref, watch } from 'vue';
import { useChunkedUpload } from '@/composables/useChunkedUpload';

const { uploadFile, isUploading, progress, uploadedChunks, totalChunks } = useChunkedUpload();

const files = ref<Array<{
  id: number;
  name: string;
  size: number;
  status: 'uploading' | 'done' | 'error';
  statusText: string;
  uploadedChunks?: number;
  totalChunks?: number;
}>>([]);

const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Следим за прогрессом и обновляем текущий файл
watch([progress, uploadedChunks, totalChunks], () => {
  const uploadingFile = files.value.find(f => f.status === 'uploading');
  if (uploadingFile) {
    uploadingFile.uploadedChunks = uploadedChunks.value;
    uploadingFile.totalChunks = totalChunks.value;
  }
});

const selectFile = () => {
  fileInput.value?.click();
};

const handleFileSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const selectedFiles = Array.from(target.files || []);
  for (const file of selectedFiles) {
    await uploadFileHandler(file);
  }
  target.value = '';
};

const handleDrop = async (e: DragEvent) => {
  isDragging.value = false;
  const droppedFiles = Array.from(e.dataTransfer?.files || []);
  for (const file of droppedFiles) {
    await uploadFileHandler(file);
  }
};

const uploadFileHandler = async (file: File) => {
  const id = Date.now();
  const totalChunksCount = Math.ceil(file.size / (10 * 1024 * 1024));
  
  const newFile = {
    id,
    name: file.name,
    size: file.size,
    status: 'uploading' as const,
    statusText: 'Загрузка...',
    uploadedChunks: 0,
    totalChunks: totalChunksCount,
  };
  files.value.push(newFile);
  
  try {
    await uploadFile(file);
    const item = files.value.find(f => f.id === id);
    if (item) {
      item.status = 'done';
      item.statusText = 'Готово ✅';
    }
  } catch (err) {
    const item = files.value.find(f => f.id === id);
    if (item) {
      item.status = 'error';
      item.statusText = 'Ошибка ❌';
    }
  }
};

// ✅ ОБНОВЛЕНО: симуляция скачивания
const downloadResult = (id: number) => {
  // Находим файл по ID
  const file = files.value.find(f => f.id === id);
  const fileName = file?.name || 'result';
  
  // Создаём тестовый файл
  const content = `Результат обработки файла "${fileName}"\n`;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  // Скачиваем
  const a = document.createElement('a');
  a.href = url;
  a.download = `result_${fileName}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log(`📥 Скачивание симулировано для файла #${id} (${fileName})`);
};

const removeFile = (id: number) => {
  files.value = files.value.filter(f => f.id !== id);
};

const clearCompleted = () => {
  files.value = files.value.filter(f => f.status !== 'done');
};
</script>