import { db } from "@/services/storage/db";
import { providerManager } from "@/services/providers/ProviderManager";
import { fileSystemService } from "@/services/filesystem/FileSystemService";
import { validateImageBlob } from "@/services/filesystem/ImageValidator";
import {
  BatchStatus,
  JobStatus,
  SetStatus,
  type Batch,
  type BatchCreateInput,
  type BatchProgress,
  type ImageJob,
  type ImageSet,
  type ProviderConfig,
  type ProviderError
} from "@/types";
import { estimateImageCost } from "@/services/cost/CostCalculator";
import {
  getBatchId,
  getImageFilename,
  getJobId,
  getSetDirectoryName
} from "@/utils/filename";
import { renderPrompt } from "@/utils/prompt";
import { generateSeed } from "@/utils/seed";
import { sleep } from "@/utils/retry";
import { JobScheduler } from "./JobScheduler";
import { retryManager } from "./RetryManager";

export class BatchEngine {
  private scheduler?: JobScheduler;
  private runningBatchId?: string;

  isRunning(batchId?: string): boolean {
    if (!this.runningBatchId) {
      return false;
    }

    return batchId ? this.runningBatchId === batchId : true;
  }

  async createBatch(input: BatchCreateInput): Promise<Batch> {
    const now = Date.now();
    const id = getBatchId(now);
    const totalImages = input.setCount * input.imagesPerSet;
    const provider = await db.providers.get(input.providerId);
    const estimatedCost = estimateImageCost(
      totalImages,
      input.width,
      input.height,
      provider?.pricing ?? {}
    );

    const batch: Batch = {
      id,
      name: input.name,
      setCount: input.setCount,
      imagesPerSet: input.imagesPerSet,
      totalImages,
      providerId: input.providerId,
      model: input.model,
      width: input.width,
      height: input.height,
      concurrency: input.concurrency,
      status: BatchStatus.CREATED,
      completedImages: 0,
      failedImages: 0,
      processingImages: 0,
      estimatedCost,
      actualCost: 0,
      createdAt: now,
      updatedAt: now
    };

    const sets: ImageSet[] = [];
    const jobs: ImageJob[] = [];

    for (let setIndex = 1; setIndex <= input.setCount; setIndex += 1) {
      const setId = `${id}_${getSetDirectoryName(setIndex)}`;
      sets.push({
        id: setId,
        batchId: id,
        index: setIndex,
        name: getSetDirectoryName(setIndex),
        status: SetStatus.PENDING,
        totalImages: input.imagesPerSet,
        completedImages: 0,
        failedImages: 0,
        createdAt: now,
        updatedAt: now
      });

      for (let imageIndex = 1; imageIndex <= input.imagesPerSet; imageIndex += 1) {
        const filename = getImageFilename(imageIndex);
        jobs.push({
          id: getJobId(id, setIndex, imageIndex),
          batchId: id,
          setId,
          setIndex,
          imageIndex,
          prompt: renderPrompt(input.promptTemplate, {
            setIndex,
            imageIndex,
            subject: "挂历主题插画",
            style: "精致艺术插画风格",
            environment: "柔和摄影棚光线"
          }),
          negativePrompt: input.negativePrompt,
          providerId: input.providerId,
          model: input.model,
          width: input.width,
          height: input.height,
          seed: generateSeed(
            input.seedMode,
            input.baseSeed,
            setIndex,
            imageIndex
          ),
          status: JobStatus.PENDING,
          retryCount: 0,
          maxRetries: input.maxRetries,
          localFilename: `${getSetDirectoryName(setIndex)}/${filename}`,
          estimatedCost: totalImages > 0 ? estimatedCost / totalImages : 0,
          actualCost: 0,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    await db.transaction("rw", db.batches, db.sets, db.jobs, async () => {
      await db.batches.add(batch);
      await db.sets.bulkAdd(sets);
      await db.jobs.bulkAdd(jobs);
    });

    return batch;
  }

  async startBatch(
    batchId: string,
    directoryHandle: FileSystemDirectoryHandle
  ): Promise<void> {
    if (this.isRunning(batchId)) {
      this.scheduler?.resume();
      return;
    }

    const batch = await db.batches.get(batchId);
    if (!batch) {
      throw new Error("Batch 不存在");
    }

    const hasPermission = await fileSystemService.ensurePermission(directoryHandle);
    if (!hasPermission) {
      throw new Error("没有输出目录写入权限");
    }

    await db.batches.update(batchId, {
      status: BatchStatus.RUNNING,
      updatedAt: Date.now()
    });

    const jobs = await db.jobs
      .where("batchId")
      .equals(batchId)
      .and((job) => job.status === JobStatus.PENDING)
      .toArray();

    this.scheduler = new JobScheduler(batch.concurrency, (job) =>
      this.runJob(job, directoryHandle)
    );

    this.runningBatchId = batchId;

    try {
      await this.scheduler.run(jobs);
      await this.finalizeBatch(batchId);
    } finally {
      if (this.runningBatchId === batchId) {
        this.runningBatchId = undefined;
        this.scheduler = undefined;
      }
    }
  }

  pause(): void {
    this.scheduler?.pause();
  }

  resume(): void {
    this.scheduler?.resume();
  }

  cancel(): void {
    this.scheduler?.cancel();
    this.runningBatchId = undefined;
  }

  async retryFailed(batchId: string): Promise<void> {
    await db.jobs
      .where("batchId")
      .equals(batchId)
      .and((job) => job.status === JobStatus.FAILED)
      .modify({
        status: JobStatus.PENDING,
        retryCount: 0,
        error: undefined,
        updatedAt: Date.now()
      });

    await this.recalculateProgress(batchId);
  }

  private async runJob(
    initialJob: ImageJob,
    rootDirectory: FileSystemDirectoryHandle
  ): Promise<void> {
    let job = initialJob;
    const provider = await db.providers.get(job.providerId);

    if (!provider) {
      await this.failJob(job, {
        message: "Provider 配置不存在",
        retryable: false
      });
      return;
    }

    const setDirectory = await fileSystemService.createDirectory(
      rootDirectory,
      getSetDirectoryName(job.setIndex)
    );
    const filename = getImageFilename(job.imageIndex);

    if (await fileSystemService.fileExists(setDirectory, filename)) {
      await this.markJobSuccess(job, 0);
      return;
    }

    while (job.retryCount <= job.maxRetries) {
      await db.jobs.update(job.id, {
        status: JobStatus.PROCESSING,
        startedAt: job.startedAt ?? Date.now(),
        updatedAt: Date.now()
      });
      await this.recalculateProgress(job.batchId);

      const result = await providerManager
        .generate(
          job.providerId,
          {
            prompt: job.prompt,
            negativePrompt: job.negativePrompt,
            width: job.width,
            height: job.height,
            seed: job.seed,
            model: job.model
          },
          this.toRuntimeConfig(provider)
        )
        .catch((error): ReturnType<typeof providerManager.generate> => {
          return Promise.resolve({
            success: false,
            error: {
              code: "PROVIDER_NETWORK_ERROR",
              message:
                error instanceof Error
                  ? error.message
                  : "Provider 请求失败，可能是网络或 CORS 问题",
              retryable: true
            }
          });
        });

      if (result.success && (result.imageBlob || result.imageUrl)) {
        await db.jobs.update(job.id, {
          status: JobStatus.DOWNLOADING,
          updatedAt: Date.now()
        });

        let blob: Blob;
        try {
          blob = result.imageBlob ?? (await this.fetchImageBlob(result.imageUrl));
        } catch (error) {
          await this.failJob(job, {
            code: "IMAGE_DOWNLOAD_FAILED",
            message: error instanceof Error ? error.message : "图片下载失败",
            retryable: true
          });
          return;
        }

        await db.jobs.update(job.id, {
          status: JobStatus.SAVING,
          updatedAt: Date.now()
        });

        const validation = await validateImageBlob(blob, job.width, job.height, false);
        if (!validation.valid) {
          await this.failJob(job, {
            message: validation.message ?? "图片校验失败",
            retryable: false
          });
          return;
        }

        try {
          await fileSystemService.saveFile(setDirectory, filename, blob);
        } catch (error) {
          await this.failJob(job, {
            code: "FILE_SAVE_FAILED",
            message: error instanceof Error ? error.message : "图片保存失败",
            retryable: false
          });
          return;
        }
        await this.markJobSuccess(job, result.cost ?? 0);
        return;
      }

      const error = result.error ?? {
        message: "Provider 未返回图片",
        retryable: true
      };
      const decision = retryManager.getDecision(
        error,
        job.retryCount,
        job.maxRetries
      );

      if (!decision.shouldRetry) {
        await this.failJob(job, error);
        return;
      }

      await db.jobs.update(job.id, {
        retryCount: job.retryCount + 1,
        error: {
          code: error.code,
          message: `${error.message}，${decision.reason}`,
          httpStatus: error.httpStatus,
          retryable: true,
          timestamp: Date.now()
        },
        updatedAt: Date.now()
      });
      await sleep(decision.delayMs);

      const latest = await db.jobs.get(job.id);
      if (!latest) {
        return;
      }
      job = latest;
    }
  }

  private async fetchImageBlob(imageUrl?: string): Promise<Blob> {
    if (!imageUrl) {
      throw new Error("图片 URL 为空");
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`图片下载失败：${response.status}`);
      }

      return response.blob();
    } catch {
      const proxyResponse = await fetch("/api/image/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageUrl
        })
      });
      const payload = (await proxyResponse.json().catch(() => ({}))) as {
        imageBase64?: string;
        mimeType?: string;
        error?: string;
      };

      if (!proxyResponse.ok || !payload.imageBase64) {
        throw new Error(payload.error ?? `图片代理下载失败：${proxyResponse.status}`);
      }

      return this.base64ToBlob(payload.imageBase64, payload.mimeType ?? "image/jpeg");
    }
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], {
      type: mimeType
    });
  }

  private toRuntimeConfig(provider: ProviderConfig) {
    return {
      apiKey: provider.apiKey,
      model: provider.model
    };
  }

  private async markJobSuccess(job: ImageJob, cost: number): Promise<void> {
    await db.jobs.update(job.id, {
      status: JobStatus.SUCCESS,
      actualCost: cost,
      completedAt: Date.now(),
      updatedAt: Date.now(),
      error: undefined
    });
    await this.recalculateProgress(job.batchId);
  }

  private async failJob(
    job: ImageJob,
    error: Omit<ProviderError, "retryAfterMs">
  ): Promise<void> {
    await db.jobs.update(job.id, {
      status: JobStatus.FAILED,
      error: {
        code: error.code,
        message: error.message,
        httpStatus: error.httpStatus,
        retryable: error.retryable,
        timestamp: Date.now()
      },
      updatedAt: Date.now()
    });
    await this.recalculateProgress(job.batchId);
  }

  async recalculateProgress(batchId: string): Promise<BatchProgress> {
    const jobs = await db.jobs.where("batchId").equals(batchId).toArray();
    const sets = await db.sets.where("batchId").equals(batchId).toArray();

    const completedImages = jobs.filter(
      (job) => job.status === JobStatus.SUCCESS
    ).length;
    const failedImages = jobs.filter((job) => job.status === JobStatus.FAILED).length;
    const processingImages = jobs.filter((job) =>
      [JobStatus.PROCESSING, JobStatus.DOWNLOADING, JobStatus.SAVING].includes(
        job.status
      )
    ).length;
    const totalImages = jobs.length;

    await Promise.all(
      sets.map(async (set) => {
        const setJobs = jobs.filter((job) => job.setId === set.id);
        const setCompleted = setJobs.filter(
          (job) => job.status === JobStatus.SUCCESS
        ).length;
        const setFailed = setJobs.filter(
          (job) => job.status === JobStatus.FAILED
        ).length;
        const setProcessing = setJobs.some((job) =>
          [JobStatus.PROCESSING, JobStatus.DOWNLOADING, JobStatus.SAVING].includes(
            job.status
          )
        );
        const status =
          setCompleted === set.totalImages
            ? SetStatus.SUCCESS
            : setFailed > 0
              ? SetStatus.PARTIAL_FAILED
              : setProcessing
                ? SetStatus.PROCESSING
                : SetStatus.PENDING;

        await db.sets.update(set.id, {
          status,
          completedImages: setCompleted,
          failedImages: setFailed,
          updatedAt: Date.now()
        });
      })
    );

    await db.batches.update(batchId, {
      completedImages,
      failedImages,
      processingImages,
      actualCost: jobs.reduce((sum, job) => sum + (job.actualCost ?? 0), 0),
      updatedAt: Date.now()
    });

    return {
      totalImages,
      completedImages,
      failedImages,
      processingImages,
      remainingImages: totalImages - completedImages - failedImages,
      percent: totalImages === 0 ? 0 : (completedImages / totalImages) * 100
    };
  }

  private async finalizeBatch(batchId: string): Promise<void> {
    const progress = await this.recalculateProgress(batchId);
    const status =
      progress.failedImages === 0 &&
      progress.completedImages === progress.totalImages
        ? BatchStatus.COMPLETED
        : progress.completedImages > 0
          ? BatchStatus.PARTIAL_FAILED
          : BatchStatus.FAILED;

    await db.batches.update(batchId, {
      status,
      processingImages: 0,
      updatedAt: Date.now()
    });
  }
}

export const batchEngine = new BatchEngine();
