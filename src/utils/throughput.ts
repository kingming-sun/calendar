export function estimateDailyImages(concurrency: number, secondsPerImage: number): number {
  if (concurrency <= 0 || secondsPerImage <= 0) {
    return 0;
  }

  return Math.floor((86_400 * concurrency) / secondsPerImage);
}

export function estimateRequiredConcurrency(
  targetImagesPerDay: number,
  secondsPerImage: number
): number {
  if (targetImagesPerDay <= 0 || secondsPerImage <= 0) {
    return 0;
  }

  return Math.ceil((targetImagesPerDay * secondsPerImage) / 86_400);
}
