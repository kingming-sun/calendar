import type { ProviderError } from "@/types";
import { getRetryDecision, type RetryDecision } from "@/utils/retry";

export class RetryManager {
  getDecision(
    error: ProviderError,
    retryCount: number,
    maxRetries: number
  ): RetryDecision {
    return getRetryDecision(error, retryCount, maxRetries);
  }
}

export const retryManager = new RetryManager();
