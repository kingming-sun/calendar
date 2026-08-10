import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
  ProviderRuntimeConfig
} from "@/types";

interface BflSubmitResponse {
  requestId?: string;
  pollingUrl?: string;
  error?: string;
}

interface BflResultResponse {
  status?: string;
  imageUrl?: string;
  seed?: number;
  error?: string;
}

function getRetryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

function normalizeBflModel(model?: string): string {
  const value = model?.trim() || "flux-dev";

  if (value === "fal-ai/flux/dev" || value === "fal-ai/flux" || value === "flux") {
    return "flux-dev";
  }

  return value.replace(/^\/+/, "");
}

function getProxyErrorMessage(response: Response, fallback?: string): string {
  if (response.status === 404 && !fallback) {
    return "BFL 代理接口不存在。当前如果只用 npm run dev 启动，本地不会运行 Vercel Serverless API；请部署到 Vercel，或使用 vercel dev 预览真实生成。";
  }

  return fallback ?? "BFL 提交请求失败";
}

export class FluxProvider implements ImageProvider {
  id = "flux";
  name = "BFL FLUX";

  async generate(
    request: ImageGenerationRequest,
    config: ProviderRuntimeConfig
  ): Promise<ImageGenerationResult> {
    const submitResponse = await fetch("/api/bfl/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: request.prompt,
        width: request.width,
        height: request.height,
        seed: request.seed,
        model: normalizeBflModel(config.model || request.model),
        apiKey: config.apiKey
      })
    });

    const submitPayload = (await submitResponse.json().catch(() => ({}))) as BflSubmitResponse;

    if (!submitResponse.ok || !submitPayload.pollingUrl) {
      const retryable = [429, 500, 502, 503, 504].includes(submitResponse.status);

      return {
        success: false,
        error: {
          code: `BFL_SUBMIT_${submitResponse.status}`,
          message: getProxyErrorMessage(submitResponse, submitPayload.error),
          httpStatus: submitResponse.status,
          retryable,
          retryAfterMs: getRetryAfterMs(submitResponse)
        }
      };
    }

    const startedAt = Date.now();
    const timeoutMs = 180_000;

    while (Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));

      const resultResponse = await fetch("/api/bfl/result", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pollingUrl: submitPayload.pollingUrl,
          apiKey: config.apiKey
        })
      });
      const resultPayload = (await resultResponse.json().catch(
        () => ({})
      )) as BflResultResponse;

      if (!resultResponse.ok) {
        const retryable = [429, 500, 502, 503, 504].includes(resultResponse.status);

        return {
          success: false,
          error: {
            code: `BFL_RESULT_${resultResponse.status}`,
            message: resultPayload.error ?? "BFL 轮询请求失败",
            httpStatus: resultResponse.status,
            retryable,
            retryAfterMs: getRetryAfterMs(resultResponse)
          }
        };
      }

      if (resultPayload.imageUrl) {
        return {
          success: true,
          imageUrl: resultPayload.imageUrl,
          providerJobId: submitPayload.requestId,
          cost: undefined
        };
      }
    }

    return {
      success: false,
      error: {
        code: "BFL_TIMEOUT",
        message: "BFL 生成超时，请稍后重试或降低并发",
        retryable: true
      }
    };
  }
}
