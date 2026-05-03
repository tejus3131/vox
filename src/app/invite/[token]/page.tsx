"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Database, Loader2 } from "lucide-react";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "needs_auth" | "accepting" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAndAccept() {
      const session = await authClient.getSession();
      if (!session.data) {
        setStatus("needs_auth");
        return;
      }

      setStatus("accepting");
      try {
        await authClient.organization.acceptInvitation({
          invitationId: params.token,
        });
        router.push("/");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to accept invitation");
        setStatus("error");
      }
    }

    checkAndAccept();
  }, [params.token, router]);

  const handleLoginRedirect = () => {
    const callbackUrl = `/invite/${params.token}`;
    router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  return (
    <main className="min-h-dvh flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Database className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Organization Invite
          </h1>
        </div>

        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Checking invitation...</span>
          </div>
        )}

        {status === "needs_auth" && (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              You need to sign in to accept this invitation.
            </p>
            <button
              onClick={handleLoginRedirect}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium
                hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Sign in to continue
            </button>
          </div>
        )}

        {status === "accepting" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Accepting invitation...</span>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <p className="text-destructive">{error ?? "Something went wrong"}</p>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
