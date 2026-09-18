"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";

import type { AppointmentStatus } from "@dentalos/database";

import { layoutDayAppointments } from "@/lib/agenda-layout";

import { AppointmentModal, type AppointmentModalInitial } from "./AppointmentModal";
import { rescheduleAppointmentByDragAction } from "./actions";

export type ViewMode = "day" | "week";

export interface AppointmentDTO {
  id: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  notes: string | null;
  patient: { id: string; name: string } | null;
  practitioner: { id: string; name: string };
  room: { id: string; name: string } | null;
  appointmentType: { id: string; name: string; color: string | null } | null;
}

export interface SimpleOption {
  id: string;
  name: string;
}

export interface AppointmentTypeOption extends SimpleOption {
  color: string | null;
  defaultDurationMinutes: number;
}

const START_HOUR = 7;
const END_HOUR = 20;
const SLOT_MINUTES = 15;
const ROW_PX = 20; // one 15-min row's height — an hour is 4 rows = 80px
const SLOTS_PER_COLUMN = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const COLUMN_HEIGHT_PX = SLOTS_PER_COLUMN * ROW_PX;

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Planifié",
  confirmed: "Confirmé",
  arrived: "Arrivé",
  in_chair: "En fauteuil",
  completed: "Terminé",
  cancelled: "Annulé",
  no_show: "Absent",
};

