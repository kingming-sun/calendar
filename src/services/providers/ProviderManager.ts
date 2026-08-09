import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
  ProviderRuntimeConfig
} from "@/types";
import { MockProvider } from "./MockProvider";

export class ProviderManager {
  private providers = new Map<string, ImageProvider>();

  constructor(initialProviders: ImageProvider[] = [new MockProvider()]) {
    initialProviders.forEach((provider) => {
      this.providers.set(provider.id, provider);
    });
  }

  list(): ImageProvider[] {
    return Array.from(this.providers.values());
  }

  get(providerId: string): ImageProvider {
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new Error(
        `服务商尚未接入真实 API：${providerId}。当前可执行生成的只有“模拟图片服务（测试用）”。`
      );
    }

    return provider;
  }

  async generate(
    providerId: string,
    request: ImageGenerationRequest,
    config: ProviderRuntimeConfig
  ): Promise<ImageGenerationResult> {
    return this.get(providerId).generate(request, config);
  }
}

export const providerManager = new ProviderManager();
