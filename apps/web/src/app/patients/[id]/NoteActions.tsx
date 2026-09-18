"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";

import { finalizeNoteAction } from "./actions";

export function FinalizeNoteButton({ patientId, noteId }: { patientId: string; noteId: string }): ReactNode {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => finalizeNoteAction(patientId, noteId))}
      className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
    >
      Finaliser
    </button>
  );
}
