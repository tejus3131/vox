"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Plus, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type Org = {
  id: string;
  name: string;
  slug?: string;
  logo?: string | null;
};

interface Props {
  orgs: Org[];
}

export function OrgSelector({ orgs }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Failed to create organization");
      return;
    }
    router.push(`/${data.organization.id}`);
    router.refresh();
  };

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary-foreground" />
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

      <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Organizations</h1>
            <p className="text-muted-foreground mt-1">
              Select an organization to manage databases and chat sessions.
            </p>
          </div>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating((v) => !v)}>
            {creating ? "Cancel" : "Create Org"}
          </Button>
        </div>

        {creating && (
          <form onSubmit={createOrg} className="rounded-xl border border-border p-4 space-y-3">
            <h2 className="font-semibold">Create organization</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Organization name"
              required
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit">Create</Button>
          </form>
        )}

        {orgs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <h3 className="font-semibold text-lg">No organizations yet</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              You can create a new org or wait for an invite from an admin.
            </p>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Create your first org
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/${org.id}`}
                className="rounded-xl border border-border p-5 hover:border-primary/40 hover:bg-card/70 transition-colors"
              >
                <h3 className="font-semibold text-lg">{org.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">/{org.id.slice(0, 8)}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

