"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Database, KeyRound, Loader2, Mail } from "lucide-react";

type AuthMode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
          callbackURL: "/mfa-setup",
        });
        if (error) {
          setError(error.message ?? "Signup failed");
          return;
        }
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        router.refresh();
        return;
      } else {
        const { error } = await authClient.signIn.email({
          email,
          password,
        });
        if (error) {
          if ((error.message ?? "").toLowerCase().includes("verify")) {
            router.push(`/verify-email?email=${encodeURIComponent(email)}`);
            return;
          }
          setError(error.message ?? "Login failed");
          return;
        }
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskey = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error } = await authClient.signIn.passkey();
      if (error) {
        setError(error.message ?? "Passkey login failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Passkey authentication failed");
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
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to continue to Vox"
              : "Get started with Vox"}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handlePasskey}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-border bg-card
              text-sm font-medium hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            Use Passkey
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">
              or continue with email
            </span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm
                focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
            />
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-card text-sm
                focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
            />
          </div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm
              focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
          />

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium
              hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(null); }}
                className="text-primary hover:underline cursor-pointer"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(null); }}
                className="text-primary hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="text-center">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
