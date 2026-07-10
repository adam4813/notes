import { describe, expect, it } from "vitest";
import {
  extensionForFile,
  extensionForImageMime,
  importedFilePath,
  isImagePath,
  markdownForImportedFile,
  normalizeMediaDirectory,
} from "./images";

describe("isImagePath", () => {
  it("detects image extensions", () => {
    expect(isImagePath("media/example.png")).toBe(true);
    expect(isImagePath("MEDIA/photo.JPEG")).toBe(true);
    expect(isImagePath("notes/readme.md")).toBe(false);
  });
});

describe("normalizeMediaDirectory", () => {
  it("normalizes separators and strips empty segments", () => {
    expect(normalizeMediaDirectory("  \\assets\\images// ")).toBe("assets/images");
  });

  it("falls back to media when empty", () => {
    expect(normalizeMediaDirectory("   ")).toBe("media");
  });
});

describe("extensionForImageMime", () => {
  it("maps known image mimes to extensions", () => {
    expect(extensionForImageMime("image/jpeg")).toBe(".jpg");
    expect(extensionForImageMime("image/png")).toBe(".png");
  });

  it("defaults unknown mime types to png", () => {
    expect(extensionForImageMime("image/x-custom")).toBe(".png");
  });
});

describe("extensionForFile", () => {
  it("prefers file-name extension when present", () => {
    expect(extensionForFile({ name: "song.mp3", type: "audio/mpeg" })).toBe(".mp3");
  });

  it("falls back to mime extension", () => {
    expect(extensionForFile({ name: "blob", type: "text/plain" })).toBe(".txt");
  });
});

describe("importedFilePath", () => {
  it("builds a normalized media path for imported files", () => {
    const path = importedFilePath({ name: "My Sound.wav", type: "audio/wav" }, " assets ");
    expect(path).toMatch(/^assets\/my-sound-\d{14}-[0-9a-f]{10}\.wav$/);
  });
});

describe("markdownForImportedFile", () => {
  it("creates image markdown for image files", () => {
    expect(markdownForImportedFile("media/pic.png", "image/png", "/api/file/raw?path=media%2Fpic.png")).toBe(
      '<img src="/api/file/raw?path=media%2Fpic.png" alt="pic.png">',
    );
  });

  it("creates audio embed html for audio files", () => {
    expect(markdownForImportedFile("media/sound.mp3", "audio/mpeg", "/api/file/raw?path=media%2Fsound.mp3")).toBe(
      '<audio controls src="/api/file/raw?path=media%2Fsound.mp3"></audio>',
    );
  });
});
