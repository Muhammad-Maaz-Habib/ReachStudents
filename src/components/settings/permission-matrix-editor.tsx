"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PermissionResource, UserRole } from "@/generated/prisma/browser";
import { RESOURCE_LABELS, ROLE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PermissionRow = {
  id: string;
  role: UserRole;
  resource: PermissionResource;
  canView: boolean;
  canEdit: boolean;
};

type PermissionMatrixEditorProps = {
  initialPermissions: PermissionRow[];
  canEdit: boolean;
};

const EDITABLE_ROLES: UserRole[] = [
  UserRole.SESSION_ADMIN,
  UserRole.STAFF,
  UserRole.NURSE,
  UserRole.PARENT,
  UserRole.STUDENT,
];

const MATRIX_RESOURCES = Object.values(PermissionResource);

export function PermissionMatrixEditor({
  initialPermissions,
  canEdit,
}: PermissionMatrixEditorProps) {
  const [permissions, setPermissions] = useState(initialPermissions);
  const [isSaving, setIsSaving] = useState(false);
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.SESSION_ADMIN);

  const roleRows = useMemo(() => {
    return MATRIX_RESOURCES.map((resource) => {
      const row = permissions.find(
        (permission) =>
          permission.role === activeRole && permission.resource === resource,
      );
      return {
        resource,
        canView: row?.canView ?? false,
        canEdit: row?.canEdit ?? false,
      };
    });
  }, [permissions, activeRole]);

  function updateCell(
    resource: PermissionResource,
    field: "canView" | "canEdit",
    value: boolean,
  ) {
    setPermissions((current) => {
      const existing = current.find(
        (row) => row.role === activeRole && row.resource === resource,
      );
      if (existing) {
        return current.map((row) => {
          if (row.role !== activeRole || row.resource !== resource) return row;
          if (field === "canView" && !value) {
            return { ...row, canView: false, canEdit: false };
          }
          if (field === "canEdit" && value) {
            return { ...row, canView: true, canEdit: true };
          }
          return { ...row, [field]: value };
        });
      }
      return [
        ...current,
        {
          id: `${activeRole}-${resource}`,
          role: activeRole,
          resource,
          canView: field === "canView" ? value : false,
          canEdit: field === "canEdit" ? value : false,
        },
      ];
    });
  }

  async function save() {
    setIsSaving(true);
    const updates = EDITABLE_ROLES.flatMap((role) =>
      MATRIX_RESOURCES.map((resource) => {
        const row = permissions.find(
          (permission) =>
            permission.role === role && permission.resource === resource,
        );
        return {
          role,
          resource,
          canView: row?.canView ?? false,
          canEdit: row?.canEdit ?? false,
        };
      }),
    );

    const response = await fetch("/api/settings/permissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    setIsSaving(false);

    if (!response.ok) {
      toast.error("Could not save permissions");
      return;
    }

    const data = await response.json();
    setPermissions(data.permissions ?? permissions);
    toast.success("Permission matrix saved");
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Permission matrix</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Super Admin always has full access. Toggle view/edit per role and
            resource.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            className="min-h-10"
            disabled={isSaving}
            onClick={() => void save()}
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {EDITABLE_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                activeRole === role
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-muted/30 hover:bg-muted/60",
              )}
              onClick={() => setActiveRole(role)}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Resource</th>
                <th className="py-2 pr-4 font-medium">View</th>
                <th className="py-2 font-medium">Edit</th>
              </tr>
            </thead>
            <tbody>
              {roleRows.map((row) => (
                <tr key={row.resource} className="border-b last:border-0">
                  <td className="py-2 pr-4">{RESOURCE_LABELS[row.resource]}</td>
                  <td className="py-2 pr-4">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={row.canView}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateCell(row.resource, "canView", event.target.checked)
                      }
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={row.canEdit}
                      disabled={!canEdit || !row.canView}
                      onChange={(event) =>
                        updateCell(row.resource, "canEdit", event.target.checked)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
