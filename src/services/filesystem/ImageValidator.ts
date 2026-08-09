export interface ImageValidationResult {
  valid: boolean;
  message?: string;
}

export async function validateImageBlob(
  blob: Blob,
  expectedWidth: number,
  expectedHeight: number,
  strictSize = true
): Promise<ImageValidationResult> {
  if (blob.size <= 0) {
    return {
      valid: false,
      message: "图片 Blob 为空"
    };
  }

  try {
    const bitmap = await createImageBitmap(blob);
    const sizeValid =
      !strictSize ||
      (bitmap.width === expectedWidth && bitmap.height === expectedHeight);

    const message = sizeValid
      ? undefined
      : `图片尺寸不匹配，期望 ${expectedWidth}x${expectedHeight}，实际 ${bitmap.width}x${bitmap.height}`;

    bitmap.close();

    return {
      valid: sizeValid,
      message
    };
  } catch {
    return {
      valid: false,
      message: "图片无法被浏览器解码"
    };
  }
}
