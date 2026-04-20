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

function startsWithBytes(buffer: Uint8Array, signature: number[]): boolean {
  if (buffer.length < signature.length) {
    return false;
  }
  return signature.every((byte, index) => buffer[index] === byte);
}

function hasGifSignature(buffer: Uint8Array): boolean {
  return startsWithBytes(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWithBytes(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
}

function hasImageMagicNumber(buffer: Uint8Array, contentType: string, extension: string): boolean {
  if (contentType === "image/jpeg" || extension === "jpg" || extension === "jpeg") {
    return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
  }

  if (contentType === "image/png" || extension === "png") {
    return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }

  if (contentType === "image/webp" || extension === "webp") {
    return (
      startsWithBytes(buffer, [0x52, 0x49, 0x46, 0x46]) &&
      buffer.length >= 12 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }

  if (contentType === "image/gif" || extension === "gif") {
    return hasGifSignature(buffer);
  }

  return false;
}

function getNormalizedExtension(fileName: string): string {
  return fileName.split(".").pop()?.trim().toLowerCase() ?? "";
}

export function sanitizeStorageSegment(value: string, fallback = "temp"): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
  const collapsed = normalized.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return collapsed || fallback;
}

export async function validateImageFile(
  file: File,
  options: {
    maxSizeBytes: number;
    label: string;
  },
): Promise<string | null> {
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

  const headerBuffer = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!hasImageMagicNumber(headerBuffer, contentType, extension)) {
    return `${label} 파일 형식이 올바르지 않습니다. 실제 이미지 파일만 업로드할 수 있습니다.`;
  }

  return null;
}
