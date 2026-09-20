import type { ReactNode } from "react";

import { PERMISSION_CATEGORY_LABEL } from "@/lib/team";

export interface PermissionOption {
  key: string;
  category: string;
  description: string;
}

/** Grouped checkbox matrix shared by role creation and role editing — every `<input>` uses
 * `name="permissionKeys"`, so the surrounding `<form>` collects the checked ones as a plain array
 * via `formData.getAll("permissionKeys")` (see `equipe/actions.ts`), no client-side state needed. */
export function PermissionCheckboxes({
  permissions,
  checkedKeys,
  idPrefix,
}: {
  permissions: PermissionOption[];
  checkedKeys: string[];
  idPrefix: string;
}): ReactNode {
  const checked = new Set(checkedKeys);
  const byCategory = new Map<string, PermissionOption[]>();
  for (const permission of permissions) {
    const list = byCategory.get(permission.category) ?? [];
    list.push(permission);
    byCategory.set(permission.category, list);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[...byCategory.entries()].map(([category, items]) => (
        <fieldset key={category} className="rounded-md border border-border p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-muted-foreground">
            {PERMISSION_CATEGORY_LABEL[category] ?? category}
          </legend>
          <div className="flex flex-col gap-1">
            {items.map((permission) => (
              <label key={permission.key} htmlFor={`${idPrefix}-${permission.key}`} className="flex items-start gap-2 text-sm">
                <input
                  id={`${idPrefix}-${permission.key}`}
                  type="checkbox"
                  name="permissionKeys"
                  value={permission.key}
                  defaultChecked={checked.has(permission.key)}
                  className="mt-0.5"
                />
                <span className="text-foreground">{permission.description}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
