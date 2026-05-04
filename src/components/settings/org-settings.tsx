"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsLayout } from "./settings-layout";
import { Save, Loader2 } from "lucide-react";

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  role: "owner" | "admin" | "member";
}

export function OrgSettingsPage({ orgSlug, orgId, orgName, role }: Props) {
  const [name, setName] = useState(orgName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { authClient } = await import("@/lib/auth-client");
      await authClient.organization.update({
        organizationId: orgId,
        data: { name },
      });
      setMessage("Settings saved");
    } catch {
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Delete organization permanently? This cannot be undone."
    );
    if (!confirmed) return;
    setDeleting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/org", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(data?.error ?? "Failed to delete organization");
        return;
      }
      window.location.href = "/";
    } catch {
      setMessage("Failed to delete organization");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsLayout orgSlug={orgSlug}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">General Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organization settings
          </p>
        </div>

        <div className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Organization Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm
                focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Organization URL uses opaque id for security and consistency: `/{orgSlug}`.
          </p>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              loading={saving}
              leftIcon={saving ? undefined : <Save className="h-4 w-4" />}
            >
              Save Changes
            </Button>
            {message && (
              <span className={`text-sm ${message.includes("Failed") ? "text-destructive" : "text-success"}`}>
                {message}
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-border pt-6 mt-8">
          <h3 className="text-base font-semibold text-destructive">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Deleting an organization is permanent and cannot be undone.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={role !== "owner" || deleting}
          >
            Delete Organization
          </Button>
          {role !== "owner" && (
            <p className="text-xs text-muted-foreground mt-2">
              Only organization owners can delete the organization.
            </p>
          )}
        </div>
      </div>
    </SettingsLayout>
  );
}
