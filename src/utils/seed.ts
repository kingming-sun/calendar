import type { SeedMode } from "@/types";

export function generateSeed(
  mode: SeedMode,
  baseSeed: number | undefined,
  setIndex: number,
  imageIndex: number
): number | undefined {
  if (mode === "random") {
    return Math.floor(Math.random() * 2_147_483_647);
  }

  if (mode === "fixed") {
    return baseSeed;
  }

  if (baseSeed === undefined) {
    return setIndex;
  }

  return baseSeed + setIndex + imageIndex - 1;
}
