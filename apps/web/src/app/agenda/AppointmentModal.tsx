"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";

import type { AppointmentStatus } from "@dentalos/database";

import {
  createAppointmentAction,
  quickCreatePatientAction,
  searchPatientsAction,
  updateAppointmentAction,
  updateAppointmentStatusAction,
  type AppointmentFormState,
  type PatientSearchResult,
} from "./actions";
import type { AppointmentTypeOption, SimpleOption } from "./AgendaClient";

export type AppointmentModalInitial =
  | {
      mode: "create";
      practitionerId?: string | undefined;
      date: string;
      startTime: string;
      durationMinutes: number;
      notes: string;
    }
  | {
      mode: "edit";
      appointmentId: string;
      patientId?: string | undefined;
      patientName?: string | undefined;
      practitionerId: string;
      roomId?: string | undefined;
      appointmentTypeId?: string | undefined;
      date: string;
      startTime: string;
      durationMinutes: number;
      notes: string;
      status: AppointmentStatus;
    };

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Planifié",
  confirmed: "Confirmé",
  arrived: "Arrivé",
  in_chair: "En fauteuil",
  completed: "Terminé",
  cancelled: "Annulé",
  no_show: "Absent",
};

function nextStatusActions(status: AppointmentStatus): { to: AppointmentStatus; label: string }[] {
  switch (status) {
    case "scheduled":
      return [
        { to: "confirmed", label: "Confirmer" },
        { to: "arrived", label: "Marquer arrivé" },
        { to: "no_show", label: "Absent" },
        { to: "cancelled", label: "Annuler" },
      ];
    case "confirmed":
      return [
        { to: "arrived", label: "Marquer arrivé" },
        { to: "no_show", label: "Absent" },
        { to: "cancelled", label: "Annuler" },
      ];
    case "arrived":
      return [{ to: "in_chair", label: "Installer au fauteuil" }, { to: "cancelled", label: "Annuler" }];
    case "in_chair":
      return [{ to: "completed", label: "Terminer" }];
    case "completed":
      return [];
    case "cancelled":
    case "no_show":
      return [{ to: "scheduled", label: "Réactiver" }];
  }
}

function computeEndTime(date: string, startTime: string, durationMinutes: number): string {
  if (!date || !startTime) return "—";
  const start = new Date(`${date}T${startTime}:00`);
  if (Number.isNaN(start.getTime())) return "—";
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
}

const initialFormState: AppointmentFormState = {};

interface ModalDefaults {
  patientId: string | undefined;
  patientName: string;
  roomId: string;
  appointmentTypeId: string;
  status: AppointmentStatus;
}

/** Pulls the edit-only fields out through an explicit `if`, rather than a ternary keyed off a
 * separately-computed `isEdit` boolean — keeps the narrowing unambiguous regardless of how far the
 * discriminant check is from the point of use. */
function modalDefaults(initial: AppointmentModalInitial): ModalDefaults {
  if (initial.mode === "edit") {
    return {
      patientId: initial.patientId,
      patientName: initial.patientName ?? "",
      roomId: initial.roomId ?? "",
      appointmentTypeId: initial.appointmentTypeId ?? "",
      status: initial.status,
    };
  }
  return { patientId: undefined, patientName: "", roomId: "", appointmentTypeId: "", status: "scheduled" };
}

