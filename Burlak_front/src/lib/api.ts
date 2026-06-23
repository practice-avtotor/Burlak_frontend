// src/lib/api.ts

const API_BASE = '/api/v1';

export interface Job {
  id: string;
  status: 'awaiting_upload' | 'uploading' | 'processing' | 'done' | 'error';
  stage: 'bom' | 'archive' | 'processing' | 'complete';
  processed?: number;
  total?: number;
  bom_uploaded?: boolean;
  archive_uploaded?: boolean;
  error?: string;
}

export interface CreateJobResponse {
  id: string;
  status: 'awaiting_upload';
}

// 1. Создание задачи
export async function createJob(): Promise<CreateJobResponse> {
  const response = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`Ошибка создания задачи: ${response.status}`);
  }
  
  return response.json();
}

// 2. Загрузка чанка (чистый бинарник, без FormData)
export async function uploadChunk(
  jobId: string,
  role: 'bom' | 'archive',
  chunkIndex: number,
  chunk: Blob,
  totalChunks: number
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/jobs/${jobId}/files/${role}/chunks/${chunkIndex}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Total-Chunks': totalChunks.toString(),
      },
      body: chunk, // ✅ Чистый Blob, НЕ FormData
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ошибка загрузки чанка ${chunkIndex}: ${response.status} - ${error}`);
  }
}

// 3. Завершение загрузки файла (BOM или Archive)
export async function completeUpload(
  jobId: string,
  role: 'bom' | 'archive'
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/jobs/${jobId}/files/${role}/complete`,
    {
      method: 'POST',
    }
  );
  
  if (!response.ok) {
    throw new Error(`Ошибка завершения загрузки ${role}: ${response.status}`);
  }
}

// 4. Запуск обработки
export async function startProcessing(jobId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/jobs/${jobId}/start`,
    {
      method: 'POST',
    }
  );
  
  if (!response.ok) {
    throw new Error(`Ошибка запуска обработки: ${response.status}`);
  }
}

// 5. Получение статуса задачи
export async function getJobStatus(jobId: string): Promise<Job> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`);
  
  if (!response.ok) {
    throw new Error(`Ошибка получения статуса: ${response.status}`);
  }
  
  return response.json();
}

// 6. Скачивание результата
export function downloadDiff(jobId: string): void {
  window.open(`${API_BASE}/jobs/${jobId}/results/diff`, '_blank');
}

export function downloadCards(jobId: string): void {
  window.open(`${API_BASE}/jobs/${jobId}/results/cards`, '_blank');
}