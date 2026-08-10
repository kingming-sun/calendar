import { create } from "zustand";
import { batchEngine } from "@/services/batch/BatchEngine";
import { db, getLatestActiveBatch, seedInitialData } from "@/services/storage/db";
import {
  BatchStatus,
  JobStatus,
  type Batch,
  type BatchCreateInput,
  type ImageJob,
  type ImageSet,
  type PromptTemplate,
  type ProviderConfig
} from "@/types";

const SELECTED_DIRECTORY_ID = "selected-output-directory";

async function getStoredDirectory(batchId?: string): Promise<FileSystemDirectoryHandle | undefined> {
  if (batchId) {
    const batchHandle = await db.fileHandles.get(`batch:${batchId}`);
    if (batchHandle?.handle) {
      return batchHandle.handle;
    }
  }

  const selectedHandle = await db.fileHandles.get(SELECTED_DIRECTORY_ID);
  return selectedHandle?.handle;
}

interface AppState {
  initialized: boolean;
  selectedDirectory?: FileSystemDirectoryHandle;
  directoryName?: string;
  batches: Batch[];
  activeBatch?: Batch;
  sets: ImageSet[];
  jobs: ImageJob[];
  providers: ProviderConfig[];
  prompts: PromptTemplate[];
  loading: boolean;
  error?: string;
  initialize: () => Promise<void>;
  selectDirectory: (handle: FileSystemDirectoryHandle) => Promise<void>;
  reload: () => Promise<void>;
  loadBatch: (batchId: string) => Promise<void>;
  createBatch: (input: BatchCreateInput) => Promise<Batch>;
  startBatch: (batchId: string) => Promise<void>;
  pauseBatch: () => Promise<void>;
  resumeBatch: () => Promise<void>;
  cancelBatch: (batchId: string) => Promise<void>;
  retryFailed: (batchId: string) => Promise<void>;
  saveProvider: (provider: ProviderConfig) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  batches: [],
  sets: [],
  jobs: [],
  providers: [],
  prompts: [],
  loading: false,

  async initialize() {
    set({ loading: true, error: undefined });
    try {
      await seedInitialData();
      const selectedDirectory = await getStoredDirectory();
      await get().reload();
      set({
        initialized: true,
        selectedDirectory,
        directoryName: selectedDirectory?.name
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "初始化失败" });
    } finally {
      set({ loading: false });
    }
  },

  async selectDirectory(handle) {
    await db.fileHandles.put({
      id: SELECTED_DIRECTORY_ID,
      handle,
      updatedAt: Date.now()
    });

    set({
      selectedDirectory: handle,
      directoryName: handle.name
    });
  },

  async reload() {
    const [batches, providers, prompts] = await Promise.all([
      db.batches.orderBy("updatedAt").reverse().toArray(),
      db.providers.toArray(),
      db.prompts.orderBy("updatedAt").reverse().toArray()
    ]);
    const activeBatch = (await getLatestActiveBatch()) ?? batches[0];
    const [sets, jobs] = activeBatch
      ? await Promise.all([
          db.sets.where("batchId").equals(activeBatch.id).sortBy("index"),
          db.jobs.where("batchId").equals(activeBatch.id).toArray()
        ])
      : [[], []];

    set({
      batches,
      providers,
      prompts,
      activeBatch,
      sets,
      jobs
    });
  },

  async loadBatch(batchId) {
    const [batch, sets, jobs] = await Promise.all([
      db.batches.get(batchId),
      db.sets.where("batchId").equals(batchId).sortBy("index"),
      db.jobs.where("batchId").equals(batchId).toArray()
    ]);

    if (!batch) {
      set({
        error: "Batch 不存在"
      });
      return;
    }

    set({
      activeBatch: batch,
      sets,
      jobs
    });
  },

  async createBatch(input) {
    set({ loading: true, error: undefined });
    try {
      const batch = await batchEngine.createBatch(input);
      await get().reload();
      return batch;
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建 Batch 失败";
      set({ error: message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  async startBatch(batchId) {
    const directory = get().selectedDirectory ?? (await getStoredDirectory(batchId));
    if (!directory) {
      set({ error: "请先选择输出目录" });
      throw new Error("请先选择输出目录");
    }

    await db.fileHandles.put({
      id: `batch:${batchId}`,
      batchId,
      handle: directory,
      updatedAt: Date.now()
    });
    set({
      selectedDirectory: directory,
      directoryName: directory.name
    });

    set({ loading: true, error: undefined });
    batchEngine
      .startBatch(batchId, directory)
      .catch((error) => {
        set({
          error: error instanceof Error ? error.message : "Batch 执行失败"
        });
      })
      .finally(async () => {
        await get().reload();
        set({ loading: false });
      });
  },

  async pauseBatch() {
    batchEngine.pause();
    const batch = get().activeBatch;
    if (batch) {
      await db.batches.update(batch.id, {
        status: BatchStatus.PAUSED,
        updatedAt: Date.now()
      });
      await get().reload();
    }
  },

  async resumeBatch() {
    const batch = get().activeBatch;
    if (batch) {
      if (batchEngine.isRunning(batch.id)) {
        batchEngine.resume();
      }

      await db.batches.update(batch.id, {
        status: BatchStatus.RUNNING,
        updatedAt: Date.now()
      });

      const pendingJobs = await db.jobs
        .where("batchId")
        .equals(batch.id)
        .and((job) => job.status === JobStatus.PENDING)
        .toArray();
      const hasPendingJobs = pendingJobs.length > 0;

      if (!batchEngine.isRunning(batch.id) && hasPendingJobs) {
        const directory = get().selectedDirectory ?? (await getStoredDirectory(batch.id));
        if (!directory) {
          set({ error: "请先选择输出目录" });
          await get().reload();
          return;
        }

        await db.fileHandles.put({
          id: `batch:${batch.id}`,
          batchId: batch.id,
          handle: directory,
          updatedAt: Date.now()
        });
        set({
          selectedDirectory: directory,
          directoryName: directory.name
        });

        set({ loading: true, error: undefined });
        batchEngine
          .startBatch(batch.id, directory)
          .catch((error) => {
            set({
              error: error instanceof Error ? error.message : "Batch 执行失败"
            });
          })
          .finally(async () => {
            await get().reload();
            set({ loading: false });
          });
      }

      await get().reload();
    }
  },

  async cancelBatch(batchId) {
    batchEngine.cancel();
    await db.transaction("rw", db.batches, db.jobs, async () => {
      await db.batches.update(batchId, {
        status: BatchStatus.CANCELLED,
        updatedAt: Date.now()
      });
      await db.jobs
        .where("batchId")
        .equals(batchId)
        .and((job) => job.status === JobStatus.PENDING)
        .modify({
          status: JobStatus.CANCELLED,
          updatedAt: Date.now()
        });
    });
    await get().reload();
  },

  async retryFailed(batchId) {
    await batchEngine.retryFailed(batchId);
    await get().reload();
  },

  async saveProvider(provider) {
    await db.providers.put({
      ...provider,
      updatedAt: Date.now()
    });
    await get().reload();
  }
}));
