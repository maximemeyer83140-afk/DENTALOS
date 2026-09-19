import Link from "next/link";
import type { ReactNode } from "react";

import { listTasks, listUsersForClinic } from "@dentalos/database";
import type { TaskStatus } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";

import { TaskForm } from "./TaskForm";
import { TaskRow } from "./TaskRow";

const FILTERS = [
  { id: "open", label: "Ouvertes", statuses: ["open", "in_progress"] as TaskStatus[] },
  { id: "all", label: "Toutes", statuses: undefined },
] as const;

/**
 * ÉTAPE 11 : tâches internes du cabinet — checklist quotidienne partagée (relancer un labo,
 * préparer un dossier, rappeler une assurance) plutôt qu'une information qui reste dans la tête
 * d'une seule personne ou perdue dans un post-it (thème DentaGest : traçabilité des opérations).
 */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}): Promise<ReactNode> {
  const { filter: rawFilter } = await searchParams;
  const filter = FILTERS.find((f) => f.id === rawFilter) ?? FILTERS[0];

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "tasks.read");
  const [tasks, users] = await Promise.all([listTasks(ctx, { statuses: filter.statuses }), listUsersForClinic(ctx)]);
  const usersById = new Map(users.map((u) => [u.id, u.name]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueCount = tasks.filter((t) => t.dueAt && t.dueAt < today && t.status !== "done" && t.status !== "cancelled").length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <AppNav current="taches" />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tâches</h1>
          <p className="text-sm text-muted-foreground">
            {tasks.length} tâche(s){overdueCount > 0 ? ` · ${overdueCount} en retard` : ""}
          </p>
        </div>
        <Link href="/patients" className="text-sm font-medium text-primary hover:underline">
          ← Patients
        </Link>
      </div>

      <div className="mb-4">
        <TaskForm assignees={users} />
      </div>

      <nav className="mb-4 flex gap-1 border-b border-border" aria-label="Filtres des tâches">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/taches?filter=${f.id}`}
            aria-current={filter.id === f.id ? "page" : undefined}
            className={`px-3 py-2 text-sm font-medium ${
              filter.id === f.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Tâche</th>
              <th className="px-3 py-2">Assignée à</th>
              <th className="px-3 py-2">Priorité</th>
              <th className="px-3 py-2">Échéance</th>
              <th className="px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                assigneeName={task.assignedToUserId ? (usersById.get(task.assignedToUserId) ?? null) : null}
                isOverdue={Boolean(task.dueAt && task.dueAt < today && task.status !== "done" && task.status !== "cancelled")}
              />
            ))}
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucune tâche à afficher.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
