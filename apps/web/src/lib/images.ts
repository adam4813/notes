const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".csv", ".json", ".xml", ".yml", ".yaml"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"]);

const MIME_EXTENSION: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/bmp": ".bmp",
  "image/svg+xml": ".svg",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "audio/aac": ".aac",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "application/json": ".json",
  "text/csv": ".csv",
};

export function isImagePath(path: string): boolean {
  const lower = path.toLowerCase();
  for (const ext of IMAGE_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

export function normalizeMediaDirectory(input: string): string {
  const replaced = input.trim().replace(/\\/g, "/");
  const cleaned = replaced
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== ".");
  return cleaned.length > 0 ? cleaned.join("/") : "media";
}

export function extensionForImageMime(type: string): string {
  return MIME_EXTENSION[type.toLowerCase()] ?? ".png";
}

export function extensionForFile(file: Pick<File, "name" | "type">): string {
  const dot = file.name.lastIndexOf(".");
  if (dot > 0 && dot < file.name.length - 1) {
    const ext = file.name.slice(dot).toLowerCase();
    if (/^\.[a-z0-9]+$/.test(ext)) {
      return ext;
    }
  }
  return MIME_EXTENSION[file.type.toLowerCase()] ?? ".bin";
}

function normalizeNameStem(name: string): string {
  const stripped = name.replace(/\.[^.]+$/, "");
  const safe = stripped
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return safe || "file";
}

export function importedFilePath(file: Pick<File, "name" | "type">, mediaDirectory: string): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const ext = extensionForFile(file);
  const stem = normalizeNameStem(file.name);
  return `${normalizeMediaDirectory(mediaDirectory)}/${stem}-${stamp}-${randomSuffix()}${ext}`;
}

export function markdownForImportedFile(path: string, mimeType: string, rawUrl: string): string {
  const lower = path.toLowerCase();
  const title = path.split("/").pop() ?? "file";
  if (isImagePath(lower) || mimeType.startsWith("image/")) {
    return `<img src="${rawUrl}" alt="${title}">`;
  }
  if (mimeType.startsWith("audio/") || [...AUDIO_EXTENSIONS].some((ext) => lower.endsWith(ext))) {
    return `<audio controls src="${rawUrl}"></audio>`;
  }
  if (mimeType.startsWith("video/") || [...VIDEO_EXTENSIONS].some((ext) => lower.endsWith(ext))) {
    return `<video controls src="${rawUrl}"></video>`;
  }
  if (mimeType.startsWith("text/") || [...TEXT_EXTENSIONS].some((ext) => lower.endsWith(ext))) {
    return `[${title}](${rawUrl})`;
  }
  return `[${title}](${rawUrl})`;
}

export function randomSuffix(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    const slice = bytes.subarray(index, index + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}
