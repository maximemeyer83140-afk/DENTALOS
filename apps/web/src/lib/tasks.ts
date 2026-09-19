export const TASK_PRIORITY_LABEL: Record<string, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

export const TASK_PRIORITY_OPTIONS = Object.entries(TASK_PRIORITY_LABEL).map(([value, label]) => ({ value, label }));

export const TASK_PRIORITY_CLASS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-700",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  open: "À faire",
  in_progress: "En cours",
  done: "Terminée",
  cancelled: "Annulée",
};

export const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_LABEL).map(([value, label]) => ({ value, label }));
