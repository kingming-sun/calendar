import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
  ProviderRuntimeConfig
} from "@/types";

interface FalImage {
  url?: string;
  content_type?: string;
  width?: number;
  height?: number;
}

interface FalFluxResponse {
  images?: FalImage[];
  seed?: number;
  prompt?: string;
  detail?: string | Array<{ msg?: string }>;
  message?: string;
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

function getFalErrorMessage(payload: FalFluxResponse): string {
  const rawMessage =
    typeof payload.detail === "string"
      ? payload.detail
      : payload.message ?? payload.error;

  if (rawMessage?.includes("Authentication is required")) {
    return "fal.ai 认证失败或模型端点不可访问。请确认 API Key 有效，并且模型填写为 fal-ai/flux/dev。";
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  if (Array.isArray(payload.detail)) {
    return payload.detail.map((item) => item.msg).filter(Boolean).join("；");
  }

  return payload.message ?? payload.error ?? "fal.ai 请求失败";
}

function normalizeFalEndpoint(model?: string): string {
  const endpoint = model?.trim() || "fal-ai/flux/dev";

  if (endpoint === "fal-ai/flux") {
    return "fal-ai/flux/dev";
  }

  return endpoint;
}

export class FluxProvider implements ImageProvider {
  id = "flux";
  name = "fal.ai FLUX";

  async generate(
    request: ImageGenerationRequest,
    config: ProviderRuntimeConfig
  ): Promise<ImageGenerationResult> {
    if (!config.apiKey) {
      return {
        success: false,
        error: {
          code: "FAL_API_KEY_MISSING",
          message: "请先在设置页为 fal.ai FLUX 填写 API Key",
          retryable: false
        }
      };
    }

    const apiKey = config.apiKey.trim();
    if (!apiKey.includes(":")) {
      return {
        success: false,
        error: {
          code: "FAL_API_KEY_INCOMPLETE",
          message:
            "当前保存的 fal.ai API Key 看起来不是完整 Key。请在 fal.ai 新建 Key，并复制完整的 key_id:key_secret，而不是只复制 Key ID。",
          retryable: false
        }
      };
    }

    const endpoint = normalizeFalEndpoint(config.model || request.model);
    const response = await fetch(`https://fal.run/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: request.prompt,
        image_size: {
          width: request.width,
          height: request.height
        },
        num_images: 1,
        seed: request.seed,
        output_format: "jpeg",
        enable_safety_checker: true
      })
    });

    const payload = (await response.json().catch(() => ({}))) as FalFluxResponse;

    if (!response.ok) {
      const retryable = [429, 500, 502, 503, 504].includes(response.status);

      return {
        success: false,
        error: {
          code: `FAL_${response.status}`,
          message: getFalErrorMessage(payload),
          httpStatus: response.status,
          retryable,
          retryAfterMs: getRetryAfterMs(response)
        }
      };
    }

    const imageUrl = payload.images?.[0]?.url;
    if (!imageUrl) {
      return {
        success: false,
        error: {
          code: "FAL_EMPTY_IMAGE",
          message: "fal.ai 响应中没有图片 URL",
          retryable: true
        }
      };
    }

    return {
      success: true,
      imageUrl,
      providerJobId: payload.seed ? `fal_flux_${payload.seed}` : undefined
    };
  }
}
