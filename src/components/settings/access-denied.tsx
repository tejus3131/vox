"use client";

import { ShieldAlert } from "lucide-react";
import { SettingsLayout } from "./settings-layout";

export function SettingsAccessDenied({ orgSlug }: { orgSlug: string }) {
  return (
    <SettingsLayout orgSlug={orgSlug}>
      <div className="rounded-lg border border-border p-8 text-center space-y-3">
        <div className="mx-auto h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
          <ShieldAlert className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Insufficient permissions</h2>
        <p className="text-sm text-muted-foreground">
          You are a member in this organization. Ask an admin or owner to manage these settings.
        </p>
      </div>
    </SettingsLayout>
  );
}

