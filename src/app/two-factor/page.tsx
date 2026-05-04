"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Database, Loader2, ShieldCheck } from "lucide-react";

export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code,
      });
      if (error) {
        setError(error.message ?? "Invalid code");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Database className="h-6 w-6 text-primary-foreground" />
          </div>
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">
            Two-Factor Authentication
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
            autoFocus
            className="w-full h-12 px-4 rounded-lg border border-border bg-card text-center text-2xl font-mono tracking-[0.5em]
              focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
          />

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium
              hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify
          </button>
        </form>
      </div>
    </main>
  );
}
