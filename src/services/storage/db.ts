import Dexie, { type Table } from "dexie";
import {
  BatchStatus,
  type AppSettingRecord,
  type Batch,
  type FileHandleRecord,
  type ImageJob,
  type ImageSet,
  type PromptTemplate,
  type ProviderConfig
} from "@/types";

export class AIBatchDB extends Dexie {
  batches!: Table<Batch, string>;
  sets!: Table<ImageSet, string>;
  jobs!: Table<ImageJob, string>;
  providers!: Table<ProviderConfig, string>;
  prompts!: Table<PromptTemplate, string>;
  settings!: Table<AppSettingRecord, string>;
  fileHandles!: Table<FileHandleRecord, string>;

  constructor() {
    super("AIBatchDB");

    this.version(1).stores({
      batches: "id, status, createdAt, updatedAt",
      sets: "id, batchId, status, index",
      jobs: "id, batchId, setId, status, setIndex, imageIndex",
      providers: "id, enabled",
      prompts: "id, name, updatedAt",
      settings: "key",
      fileHandles: "id, batchId"
    });
  }
}

export const db = new AIBatchDB();

export async function seedInitialData(): Promise<void> {
  const now = Date.now();
  const providerCount = await db.providers.count();
  const promptCount = await db.prompts.count();
  const defaultProviders: ProviderConfig[] = [
    {
      id: "mock",
      name: "模拟图片服务（测试用）",
      model: "mock-canvas-v1",
      enabled: true,
      browserCompatible: true,
      pricing: {
        pricePerImage: 0
      },
      updatedAt: now
    },
    {
      id: "flux",
      name: "BFL FLUX",
      model: "flux-dev",
      enabled: true,
      browserCompatible: true,
      pricing: {
        pricePerImage: 0.025
      },
      updatedAt: now
    },
    {
      id: "gemini",
      name: "Gemini Image",
      model: "gemini-2.5-flash-image-preview",
      enabled: true,
      browserCompatible: true,
      pricing: {
        pricePerImage: 0.039
      },
      updatedAt: now
    }
  ];

  if (providerCount === 0) {
    await db.providers.bulkPut(defaultProviders);
  } else {
    for (const provider of defaultProviders) {
      const existingProvider = await db.providers.get(provider.id);
      if (!existingProvider) {
        await db.providers.put(provider);
      }
    }
  }

  if (promptCount === 0) {
    await db.prompts.add({
      id: "template_calendar_art",
      name: "挂历艺术默认模板",
      template:
        "一幅精致的{{subject}}，{{style}}，{{environment}}，艺术挂历插画，高细节，竖版构图，无文字，无水印。第 {{set_index}} 组，第 {{image_index}} 张。",
      negativePrompt: "文字，水印，低质量，模糊",
      createdAt: now,
      updatedAt: now
    });
  }

  const mockProvider = await db.providers.get("mock");
  if (mockProvider?.name === "MockProvider" || mockProvider?.name === "模拟图片服务") {
    await db.providers.update("mock", {
      name: "模拟图片服务（测试用）",
      updatedAt: now
    });
  }

  const defaultPrompt = await db.prompts.get("template_calendar_art");
  if (defaultPrompt?.template.startsWith("A beautiful")) {
    await db.prompts.update("template_calendar_art", {
      template:
        "一幅精致的{{subject}}，{{style}}，{{environment}}，艺术挂历插画，高细节，竖版构图，无文字，无水印。第 {{set_index}} 组，第 {{image_index}} 张。",
      negativePrompt: "文字，水印，低质量，模糊",
      updatedAt: now
    });
  }

  const fluxProvider = await db.providers.get("flux");
  if (
    fluxProvider &&
    (fluxProvider.model === "flux-model-name" ||
      fluxProvider.model === "fal-ai/flux" ||
      fluxProvider.model === "fal-ai/flux/dev" ||
      fluxProvider.name === "FLUX" ||
      fluxProvider.name === "fal.ai FLUX" ||
      !fluxProvider.browserCompatible)
  ) {
    await db.providers.update("flux", {
      name: "BFL FLUX",
      model: "flux-dev",
      enabled: true,
      browserCompatible: true,
      updatedAt: now
    });
  }
}

export async function getLatestActiveBatch(): Promise<Batch | undefined> {
  const activeStatuses = [
    BatchStatus.RUNNING,
    BatchStatus.PAUSED,
    BatchStatus.PARTIAL_FAILED
  ];
  const batches = await db.batches.orderBy("updatedAt").reverse().toArray();

  return batches.find((batch) => activeStatuses.includes(batch.status));
}
