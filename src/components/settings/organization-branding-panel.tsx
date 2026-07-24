"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/branding/logo";

type OrganizationBrandingPanelProps = {
  canEdit: boolean;
  initialName: string;
  initialSlug: string;
  initialLogoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
};

export function OrganizationBrandingPanel({
  canEdit,
  initialName,
  initialSlug,
  initialLogoUrl,
  primaryColor,
  secondaryColor,
}: OrganizationBrandingPanelProps) {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState(initialName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;

    setIsSaving(true);
    const response = await fetch("/api/settings/organization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        logoUrl: logoUrl.trim() || null,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setIsSaving(false);

    if (!response.ok) {
      const detail =
        data?.details?.fieldErrors?.logoUrl?.[0] ??
        data?.details?.fieldErrors?.name?.[0] ??
        data.error ??
        "Could not save branding";
      toast.error(typeof detail === "string" ? detail : "Could not save branding");
      return;
    }

    toast.success("Organization branding saved");
    await update({
      organizationName: data.organization.name,
      organizationLogoUrl: data.organization.logoUrl,
    });
    router.refresh();
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Organization branding</CardTitle>
        <p className="text-sm text-muted-foreground">
          Display name and logo URL appear in the nav and (for single-org
          deployments) on the login page. Logo is a public image URL — file
          upload storage is not configured in v1.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-2xl border bg-muted/20 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </p>
          <Logo
            name={name || "Waypoint"}
            logoUrl={logoUrl.trim() || null}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            size="md"
          />
        </div>

        <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Display name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11"
              disabled={!canEdit}
              required
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-logo-url">Logo image URL</Label>
            <Input
              id="org-logo-url"
              type="url"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              className="min-h-11"
              disabled={!canEdit}
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-muted-foreground">
              HTTPS URL to a PNG/SVG/JPG hosted elsewhere (GitHub raw, ImgBB,
              etc.). Leave blank to use the letter mark.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              Slug: <span className="font-medium text-foreground">{initialSlug}</span>
              {" · "}
              Brand colors stay as configured defaults for now.
            </p>
            {canEdit ? (
              <Button type="submit" className="min-h-11" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save branding"}
              </Button>
            ) : (
              <p className="text-muted-foreground">
                Only Super Admins can edit branding.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
