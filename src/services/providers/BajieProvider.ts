import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
  ProviderRuntimeConfig
} from "@/types";

interface BajieProxyResponse {
  imageBase64?: string;
  imageUrl?: string;
  mimeType?: string;
  error?: string;
}

function normalizeBajieModel(model?: string): string {
  return (model || "gpt-image-2").trim().replace(/^\/+/, "");
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], {
    type: mimeType
  });
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
    return "Bajie API 代理接口不存在。当前如果只用 npm run dev 启动，本地不会运行 Vercel Serverless API；请部署到 Vercel，或使用本地代理服务预览真实生成。";
  }

  return fallback ?? "Bajie API 代理请求失败";
}

export class BajieProvider implements ImageProvider {
  id = "bajie";
  name = "Bajie GPT Image";

  async generate(
    request: ImageGenerationRequest,
    config: ProviderRuntimeConfig
  ): Promise<ImageGenerationResult> {
    const response = await fetch("/api/bajie/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: request.prompt,
        width: request.width,
        height: request.height,
        model: normalizeBajieModel(config.model || request.model),
        apiKey: config.apiKey
      })
    });
    const payload = (await response.json().catch(() => ({}))) as BajieProxyResponse;

    if (!response.ok || (!payload.imageBase64 && !payload.imageUrl)) {
      const retryable = [429, 500, 502, 503, 504].includes(response.status);

      return {
        success: false,
        error: {
          code: `BAJIE_${response.status}`,
          message: getProxyErrorMessage(response, payload.error),
          httpStatus: response.status,
          retryable,
          retryAfterMs: getRetryAfterMs(response)
        }
      };
    }

    return {
      success: true,
      imageBlob: payload.imageBase64
        ? base64ToBlob(payload.imageBase64, payload.mimeType ?? "image/png")
        : undefined,
      imageUrl: payload.imageUrl
    };
  }
}
