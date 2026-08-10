import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
  ProviderRuntimeConfig
} from "@/types";

interface ReplicateProxyResponse {
  imageUrl?: string;
  predictionId?: string;
  error?: string;
}

function normalizeReplicateModel(model?: string): string {
  return (model || "black-forest-labs/flux-schnell").trim().replace(/^\/+/, "");
}

function getRetryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

function getProxyErrorMessage(response: Response, fallback?: string): string {
  if (response.status === 404 && !fallback) {
    return "Replicate 代理接口不存在。当前如果只用 npm run dev 启动，本地不会运行 Vercel Serverless API；请部署到 Vercel，或使用本地代理服务预览真实生成。";
  }

  return fallback ?? "Replicate 代理请求失败";
}

export class ReplicateProvider implements ImageProvider {
  id = "replicate";
  name = "Replicate";

  async generate(
    request: ImageGenerationRequest,
    config: ProviderRuntimeConfig
  ): Promise<ImageGenerationResult> {
    const response = await fetch("/api/replicate/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: request.prompt,
        negativePrompt: request.negativePrompt,
        width: request.width,
        height: request.height,
        seed: request.seed,
        model: normalizeReplicateModel(config.model || request.model),
        apiKey: config.apiKey
      })
    });
    const payload = (await response.json().catch(() => ({}))) as ReplicateProxyResponse;

    if (!response.ok || !payload.imageUrl) {
      const retryable = [429, 500, 502, 503, 504].includes(response.status);

      return {
        success: false,
        error: {
          code: `REPLICATE_${response.status}`,
          message: getProxyErrorMessage(response, payload.error),
          httpStatus: response.status,
          retryable,
          retryAfterMs: getRetryAfterMs(response)
        }
      };
    }

    return {
      success: true,
      imageUrl: payload.imageUrl,
      providerJobId: payload.predictionId
    };
  }
}
