import type { ProviderPricing } from "@/types";

export function estimateImageCost(
  totalImages: number,
  width: number,
  height: number,
  pricing: ProviderPricing
): number {
  if (pricing.pricePerImage !== undefined) {
    return totalImages * pricing.pricePerImage;
  }

  if (pricing.pricePerMegapixel !== undefined) {
    const megapixels = (width * height) / 1_000_000;
    return totalImages * megapixels * pricing.pricePerMegapixel;
  }

  return 0;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}
