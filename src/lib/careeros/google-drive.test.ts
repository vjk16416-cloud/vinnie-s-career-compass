import { describe, expect, it, vi } from "vitest";

import {
  DRIVE_READONLY_SCOPE,
  extractDriveFolderId,
  listDriveFolderFiles,
  startGoogleDriveConnection,
} from "./google-drive";

describe("Google Drive integration", () => {
  it("requests read-only Drive permission explicitly", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });
    const result = await startGoogleDriveConnection(
      "/settings",
      () => ({ auth: { signInWithOAuth } }) as never,
      "https://careeros.example",
    );

    expect(result).toEqual({ error: null });
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: expect.objectContaining({
        scopes: DRIVE_READONLY_SCOPE,
        queryParams: expect.objectContaining({ prompt: "consent" }),
      }),
    });
  });

  it("extracts a folder id from either a Drive URL or a raw id", () => {
    expect(
      extractDriveFolderId("https://drive.google.com/drive/folders/folder-123?usp=sharing"),
    ).toBe("folder-123");
    expect(extractDriveFolderId("folder-456")).toBe("folder-456");
    expect(extractDriveFolderId("https://drive.google.com/file/d/file-123/view")).toBeNull();
  });

  it("lists files with a bearer token and never requests write access", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        files: [
          {
            id: "file-1",
            name: "Master Career Profile",
            mimeType: "application/vnd.google-apps.document",
            modifiedTime: "2026-08-20T10:00:00Z",
            webViewLink: "https://drive.google.com/open?id=file-1",
          },
        ],
      }),
    });

    const files = await listDriveFolderFiles("folder-123", "provider-token", fetcher as never);

    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe("Master Career Profile");
    const [url, options] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toContain("drive/v3/files");
    expect(String(url)).toContain("folder-123");
    expect(options).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer provider-token" },
      }),
    );
  });

  it("fails safely when Drive denies the request", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 403 });

    await expect(listDriveFolderFiles("folder-123", "bad-token", fetcher as never)).rejects.toThrow(
      "CareerOS could not read that Google Drive folder.",
    );
  });
});
