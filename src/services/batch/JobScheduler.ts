import type { ImageJob } from "@/types";
import { sleep } from "@/utils/retry";

export type JobRunner = (job: ImageJob) => Promise<void>;

export class JobScheduler {
  private paused = false;
  private cancelled = false;

  constructor(
    private readonly concurrency: number,
    private readonly runJob: JobRunner
  ) {}

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  cancel(): void {
    this.cancelled = true;
  }

  async run(jobs: ImageJob[]): Promise<void> {
    let cursor = 0;

    const worker = async () => {
      while (cursor < jobs.length && !this.cancelled) {
        if (this.paused) {
          await sleep(500);
          continue;
        }

        const job = jobs[cursor];
        cursor += 1;
        await this.runJob(job);
      }
    };

    const workerCount = Math.min(this.concurrency, jobs.length);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);
  }
}
