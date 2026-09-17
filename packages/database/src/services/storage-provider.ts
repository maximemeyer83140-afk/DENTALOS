import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * File storage abstraction (ARCHITECTURE.md §8): application code never calls a storage SDK
 * directly, only this interface. Swap `LocalDevStorageProvider` for an S3/Azure Blob
 * implementation when a real environment is chosen — no caller changes.
 */
export interface UploadInput {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  organizationId: string;
}

export interface UploadResult {
  storageKey: string;
  sizeBytes: number;
  contentHash: string;
}

export interface StorageProvider {
  upload(input: UploadInput): Promise<UploadResult>;
  /** Returns a URL the caller can use to fetch the file. May be time-limited depending on provider. */
  getUrl(storageKey: string): Promise<string>;
}

/**
 * Development-only local disk storage. Never used in production — there is no encryption at
 * rest, no access control on the files themselves, and no durability guarantee. A real deployment
 * must supply an S3/Azure Blob (or equivalent) implementation of `StorageProvider` before any real
 * patient document is stored (see SECURITY.md).
 */
export class LocalDevStorageProvider implements StorageProvider {
  constructor(private readonly rootDir: string) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("LocalDevStorageProvider must never be used with NODE_ENV=production");
    }
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const contentHash = createHash("sha256").update(input.buffer).digest("hex");
    const storageKey = `${input.organizationId}/${randomUUID()}-${input.fileName}`;
    const destination = join(this.rootDir, storageKey);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, input.buffer);
    return { storageKey, sizeBytes: input.buffer.byteLength, contentHash };
  }

  async getUrl(storageKey: string): Promise<string> {
    return `file://${join(this.rootDir, storageKey)}`;
  }
}
