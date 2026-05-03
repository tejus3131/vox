"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Mail, Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("email") ?? "";
    setEmail(value);
  }, []);

  const resend = async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          callbackURL: `${window.location.origin}/mfa-setup`,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Failed to resend verification email");
        return;
      }
      setMessage("Verification email sent. Please check your inbox.");
    } catch {
      setError("Failed to resend verification email");
    } finally {
      setLoading(false);
    }
  };

  const continueAfterVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/access-state", { cache: "no-store" });
      const data = await res.json();
      if (!data?.isAuthenticated) {
        router.push("/login");
        return;
      }
      if (!data?.emailVerified) {
        setError("Email still not verified yet. Try again in a few seconds.");
        return;
      }
      router.push(data?.mfaSatisfied ? "/" : "/mfa-setup");
      router.refresh();
    } catch {
      setError("Could not check verification status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Verify your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to <span className="font-medium text-foreground">{email || "your email"}</span>.
            You must verify before signing in.
          </p>
        </div>

        <button
          onClick={resend}
          disabled={loading || !email}
          className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium
            hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Resend verification email
        </button>
        <button
          onClick={continueAfterVerify}
          disabled={loading}
          className="w-full h-10 rounded-lg border border-border text-sm font-medium
            hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
        >
          I have verified my email
        </button>
        <button
          onClick={async () => {
            await authClient.signOut();
            router.push("/login");
          }}
          disabled={loading}
          className="w-full h-10 rounded-lg border border-border text-sm font-medium
            hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
        >
          Logout
        </button>

        {message && <p className="text-sm text-success">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <p className="text-sm text-muted-foreground">
          Already verified?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Go to login
          </Link>
        </p>
      </div>
    </main>
  );
}

