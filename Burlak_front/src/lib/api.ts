// src/lib/api.ts

const API_BASE = '/api/v1';

// --- ТИПЫ ---

export interface Job {
  id: string;
  status: 'awaiting_upload' | 'uploading' | 'processing' | 'done' | 'error';
  stage: 'bom' | 'archive' | 'processing' | 'complete';
  processed?: number;
  total?: number;
  bom_uploaded?: boolean;
  archive_uploaded?: boolean;
  error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateJobResponse {
  id: string;
  status: 'awaiting_upload';
}

// --- КАСТОМНАЯ ОШИБКА ---

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, any>;

  constructor(status: number, code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// --- ОБРАБОТКА ОТВЕТОВ ---

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (response.ok) {
    if (isJson) {
      return response.json();
    }
    return response as unknown as T;
  }

  // ✅ Исправлено: явно указываем тип
  let errorData: {
    code: string;
    message: string;
    details?: Record<string, any>;
  } = {
    code: 'UNKNOWN_ERROR',
    message: `HTTP ${response.status}: ${response.statusText}`,
  };

  if (isJson) {
    try {
      const parsed = await response.json();
      errorData = {
        code: parsed.code || 'UNKNOWN_ERROR',
        message: parsed.message || parsed.error || 'Неизвестная ошибка',
        details: parsed.details || parsed,
      };
    } catch {
      // Игнорируем
    }
  } else {
    try {
      const text = await response.text();
      if (text) {
        errorData.message = text;
      }
    } catch {
      // Игнорируем
    }
  }

  throw new ApiError(response.status, errorData.code, errorData.message, errorData.details);
}

// --- API ФУНКЦИИ ---

export async function createJob(): Promise<CreateJobResponse> {
  const response = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
  });
  return handleResponse<CreateJobResponse>(response);
}

export async function uploadChunk(
  jobId: string,
  role: 'bom' | 'archive',
  chunkIndex: number,
  chunk: Blob,
  totalChunks: number,
  signal?: AbortSignal
): Promise<void> {
  if (!(chunk instanceof Blob) || chunk.size === 0) {
    throw new ApiError(400, 'INVALID_CHUNK', 'Чанк должен быть непустым Blob');
  }

  const response = await fetch(
    `${API_BASE}/jobs/${jobId}/files/${role}/chunks/${chunkIndex}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Total-Chunks': totalChunks.toString(),
        'Accept': 'application/json',
      },
      body: chunk,
      signal,
    }
  );

  if (response.ok) return;
  return handleResponse<void>(response);
}

export async function completeUpload(jobId: string, role: 'bom' | 'archive'): Promise<void> {
  const response = await fetch(
    `${API_BASE}/jobs/${jobId}/files/${role}/complete`,
    {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    }
  );

  if (response.ok) return;
  return handleResponse<void>(response);
}

export async function startProcessing(jobId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/jobs/${jobId}/start`,
    {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    }
  );

  if (response.ok) return;
  return handleResponse<void>(response);
}

export async function getJobStatus(jobId: string): Promise<Job> {
  const response = await fetch(
    `${API_BASE}/jobs/${jobId}`,
    { headers: { 'Accept': 'application/json' } }
  );
  return handleResponse<Job>(response);
}

export async function downloadDiff(jobId: string): Promise<Blob> {
  const response = await fetch(
    `${API_BASE}/jobs/${jobId}/results/diff`,
    { headers: { 'Accept': 'application/octet-stream' } }
  );
  if (!response.ok) await handleResponse(response);
  return response.blob();
}

export async function downloadCards(jobId: string): Promise<Blob> {
  const response = await fetch(
    `${API_BASE}/jobs/${jobId}/results/cards`,
    { headers: { 'Accept': 'application/octet-stream' } }
  );
  if (!response.ok) await handleResponse(response);
  return response.blob();
}