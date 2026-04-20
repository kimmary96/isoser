const IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_IMAGE_DIMENSION = 8000;

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

function readBigEndian16(buffer: Uint8Array, offset: number): number {
  return (buffer[offset] << 8) | buffer[offset + 1];
}

function readLittleEndian16(buffer: Uint8Array, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8);
}

function readLittleEndian24(buffer: Uint8Array, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readLittleEndian32(buffer: Uint8Array, offset: number): number {
  return (
    buffer[offset] |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16) |
    (buffer[offset + 3] << 24)
  ) >>> 0;
}

function parsePngDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  return {
    width:
      (buffer[16] << 24) |
      (buffer[17] << 16) |
      (buffer[18] << 8) |
      buffer[19],
    height:
      (buffer[20] << 24) |
      (buffer[21] << 16) |
      (buffer[22] << 8) |
      buffer[23],
  };
}

function parseGifDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 10) return null;
  return {
    width: readLittleEndian16(buffer, 6),
    height: readLittleEndian16(buffer, 8),
  };
}

function parseWebpDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 30) return null;

  const chunkType = String.fromCharCode(buffer[12], buffer[13], buffer[14], buffer[15]);
  if (chunkType === "VP8 ") {
    if (buffer.length < 30) return null;
    return {
      width: readLittleEndian16(buffer, 26) & 0x3fff,
      height: readLittleEndian16(buffer, 28) & 0x3fff,
    };
  }

  if (chunkType === "VP8L") {
    if (buffer.length < 25) return null;
    const bits = readLittleEndian32(buffer, 21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  if (chunkType === "VP8X") {
    if (buffer.length < 30) return null;
    return {
      width: readLittleEndian24(buffer, 24) + 1,
      height: readLittleEndian24(buffer, 27) + 1,
    };
  }

  return null;
}

function parseJpegDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    const segmentLength = readBigEndian16(buffer, offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) {
      return null;
    }

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      return {
        height: readBigEndian16(buffer, offset + 5),
        width: readBigEndian16(buffer, offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function parseImageDimensions(
  buffer: Uint8Array,
  contentType: string,
  extension: string
): { width: number; height: number } | null {
  if (contentType === "image/png" || extension === "png") {
    return parsePngDimensions(buffer);
  }

  if (contentType === "image/gif" || extension === "gif") {
    return parseGifDimensions(buffer);
  }

  if (contentType === "image/webp" || extension === "webp") {
    return parseWebpDimensions(buffer);
  }

  if (contentType === "image/jpeg" || extension === "jpg" || extension === "jpeg") {
    return parseJpegDimensions(buffer);
  }

  return null;
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

  const inspectionBuffer = new Uint8Array(await file.slice(0, 262144).arrayBuffer());
  const headerBuffer = inspectionBuffer.subarray(0, 32);
  if (!hasImageMagicNumber(headerBuffer, contentType, extension)) {
    return `${label} 파일 형식이 올바르지 않습니다. 실제 이미지 파일만 업로드할 수 있습니다.`;
  }

  const dimensions = parseImageDimensions(inspectionBuffer, contentType, extension);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    return `${label} 이미지 크기 정보를 읽을 수 없습니다. 정상 이미지 파일만 업로드할 수 있습니다.`;
  }

  if (dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION) {
    return `${label} 이미지 해상도는 ${MAX_IMAGE_DIMENSION}px 이하만 허용됩니다.`;
  }

  return null;
}
