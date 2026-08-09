import type { ProviderError } from "@/types";

export interface RetryDecision {
  shouldRetry: boolean;
  delayMs: number;
  reason: string;
}

const defaultDelays = [5_000, 30_000, 120_000];

export function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

export function getRetryDecision(
  error: ProviderError,
  retryCount: number,
  maxRetries: number
): RetryDecision {
  if (!error.retryable || retryCount >= maxRetries) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: error.retryable ? "已达到最大重试次数" : "错误不可重试"
    };
  }

  return {
    shouldRetry: true,
    delayMs: error.retryAfterMs ?? defaultDelays[retryCount] ?? 120_000,
    reason: error.retryAfterMs ? "遵循 Provider Retry-After" : "指数退避重试"
  };
}
