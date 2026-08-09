import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
  ProviderRuntimeConfig
} from "@/types";

interface GeminiProxyResponse {
  imageBase64?: string;
  mimeType?: string;
  responseId?: string;
  error?: string;
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

function normalizeGeminiModel(model?: string): string {
  return (model || "gemini-2.5-flash-image-preview").trim().replace(/^\/+/, "");
}

function getRetryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

export class GeminiProvider implements ImageProvider {
  id = "gemini";
  name = "Gemini Image";

  async generate(
    request: ImageGenerationRequest,
    config: ProviderRuntimeConfig
  ): Promise<ImageGenerationResult> {
    const response = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: request.prompt,
        model: normalizeGeminiModel(config.model || request.model),
        apiKey: config.apiKey
      })
    });
    const payload = (await response.json().catch(() => ({}))) as GeminiProxyResponse;

    if (!response.ok) {
      const retryable = [429, 500, 502, 503, 504].includes(response.status);

      return {
        success: false,
        error: {
          code: `GEMINI_${response.status}`,
          message: payload.error ?? "Gemini 代理请求失败",
          httpStatus: response.status,
          retryable,
          retryAfterMs: getRetryAfterMs(response)
        }
      };
    }

    if (!payload.imageBase64) {
      return {
        success: false,
        error: {
          code: "GEMINI_EMPTY_IMAGE",
          message: "Gemini 响应中没有图片数据",
          retryable: true
        }
      };
    }

    return {
      success: true,
      imageBlob: base64ToBlob(payload.imageBase64, payload.mimeType ?? "image/png"),
      providerJobId: payload.responseId
    };
  }
}