const STATUS_DOT: Record<AppointmentStatus, string> = {
  scheduled: "#94A3B8",
  confirmed: "#2563EB",
  arrived: "#D97706",
  in_chair: "#7C3AED",
  completed: "#059669",
  cancelled: "#94A3B8",
  no_show: "#DC2626",
};

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function toDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function minutesFromStart(date: Date): number {
  return (date.getHours() - START_HOUR) * 60 + date.getMinutes();
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

interface ColumnDef {
  key: string;
  date: Date;
  label: string;
  sublabel?: string;
  practitionerId?: string;
}

interface CreatePrefill {
  date: Date;
  startTime: string;
  practitionerId?: string;
}

export function AgendaClient({
  view,
  anchorDate,
  rangeStartIso,
  appointments,
  practitioners,
  rooms,
  appointmentTypes,
}: {
  view: ViewMode;
  anchorDate: string;
  rangeStartIso: string;
  appointments: AppointmentDTO[];
  practitioners: SimpleOption[];
  rooms: SimpleOption[];
  appointmentTypes: AppointmentTypeOption[];
}): ReactNode {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [modal, setModal] = useState<
    | { mode: "create"; prefill: CreatePrefill }
    | { mode: "edit"; appointment: AppointmentDTO }
    | null
  >(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  const anchor = parseIsoDate(anchorDate);
  const rangeStart = new Date(rangeStartIso);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const columns: ColumnDef[] = useMemo(() => {
    if (view === "week") {
      return Array.from({ length: 7 }, (_, i) => {
        const date = addDays(rangeStart, i);
        return {
          key: toDateParam(date),
          date,
          label: DAY_NAMES[date.getDay()]!,
          sublabel: String(date.getDate()),
        };
      });
    }
    if (practitioners.length === 0) {
      return [{ key: "all", date: anchor, label: "Cabinet" }];
    }
    return practitioners.map((p) => ({ key: p.id, date: anchor, label: p.name, practitionerId: p.id }));
  }, [view, rangeStart, anchor, practitioners]);

  const appointmentsByColumn = useMemo(() => {
    const map = new Map<string, AppointmentDTO[]>();
    for (const col of columns) map.set(col.key, []);
    for (const appt of appointments) {
      const start = new Date(appt.startAt);
      if (view === "week") {
        const key = toDateParam(start);
        map.get(key)?.push(appt);
      } else {
        const key = appt.practitioner.id;
        if (map.has(key)) map.get(key)!.push(appt);
        else map.get(columns[0]?.key ?? "all")?.push(appt);
      }
    }
    return map;
  }, [columns, appointments, view]);

  function navigate(nextView: ViewMode, date: Date): void {
    router.push(`/agenda?view=${nextView}&date=${toDateParam(date)}`);
  }

  function goToday(): void {
    navigate(view, today);
  }

  function goPrevious(): void {
    navigate(view, view === "day" ? addDays(anchor, -1) : addDays(rangeStart, -7));
  }

  function goNext(): void {
    navigate(view, view === "day" ? addDays(anchor, 1) : addDays(rangeStart, 7));
  }

  function openCreateAt(column: ColumnDef, slotIndex: number): void {
    const minutes = slotIndex * SLOT_MINUTES;
    const startTime = `${String(START_HOUR + Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    setModal({ mode: "create", prefill: { date: column.date, startTime, practitionerId: column.practitionerId } });
  }

  function handleDrop(column: ColumnDef, slotIndex: number, appointmentId: string): void {
    const appt = appointments.find((a) => a.id === appointmentId);
    if (!appt) return;
    const durationMs = new Date(appt.endAt).getTime() - new Date(appt.startAt).getTime();
    const minutes = slotIndex * SLOT_MINUTES;
    const newStart = new Date(column.date);
    newStart.setHours(START_HOUR + Math.floor(minutes / 60), minutes % 60, 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);

    setDropError(null);
    startTransition(async () => {
      const result = await rescheduleAppointmentByDragAction(appointmentId, newStart, newEnd);
      if (result.error) setDropError(result.error);
      router.refresh();
    });
  }

  const hourMarks = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Agenda</h1>
          <div className="flex rounded-md border border-border p-0.5 text-sm">
            <Link
              href={`/agenda?view=day&date=${anchorDate}`}
              className={`rounded px-3 py-1 font-medium ${view === "day" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              Jour
            </Link>
            <Link
              href={`/agenda?view=week&date=${anchorDate}`}
              className={`rounded px-3 py-1 font-medium ${view === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              Semaine
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goPrevious}
            aria-label="Période précédente"
            className="rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            ←
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Période suivante"
            className="rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            →
          </button>
          <input
            type="date"
            value={anchorDate}
            onChange={(e) => e.target.value && navigate(view, parseIsoDate(e.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            aria-label="Aller à une date précise"
          />
          <span className="px-1 text-sm font-medium text-foreground">
            {view === "day"
              ? new Intl.DateTimeFormat("fr-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(anchor)
              : `${new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short" }).format(rangeStart)} – ${new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", year: "numeric" }).format(addDays(rangeStart, 6))}`}
          </span>
          <button
            type="button"
            onClick={() =>
              setModal({
                mode: "create",
                prefill: { date: view === "day" ? anchor : today, startTime: "09:00", practitionerId: columns[0]?.practitionerId },
              })
            }
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            + Nouveau rendez-vous
          </button>
        </div>
      </div>

      {dropError ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
          {dropError}
          <button type="button" onClick={() => setDropError(null)} className="ml-2 underline">
            fermer
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <div className="flex min-w-[720px]">
          <div className="w-14 flex-shrink-0 border-r border-border bg-muted/30">
            <div className="h-12 border-b border-border" />
            <div style={{ height: COLUMN_HEIGHT_PX }} className="relative">
              {hourMarks.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-1.5 -translate-y-2 text-xs font-medium text-muted-foreground"
                  style={{ top: ((hour - START_HOUR) * 60 * ROW_PX) / SLOT_MINUTES }}
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>
          </div>

          {columns.map((column) => {
            const columnAppointments = appointmentsByColumn.get(column.key) ?? [];
            const layout = layoutDayAppointments(
              columnAppointments.map((a) => ({ id: a.id, startAt: new Date(a.startAt), endAt: new Date(a.endAt) })),
            );
            const layoutById = new Map(layout.map((l) => [l.id, l]));
            const isToday = isSameDay(column.date, today);

            return (
              <div key={column.key} className="min-w-[150px] flex-1 border-r border-border last:border-r-0">
                <div className={`flex h-12 flex-col items-center justify-center border-b border-border text-sm ${isToday ? "bg-primary/10" : ""}`}>
                  <span className={`font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>{column.label}</span>
                  {column.sublabel ? (
                    <span className={`text-xs ${isToday ? "text-primary" : "text-muted-foreground"}`}>{column.sublabel}</span>
                  ) : null}
                </div>

                <div className="relative" style={{ height: COLUMN_HEIGHT_PX }}>
                  {/* Hour gridlines + clickable/droppable empty slots */}
                  {Array.from({ length: SLOTS_PER_COLUMN }, (_, slotIndex) => (
                    <button
                      key={slotIndex}
                      type="button"
                      onClick={() => openCreateAt(column, slotIndex)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/plain");
                        if (id) handleDrop(column, slotIndex, id);
                        setDraggingId(null);
                      }}
                      className={`absolute inset-x-0 w-full border-t ${slotIndex % 4 === 0 ? "border-border" : "border-border/40"} hover:bg-accent-soft`}
                      style={{ top: slotIndex * ROW_PX, height: ROW_PX }}
                      aria-label={`Créer un rendez-vous à ${String(START_HOUR + Math.floor((slotIndex * SLOT_MINUTES) / 60)).padStart(2, "0")}:${String((slotIndex * SLOT_MINUTES) % 60).padStart(2, "0")}`}
                    />
                  ))}

                  {columnAppointments.map((appt) => {
                    const start = new Date(appt.startAt);
                    const end = new Date(appt.endAt);
                    const top = (minutesFromStart(start) / SLOT_MINUTES) * ROW_PX;
                    const height = Math.max(((end.getTime() - start.getTime()) / 60000 / SLOT_MINUTES) * ROW_PX, ROW_PX * 0.9);
                    const lane = layoutById.get(appt.id);
                    const laneCount = lane?.laneCount ?? 1;
                    const laneIndex = lane?.lane ?? 0;
                    const color = appt.appointmentType?.color ?? "#64748B";
                    const isCancelled = appt.status === "cancelled" || appt.status === "no_show";

                    return (
                      <button
                        key={appt.id}
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", appt.id);
                          setDraggingId(appt.id);
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        onClick={() => setModal({ mode: "edit", appointment: appt })}
                        className={`group absolute z-[1] overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left shadow-sm transition-opacity hover:z-10 hover:shadow-md ${
                          draggingId === appt.id ? "opacity-40" : "opacity-100"
                        } ${isCancelled ? "opacity-50" : ""}`}
                        style={{
                          top,
                          height,
                          left: `${(laneIndex / laneCount) * 100}%`,
                          width: `calc(${100 / laneCount}% - 3px)`,
                          backgroundColor: `${color}22`,
                          borderLeftColor: color,
                        }}
                      >
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                          <span
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: STATUS_DOT[appt.status] }}
                          />
                          <span className="truncate">{formatTime(start)}</span>
                          <span className="truncate">{appt.patient?.name ?? "Bloc réservé"}</span>
                        </div>
                        {height > 30 ? (
                          <div className="truncate text-[10px] text-muted-foreground">
                            {appt.appointmentType?.name ?? "—"} · {STATUS_LABEL[appt.status]}
                            {view === "week" ? ` · ${appt.practitioner.name}` : ""}
                          </div>
                        ) : null}

                        {/* Hover detail card */}
                        <div className="pointer-events-none absolute left-1/2 top-full z-20 hidden w-56 -translate-x-1/2 translate-y-1 rounded-md border border-border bg-background p-2.5 text-left text-xs shadow-lg group-hover:block">
                          <p className="font-semibold text-foreground">{appt.patient?.name ?? "Bloc réservé"}</p>
                          <p className="text-muted-foreground">
                            {formatTime(start)} – {formatTime(end)} · {appt.appointmentType?.name ?? "Sans type"}
                          </p>
                          <p className="text-muted-foreground">{appt.practitioner.name}</p>
                          {appt.room ? <p className="text-muted-foreground">{appt.room.name}</p> : null}
                          <p className="mt-1 font-medium" style={{ color: STATUS_DOT[appt.status] }}>
                            {STATUS_LABEL[appt.status]}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Glisser-déposer un rendez-vous pour le déplacer. Cliquer un créneau vide pour en créer un.
      </p>

      {modal ? (
        <AppointmentModal
          initial={buildModalInitial(modal, appointmentTypes)}
          practitioners={practitioners}
          rooms={rooms}
          appointmentTypes={appointmentTypes}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  );
}

function buildModalInitial(
  modal: { mode: "create"; prefill: CreatePrefill } | { mode: "edit"; appointment: AppointmentDTO },
  appointmentTypes: AppointmentTypeOption[],
): AppointmentModalInitial {
  if (modal.mode === "edit") {
    const appt = modal.appointment;
    const start = new Date(appt.startAt);
    const end = new Date(appt.endAt);
    return {
      mode: "edit",
      appointmentId: appt.id,
      patientId: appt.patient?.id,
      patientName: appt.patient?.name,
      practitionerId: appt.practitioner.id,
      roomId: appt.room?.id,
      appointmentTypeId: appt.appointmentType?.id,
      date: toDateParam(start),
      startTime: formatTime(start),
      durationMinutes: Math.round((end.getTime() - start.getTime()) / 60000),
      notes: appt.notes ?? "",
      status: appt.status,
    };
  }
  const defaultType = appointmentTypes[0];
  return {
    mode: "create",
    practitionerId: modal.prefill.practitionerId,
    date: toDateParam(modal.prefill.date),
    startTime: modal.prefill.startTime,
    durationMinutes: defaultType?.defaultDurationMinutes ?? 30,
    notes: "",
  };
}