export function AppointmentModal({
  initial,
  practitioners,
  rooms,
  appointmentTypes,
  onClose,
}: {
  initial: AppointmentModalInitial;
  practitioners: SimpleOption[];
  rooms: SimpleOption[];
  appointmentTypes: AppointmentTypeOption[];
  onClose: () => void;
}): ReactNode {
  const router = useRouter();
  const isEdit = initial.mode === "edit";
  const action = isEdit ? updateAppointmentAction : createAppointmentAction;
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const defaults = modalDefaults(initial);

  const [patientId, setPatientId] = useState(defaults.patientId);
  const [patientName, setPatientName] = useState(defaults.patientName);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickFirstName, setQuickFirstName] = useState("");
  const [quickLastName, setQuickLastName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickError, setQuickError] = useState<string | null>(null);
  const [, startQuickCreateTransition] = useTransition();

  const [practitionerId, setPractitionerId] = useState(initial.practitionerId ?? practitioners[0]?.id ?? "");
  const [roomId, setRoomId] = useState(defaults.roomId);
  const [appointmentTypeId, setAppointmentTypeId] = useState(defaults.appointmentTypeId);
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [durationMinutes, setDurationMinutes] = useState(initial.durationMinutes);
  const [notes, setNotes] = useState(initial.notes);
  const [status, setStatus] = useState<AppointmentStatus>(defaults.status);
  const [, startStatusTransition] = useTransition();

  const closedRef = useRef(false);

  useEffect(() => {
    if (state.ok && !closedRef.current) {
      closedRef.current = true;
      onClose();
    }
  }, [state.ok, onClose]);

  useEffect(() => {
    if (patientQuery.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPatientsAction(patientQuery).then((results) => {
        if (!cancelled) setPatientResults(results);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [patientQuery]);

  function selectPatient(patient: PatientSearchResult): void {
    setPatientId(patient.id);
    setPatientName(patient.name);
    setPatientQuery("");
    setSearchOpen(false);
  }

  function clearPatient(): void {
    setPatientId(undefined);
    setPatientName("");
  }

  function handleTypeChange(typeId: string): void {
    setAppointmentTypeId(typeId);
    const type = appointmentTypes.find((t) => t.id === typeId);
    if (type) setDurationMinutes(type.defaultDurationMinutes);
  }

  function handleQuickCreate(): void {
    setQuickError(null);
    if (!quickFirstName.trim() || !quickLastName.trim()) {
      setQuickError("Prénom et nom sont requis.");
      return;
    }
    startQuickCreateTransition(async () => {
      const result = await quickCreatePatientAction({
        firstName: quickFirstName.trim(),
        lastName: quickLastName.trim(),
        phone: quickPhone.trim() || undefined,
      });
      if (result.error) {
        setQuickError(result.error);
        return;
      }
      if (result.patient) {
        selectPatient({ id: result.patient.id, name: result.patient.name, dateOfBirth: null, phone: null });
        setShowQuickCreate(false);
        setQuickFirstName("");
        setQuickLastName("");
        setQuickPhone("");
      }
    });
  }

  function handleStatusChange(next: AppointmentStatus): void {
    if (initial.mode !== "edit") return;
    const appointmentId = initial.appointmentId;
    startStatusTransition(async () => {
      await updateAppointmentStatusAction(appointmentId, next);
      setStatus(next);
      router.refresh();
    });
  }

  const endTime = computeEndTime(date, startTime, durationMinutes);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 sm:pt-16"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            ✕
          </button>
        </div>

        {isEdit ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2.5">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Statut : {STATUS_LABEL[status]}</span>
            <div className="flex flex-wrap gap-1.5">
              {nextStatusActions(status).map((action2) => (
                <button
                  key={action2.to}
                  type="button"
                  onClick={() => handleStatusChange(action2.to)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                >
                  {action2.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <form action={formAction} className="flex flex-col gap-3">
          {initial.mode === "edit" ? <input type="hidden" name="appointmentId" value={initial.appointmentId} /> : null}
          <input type="hidden" name="patientId" value={patientId ?? ""} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Patient</label>
            {patientId ? (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm font-medium text-foreground">{patientName}</span>
                <div className="flex items-center gap-2">
                  <Link href={`/patients/${patientId}`} className="text-xs font-medium text-primary hover:underline">
                    Ouvrir le dossier →
                  </Link>
                  <button type="button" onClick={clearPatient} className="text-xs text-muted-foreground hover:underline">
                    changer
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={patientQuery}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Rechercher un patient (ex. « Jean Dup… »)…"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
                {searchOpen && patientResults.length > 0 ? (
                  <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-background shadow-lg">
                    {patientResults.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectPatient(p)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span>{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.phone ?? p.dateOfBirth ?? ""}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowQuickCreate((v) => !v)}
                  className="mt-1.5 text-xs font-medium text-primary hover:underline"
                >
                  + Nouveau patient
                </button>
                {showQuickCreate ? (
                  <div className="mt-2 flex flex-col gap-2 rounded-md border border-border p-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Prénom"
                        value={quickFirstName}
                        onChange={(e) => setQuickFirstName(e.target.value)}
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                      />
                      <input
                        type="text"
                        placeholder="Nom"
                        value={quickLastName}
                        onChange={(e) => setQuickLastName(e.target.value)}
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Téléphone (optionnel)"
                      value={quickPhone}
                      onChange={(e) => setQuickPhone(e.target.value)}
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    />
                    {quickError ? <p className="text-xs text-red-600">{quickError}</p> : null}
                    <button
                      type="button"
                      onClick={handleQuickCreate}
                      className="self-start rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                    >
                      Créer et sélectionner
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Laisser vide pour un bloc réservé sans patient.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="am-practitioner" className="text-sm font-medium text-foreground">
                Praticien
              </label>
              <select
                id="am-practitioner"
                name="practitionerId"
                value={practitionerId}
                onChange={(e) => setPractitionerId(e.target.value)}
                required
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {practitioners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="am-room" className="text-sm font-medium text-foreground">
                Salle
              </label>
              <select
                id="am-room"
                name="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">—</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="am-type" className="text-sm font-medium text-foreground">
              Type de rendez-vous
            </label>
            <select
              id="am-type"
              name="appointmentTypeId"
              value={appointmentTypeId}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">— Sans type —</option>
              {appointmentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.defaultDurationMinutes} min)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="am-date" className="text-sm font-medium text-foreground">
                Date
              </label>
              <input
                id="am-date"
                name="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="am-start" className="text-sm font-medium text-foreground">
                Heure de début
              </label>
              <input
                id="am-start"
                name="startTime"
                type="time"
                step={300}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="am-duration" className="text-sm font-medium text-foreground">
                Durée (min)
              </label>
              <input
                id="am-duration"
                name="durationMinutes"
                type="number"
                min={5}
                max={480}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value) || 0)}
                required
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Fin calculée automatiquement : <span className="font-mono font-medium text-foreground">{endTime}</span>
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="am-notes" className="text-sm font-medium text-foreground">
              Notes (facultatif)
            </label>
            <textarea
              id="am-notes"
              name="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          {state.error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {state.error}
            </p>
          ) : null}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {pending ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer le rendez-vous"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
