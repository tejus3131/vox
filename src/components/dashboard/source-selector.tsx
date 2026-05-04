"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DataSource } from "@/types";
import { Button } from "@/components/ui/button";
import { AddSourceForm } from "./add-source-form";
import {
  Database,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  CircleDot,
  AlertTriangle,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface Props {
  initialSources: DataSource[];
  canManage?: boolean;
  orgSlug?: string;
  orgId?: string;
  canAccessSettings?: boolean;
}

function SourceCard({
  source,
  onRename,
  onDelete,
  onClick,
  canManage = true,
}: {
  source: DataSource;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClick: () => void;
  canManage?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(source.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== source.name) onRename(source.id, trimmed);
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditName(source.name);
    setEditing(false);
  };

  return (
    <div
      className="group rounded-2xl border border-border bg-card p-6
        hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5
        transition-all duration-200 cursor-pointer"
      onClick={() => {
        if (!editing && !confirmingDelete) onClick();
      }}
    >
      {/* Top row: icon + info */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Database className="h-6 w-6" />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div
              className="flex items-center gap-1.5 sm:gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                className="h-8 flex-1 min-w-0 px-2.5 rounded-lg border border-border bg-background text-sm font-medium
                  focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") cancelEdit();
                }}
                autoFocus
              />
              <Button variant="primary" size="sm" onClick={commitRename} aria-label="Save">
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelEdit} aria-label="Cancel">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <h3 className="font-semibold text-lg tracking-tight truncate leading-tight">
              {source.name}
            </h3>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              {source.db_type}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                source.status === "active"
                  ? "text-success"
                  : "text-amber-500"
              }`}
            >
              {source.status === "active" ? (
                <CircleDot className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              {source.status}
            </span>
            <span className="text-xs text-muted-foreground">
              {timeAgo(source.updated_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom row: actions or delete confirmation */}
      <div className="mt-4 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
        {confirmingDelete ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 -mx-1 rounded-lg bg-destructive/5 border border-destructive/15">
            <p className="flex-1 text-sm text-destructive">
              Delete this database?
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(source.id)}
              >
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : editing ? (
          <p className="text-xs text-muted-foreground">
            Press Enter to save, Escape to cancel
          </p>
        ) : canManage ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Pencil className="h-3.5 w-3.5" />}
              onClick={() => {
                setEditName(source.name);
                setEditing(true);
              }}
            >
              Rename
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Read-only access
          </p>
        )}
      </div>
    </div>
  );
}

export function SourceSelector({
  initialSources,
  canManage = true,
  orgSlug,
  orgId,
  canAccessSettings = true,
}: Props) {
  const router = useRouter();
  const [sources, setSources] = useState<DataSource[]>(initialSources);
  const [showForm, setShowForm] = useState(false);

  const hasSources = useMemo(() => sources.length > 0, [sources]);

  const renameSource = async (id: string, name: string) => {
    const res = await fetch(`/api/data-sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const body = await res.json();
    setSources((prev) =>
      prev.map((s) => (s.id === id ? body.data_source : s))
    );
  };

  const removeSource = async (id: string) => {
    const res = await fetch(`/api/data-sources/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="min-h-dvh">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Database className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight">Vox</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/account">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<UserRound className="h-4 w-4" />}
            >
              Account
            </Button>
          </Link>
          {orgSlug &&
            (canAccessSettings ? (
              <Link href={`/${orgSlug}/settings`}>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Settings className="h-4 w-4" />}
                >
                  Settings
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Settings className="h-4 w-4" />}
                disabled
              >
                Settings
              </Button>
            ))}
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<LogOut className="h-4 w-4" />}
            onClick={async () => {
              const { signOut } = await import("@/lib/auth-client");
              await signOut();
              window.location.href = "/";
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Your Databases
            </h1>
            <p className="text-sm sm:text-[15px] text-muted-foreground">
              Connect PostgreSQL databases and start chatting with your data.
            </p>
            {!canAccessSettings && (
              <p className="text-xs text-muted-foreground">
                Your role has limited access. Contact an org admin for settings changes.
              </p>
            )}
          </div>
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setShowForm(true)}
            className="self-start sm:self-auto shrink-0"
            disabled={!canManage}
          >
            Add Database
          </Button>
        </div>

        {/* Empty state */}
        {!hasSources && (
          <div className="flex flex-col items-center justify-center text-center py-20 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <Database className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold text-lg">
                No databases connected
              </h2>
              <p className="text-[15px] text-muted-foreground max-w-sm">
                Connect your first PostgreSQL database to start asking questions
                in plain English.
              </p>
            </div>
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setShowForm(true)}
              className="mt-2"
              disabled={!canManage}
            >
              Connect Database
            </Button>
          </div>
        )}

        {/* Source cards */}
        {hasSources && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                onRename={renameSource}
                onDelete={removeSource}
                canManage={canManage}
                onClick={() => router.push(orgSlug ? `/${orgSlug}/${source.id}` : `/${source.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add form modal */}
      {showForm && canManage && (
        <AddSourceForm
          orgId={orgId}
          onCreated={(source) => {
            setSources((prev) => [source, ...prev]);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
