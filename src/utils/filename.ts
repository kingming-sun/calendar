export function padNumber(value: number, size: number): string {
  return String(value).padStart(size, "0");
}

export function getSetDirectoryName(setIndex: number): string {
  return `set_${padNumber(setIndex, 6)}`;
}

export function getImageFilename(imageIndex: number, extension = "jpg"): string {
  return `${padNumber(imageIndex, 2)}.${extension}`;
}

export function getBatchId(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  const parts = [
    date.getFullYear(),
    padNumber(date.getMonth() + 1, 2),
    padNumber(date.getDate(), 2),
    "_",
    padNumber(date.getHours(), 2),
    padNumber(date.getMinutes(), 2),
    padNumber(date.getSeconds(), 2)
  ];

  return `batch_${parts.join("")}`;
}

export function getJobId(
  batchId: string,
  setIndex: number,
  imageIndex: number
): string {
  return `job_${batchId}_${padNumber(setIndex, 6)}_${padNumber(imageIndex, 2)}`;
}
