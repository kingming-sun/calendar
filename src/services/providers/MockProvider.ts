import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
  ProviderRuntimeConfig
} from "@/types";

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hashText(value: string): number {
  return Array.from(value).reduce(
    (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
    7
  );
}

function createMockImageBlob(request: ImageGenerationRequest): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = request.width;
  canvas.height = request.height;

  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new Error("无法创建 Canvas 上下文"));
  }

  const hash = hashText(`${request.prompt}_${request.seed ?? ""}`);
  const hue = hash % 360;
  const gradient = context.createLinearGradient(0, 0, request.width, request.height);
  gradient.addColorStop(0, `hsl(${hue}, 42%, 12%)`);
  gradient.addColorStop(0.48, `hsl(${(hue + 28) % 360}, 48%, 24%)`);
  gradient.addColorStop(1, `hsl(${(hue + 92) % 360}, 86%, 52%)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, request.width, request.height);

  context.fillStyle = "rgba(255, 255, 255, 0.12)";
  for (let index = 0; index < 16; index += 1) {
    context.beginPath();
    context.arc(
      randomBetween(0, request.width),
      randomBetween(0, request.height),
      randomBetween(20, 120),
      0,
      Math.PI * 2
    );
    context.fill();
  }

  context.fillStyle = "#f6b443";
  context.font = `${Math.max(24, Math.floor(request.width / 18))}px sans-serif`;
  context.fillText("测试占位图", 48, 96);

  context.fillStyle = "rgba(255, 255, 255, 0.88)";
  context.font = `${Math.max(16, Math.floor(request.width / 38))}px sans-serif`;
  const prompt = request.prompt.slice(0, 90);
  context.fillText("模拟图片服务不会调用真实 AI", 48, 150);
  context.fillText(prompt, 48, 200);
  context.fillText(`${request.width} x ${request.height}`, 48, 250);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas 导出图片失败"));
        return;
      }

      resolve(blob);
    }, "image/jpeg", 0.92);
  });
}

export class MockProvider implements ImageProvider {
  id = "mock";
  name = "MockProvider";

  async generate(
    request: ImageGenerationRequest,
    _config: ProviderRuntimeConfig
  ): Promise<ImageGenerationResult> {
    const delay = randomBetween(300, 1200);
    await new Promise((resolve) => window.setTimeout(resolve, delay));

    const roll = Math.random();
    if (roll < 0.015) {
      return {
        success: false,
        error: {
          code: "MOCK_429",
          message: "MockProvider 模拟 429 限流",
          httpStatus: 429,
          retryable: true,
          retryAfterMs: 1500
        }
      };
    }

    if (roll < 0.03) {
      return {
        success: false,
        error: {
          code: "MOCK_NETWORK",
          message: "MockProvider 模拟网络错误",
          retryable: true
        }
      };
    }

    const imageBlob = await createMockImageBlob(request);

    return {
      success: true,
      imageBlob,
      cost: 0,
      providerJobId: `mock_${crypto.randomUUID()}`
    };
  }
}
