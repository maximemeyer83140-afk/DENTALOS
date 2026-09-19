"use client";

import type { ReactNode } from "react";
import { useActionState, useState, useTransition } from "react";

import { DOCUMENT_CATEGORY_LABEL, DOCUMENT_CATEGORY_OPTIONS } from "@/lib/documents";

import { setDocumentArchivedAction, updateDocumentAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface DocumentRowData {
  id: string;
  fileName: string;
  category: string;
  comment: string | null;
  isArchived: boolean;
  createdAt: Date;
  createdBy: string | null;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

export function DocumentRow({ patientId, document }: { patientId: string; document: DocumentRowData }): ReactNode {
  const [editing, setEditing] = useState(false);
  const boundUpdate = updateDocumentAction.bind(null, patientId, document.id);
  const [state, formAction, pending] = useActionState(boundUpdate, initialState);
  const [archiving, startArchiving] = useTransition();

  const viewHref = `/patients/${patientId}/documents/${document.id}`;
  const downloadHref = `${viewHref}?download=1`;

  return (
    <li className="rounded-md border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium text-foreground">{document.fileName}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {DOCUMENT_CATEGORY_LABEL[document.category] ?? document.category} · {formatDate(document.createdAt)}
            {document.createdBy ? ` · ${document.createdBy}` : ""}
            {document.isArchived ? " · archivé" : ""}
          </span>
          {document.comment ? <p className="mt-0.5 text-xs text-muted-foreground">{document.comment}</p> : null}
        </div>
        <div className="flex flex-shrink-0 items-center gap-3 text-xs font-medium">
          <a href={viewHref} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Visualiser
          </a>
          <a href={downloadHref} className="text-primary hover:underline">
            Télécharger
          </a>
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-muted-foreground hover:text-foreground">
            {editing ? "Fermer" : "Renommer / classer"}
          </button>
          <button
            type="button"
            disabled={archiving}
            onClick={() => startArchiving(() => setDocumentArchivedAction(patientId, document.id, !document.isArchived))}
            className="text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {document.isArchived ? "Désarchiver" : "Archiver"}
          </button>
        </div>
      </div>

      {editing ? (
        <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`fileName-${document.id}`} className="text-xs font-medium text-muted-foreground">
              Nom
            </label>
            <input
              id={`fileName-${document.id}`}
              name="fileName"
              defaultValue={document.fileName}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`category-${document.id}`} className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <select
              id={`category-${document.id}`}
              name="category"
              defaultValue={document.category}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              {DOCUMENT_CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[180px] flex-grow flex-col gap-1">
            <label htmlFor={`comment-${document.id}`} className="text-xs font-medium text-muted-foreground">
              Commentaire
            </label>
            <input
              id={`comment-${document.id}`}
              name="comment"
              defaultValue={document.comment ?? ""}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? "…" : "Enregistrer"}
          </button>
          {state.error ? (
            <p role="alert" className="w-full text-xs text-red-600">
              {state.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}
