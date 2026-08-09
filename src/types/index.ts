export enum JobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  DOWNLOADING = "downloading",
  SAVING = "saving",
  SUCCESS = "success",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

export enum BatchStatus {
  CREATED = "created",
  RUNNING = "running",
  PAUSED = "paused",
  COMPLETED = "completed",
  PARTIAL_FAILED = "partial_failed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

export enum SetStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SUCCESS = "success",
  PARTIAL_FAILED = "partial_failed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

export type SeedMode = "random" | "fixed" | "increment";

export interface JobError {
  code?: string;
  message: string;
  httpStatus?: number;
  retryable: boolean;
  timestamp: number;
}

export interface Batch {
  id: string;
  name: string;
  setCount: number;
  imagesPerSet: number;
  totalImages: number;
  providerId: string;
  model: string;
  width: number;
  height: number;
  concurrency: number;
  status: BatchStatus;
  completedImages: number;
  failedImages: number;
  processingImages: number;
  estimatedCost?: number;
  actualCost?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ImageSet {
  id: string;
  batchId: string;
  index: number;
  name: string;
  status: SetStatus;
  totalImages: number;
  completedImages: number;
  failedImages: number;
  createdAt: number;
  updatedAt: number;
}

export interface ImageJob {
  id: string;
  batchId: string;
  setId: string;
  setIndex: number;
  imageIndex: number;
  prompt: string;
  negativePrompt?: string;
  providerId: string;
  model: string;
  width: number;
  height: number;
  seed?: number;
  status: JobStatus;
  retryCount: number;
  maxRetries: number;
  imageUrl?: string;
  localFilename?: string;
  error?: JobError;
  estimatedCost?: number;
  actualCost?: number;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface ProviderPricing {
  pricePerImage?: number;
  pricePerMegapixel?: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  model: string;
  apiKey?: string;
  enabled: boolean;
  browserCompatible: boolean;
  pricing: ProviderPricing;
  updatedAt: number;
}

export interface ProviderRuntimeConfig {
  apiKey?: string;
  model: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  seed?: number;
  model: string;
}

export interface ProviderError {
  code?: string;
  message: string;
  httpStatus?: number;
  retryable: boolean;
  retryAfterMs?: number;
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  imageBlob?: Blob;
  providerJobId?: string;
  cost?: number;
  error?: ProviderError;
}

export interface ImageProvider {
  id: string;
  name: string;
  generate(
    request: ImageGenerationRequest,
    config: ProviderRuntimeConfig
  ): Promise<ImageGenerationResult>;
}

export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  negativePrompt?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  defaultImagesPerSet: number;
  defaultConcurrency: number;
  defaultWidth: number;
  defaultHeight: number;
  defaultMaxRetries: number;
  progressFlushIntervalMs: number;
}

export interface AppSettingRecord<T = unknown> {
  key: string;
  value: T;
}

export interface FileHandleRecord {
  id: string;
  batchId?: string;
  handle: FileSystemDirectoryHandle;
  updatedAt: number;
}

export interface BatchCreateInput {
  name: string;
  setCount: number;
  imagesPerSet: number;
  providerId: string;
  model: string;
  width: number;
  height: number;
  concurrency: number;
  promptTemplate: string;
  negativePrompt?: string;
  seedMode: SeedMode;
  baseSeed?: number;
  maxRetries: number;
}

export interface BatchProgress {
  totalImages: number;
  completedImages: number;
  failedImages: number;
  processingImages: number;
  remainingImages: number;
  percent: number;
}
