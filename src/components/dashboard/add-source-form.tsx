"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import type { DataSource } from "@/types";

interface SourceFormState {
  name: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

const EMPTY_FORM: SourceFormState = {
  name: "",
  host: "",
  port: "5432",
  database: "",
  username: "",
  password: "",
};

interface Props {
  onCreated: (source: DataSource) => void;
  onCancel: () => void;
  orgId?: string;
}

export function AddSourceForm({ onCreated, onCancel, orgId }: Props) {
  const [form, setForm] = useState<SourceFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractConnectionString = (input: string) => {
    const trimmed = input.trim();
    const matched = trimmed.match(/postgres(?:ql)?:\/\/\S+/i);
    if (!matched?.[0]) {
      throw new Error("Invalid PostgreSQL connection string");
    }
    return matched[0].replace(/[),.;]+$/, "");
  };

  const parseConnectionString = (input: string) => {
    const connectionString = extractConnectionString(input);
    const normalized = connectionString.startsWith("postgres://")
      ? connectionString.replace("postgres://", "postgresql://")
      : connectionString;
    const url = new URL(normalized);
    if (!["postgresql:", "postgres:"].includes(url.protocol)) {
      throw new Error("Only PostgreSQL connection strings are supported");
    }
    const rawDb = url.pathname.replace(/^\/+/, "");
    const database = decodeURIComponent(rawDb.split(/[/?#\s]/)[0] || "postgres");
    return {
      host: url.hostname,
      port: url.port || "5432",
      database,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    };
  };

  const set = (key: keyof SourceFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (key === "host" && value.includes("://")) {
      try {
        const parsed = parseConnectionString(value.trim());
        setForm((p) => ({
          ...p,
          host: parsed.host,
          port: parsed.port,
          database: parsed.database,
          username: parsed.username,
          password: parsed.password,
        }));
        setError(null);
        return;
      } catch {
        // Keep raw value if parsing fails; submit path will still validate.
      }
    }
    setForm((p) => ({ ...p, [key]: value }));
  };

  const canSubmit =
    form.name.trim() && form.host.trim() && form.database.trim() && form.username.trim();

  const readError = (body: unknown): string => {
    if (!body || typeof body !== "object") return "Failed to connect";
    const obj = body as { error?: unknown; details?: unknown };
    if (typeof obj.error === "string") return obj.error;
    if (obj.error && typeof obj.error === "object") {
      const msg = (obj.error as { message?: unknown }).message;
      if (typeof msg === "string") return msg;
    }
    return "Failed to connect";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, org_id: orgId }),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(readError(body));
      onCreated(body.data_source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Connect database">
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onCancel}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        role="presentation"
      />
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 sm:space-y-5 shadow-xl animate-in max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">
            Connect Database
          </h2>
          <Button
            type="button"
            variant="icon"
            size="icon"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Input
          label="Connection name"
          placeholder="e.g. Production Analytics"
          value={form.name}
          onChange={set("name")}
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-3">
          <Input
            label="Host"
            placeholder="db.example.com or paste full postgresql://... URI"
            value={form.host}
            onChange={set("host")}
          />
          <Input
            label="Port"
            placeholder="5432"
            value={form.port}
            onChange={set("port")}
          />
        </div>

        <Input
          label="Database"
          placeholder="my_database"
          value={form.database}
          onChange={set("database")}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Username"
            placeholder="postgres"
            value={form.username}
            onChange={set("username")}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={set("password")}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={saving}
            disabled={!canSubmit}
          >
            {saving ? "Connecting..." : "Connect Database"}
          </Button>
        </div>
      </form>
    </div>
  );
}
