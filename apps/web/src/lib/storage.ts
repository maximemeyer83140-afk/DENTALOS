import path from "node:path";

import { LocalDevStorageProvider, type StorageProvider } from "@dentalos/database";

/**
 * Where uploaded patient documents (ÉTAPE 5) actually land on disk in this environment —
 * `LocalDevStorageProvider` is dev-only (see its own doc comment in
 * packages/database/src/services/storage-provider.ts); swapping in an S3/Azure Blob
 * implementation for production only requires changing this one file, never the callers.
 */
export const uploadsRoot = path.join(process.cwd(), ".data", "uploads");

let provider: StorageProvider | undefined;

export function getStorageProvider(): StorageProvider {
  if (!provider) provider = new LocalDevStorageProvider(uploadsRoot);
  return provider;
}
