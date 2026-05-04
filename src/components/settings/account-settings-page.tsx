"use client";

import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type PasskeyRow = {
  id: string;
  name?: string;
  createdAt?: string;
};

export function AccountSettingsPage() {
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const loadPasskeys = async () => {
    setLoadingPasskeys(true);
    try {
      const res = await fetch("/api/auth/passkey/list-user-passkeys");
      const data = (await res.json().catch(() => null)) as PasskeyRow[] | null;
      setPasskeys(Array.isArray(data) ? data : []);
    } finally {
      setLoadingPasskeys(false);
    }
  };

  useEffect(() => {
    void loadPasskeys();
  }, []);

  const addPasskey = async () => {
    setBusy("add-passkey");
    setError(null);
    setSuccess(null);
    try {
      const result = await authClient.passkey.addPasskey();
      if (result.error) {
        setError(result.error.message ?? "Failed to add passkey");
        return;
      }
      setSuccess("Passkey added");
      await loadPasskeys();
    } finally {
      setBusy(null);
    }
  };

  const removePasskey = async (id: string) => {
    setBusy(`remove:${id}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auth/passkey/delete-passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? "Failed to remove passkey");
        return;
      }
      setSuccess("Passkey removed");
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusy(null);
    }
  };

  const changePassword = async () => {
    setBusy("change-password");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions: false,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? "Failed to change password");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setSuccess("Password updated");
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = async () => {
    const confirmed = window.confirm("Delete account permanently? This cannot be undone.");
    if (!confirmed) return;
    setBusy("delete-account");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auth/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackURL: "/" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Failed to delete account");
        return;
      }
      window.location.href = "/";
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-dvh p-6 md:p-10 bg-background">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your security and authentication methods.
          </p>
        </div>

        <section className="rounded-lg border border-border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Passkeys</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            You can add multiple passkeys as backup MFA methods.
          </p>
          <button
            onClick={addPasskey}
            disabled={busy === "add-passkey"}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium
              hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Add Passkey
          </button>

          {loadingPasskeys ? (
            <p className="text-sm text-muted-foreground">Loading passkeys...</p>
          ) : passkeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No passkeys registered yet.</p>
          ) : (
            <div className="space-y-2">
              {passkeys.map((pk) => (
                <div
                  key={pk.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{pk.name ?? "Passkey"}</p>
                    <p className="text-xs text-muted-foreground">{pk.id.slice(0, 8)}...</p>
                  </div>
                  <button
                    onClick={() => removePasskey(pk.id)}
                    disabled={busy === `remove:${pk.id}`}
                    className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">MFA Management</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Need to enroll or refresh MFA methods? Use guided setup.
          </p>
          <a
            href="/mfa-setup"
            className="inline-flex h-9 items-center px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Open MFA Setup
          </a>
        </section>

        <section className="rounded-lg border border-border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Change Password</h2>
          </div>
          <div className="grid gap-3 max-w-md">
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
            />
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
            />
            <button
              onClick={changePassword}
              disabled={
                busy === "change-password" ||
                currentPassword.length < 8 ||
                newPassword.length < 8
              }
              className="h-9 px-4 rounded-lg border border-border text-sm font-medium
                hover:bg-muted transition-colors disabled:opacity-50"
            >
              Update Password
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-destructive/30 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-destructive" />
            <h2 className="font-semibold text-destructive">Danger Zone</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and associated access.
          </p>
          <button
            onClick={deleteAccount}
            disabled={busy === "delete-account"}
            className="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium
              hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            Delete Account
          </button>
        </section>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-success">{success}</p>}
      </div>
    </main>
  );
}

