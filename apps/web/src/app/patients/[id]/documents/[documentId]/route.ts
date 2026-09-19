import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { getDocument } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { uploadsRoot } from "@/lib/storage";

/**
 * Streams one patient document's bytes back (ÉTAPE 5's "visualiser"/"télécharger"). The document
 * is always resolved through `getDocument`'s tenant-scoped lookup and then checked against the
 * `patientId` in the URL, so a guessed or copy-pasted document id can never serve a file belonging
 * to a different patient or a different organization ("ne pas mélanger les fichiers de différents
 * patients"). `?download=1` switches the disposition from inline (view in the browser) to
 * attachment (save to disk) — same file, same route, no separate download endpoint to keep in sync.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> },
): Promise<NextResponse> {
  const { id: patientId, documentId } = await params;

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "patients.read");
  const document = await getDocument(ctx, documentId);

  if (document.patientId !== patientId) {
    return new NextResponse("Document not found", { status: 404 });
  }

  const filePath = path.join(uploadsRoot, document.storageKey);
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return new NextResponse("File missing from storage", { status: 404 });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const safeFileName = document.fileName.replace(/["\r\n]/g, "");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeFileName}"`,
      "Content-Length": String(document.sizeBytes),
      "Cache-Control": "private, no-store",
    },
  });
}
