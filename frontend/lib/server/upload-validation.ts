const IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

export const MAX_ACTIVITY_IMAGE_COUNT = 5;
export const MAX_ACTIVITY_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_AVATAR_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

function getNormalizedExtension(fileName: string): string {
  return fileName.split(".").pop()?.trim().toLowerCase() ?? "";
}

export function sanitizeStorageSegment(value: string, fallback = "temp"): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
  const collapsed = normalized.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return collapsed || fallback;
}

export function validateImageFile(
  file: File,
  options: {
    maxSizeBytes: number;
    label: string;
  },
): string | null {
  const { maxSizeBytes, label } = options;

  if (!file.name.trim()) {
    return `${label} 파일 이름이 올바르지 않습니다.`;
  }

  const extension = getNormalizedExtension(file.name);
  const contentType = file.type.trim().toLowerCase();

  if (!IMAGE_EXTENSIONS.has(extension) || !IMAGE_CONTENT_TYPES.has(contentType)) {
    return `${label}은 JPG, PNG, WEBP, GIF 형식만 업로드할 수 있습니다.`;
  }

  if (file.size <= 0) {
    return `${label} 파일이 비어 있습니다.`;
  }

  if (file.size > maxSizeBytes) {
    return `${label} 파일 크기는 ${(maxSizeBytes / 1024 / 1024).toFixed(0)}MB 이하만 허용됩니다.`;
  }

  return null;
}
