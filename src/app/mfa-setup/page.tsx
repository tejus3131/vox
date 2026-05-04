"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { KeyRound, ShieldCheck, Loader2 } from "lucide-react";
import QRCode from "qrcode";

export default function MfaSetupPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const [loadingPasskey, setLoadingPasskey] = useState(false);
  const [loadingTotp, setLoadingTotp] = useState(false);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkGateAndRedirect = async () => {
    const res = await fetch("/api/auth/access-state", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      isAuthenticated: boolean;
      emailVerified: boolean;
      mfaSatisfied: boolean;
    };
    if (!data.isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (!data.emailVerified) {
      router.replace("/verify-email");
      return;
    }
    if (data.mfaSatisfied) {
      router.replace("/");
    }
  };

  useEffect(() => {
    if (!session.isPending) {
      void checkGateAndRedirect();
    }
  }, [session.isPending]);

  useEffect(() => {
    if (!totpUri) {
      setQrCodeDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(totpUri, { width: 220, margin: 1 }).then((url) => {
      if (!cancelled) setQrCodeDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [totpUri]);

  const setupPasskey = async () => {
    setError(null);
    setLoadingPasskey(true);
    try {
      const { error } = await authClient.passkey.addPasskey();
      if (error) {
        if ((error.message ?? "").toLowerCase().includes("previously registered")) {
          await checkGateAndRedirect();
          return;
        }
        setError(error.message ?? "Failed to add passkey");
        return;
      }
      router.replace("/");
      router.refresh();
      await checkGateAndRedirect();
    } catch {
      setError("Failed to add passkey");
    } finally {
      setLoadingPasskey(false);
    }
  };

  const startTotpSetup = async () => {
    setError(null);
    setLoadingTotp(true);
    try {
      const result = await authClient.twoFactor.enable({ issuer: "Vox", password });
      if (result.error) {
        setError(result.error.message ?? "Failed to enable authenticator app");
        return;
      }
      setTotpUri(result.data?.totpURI ?? null);
    } catch {
      setError("Failed to enable authenticator app");
    } finally {
      setLoadingTotp(false);
    }
  };

  const verifyTotp = async () => {
    if (otpCode.length !== 6) return;
    setLoadingTotp(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: otpCode });
      if (result.error) {
        setError(result.error.message ?? "Invalid code");
        return;
      }
      await checkGateAndRedirect();
    } catch {
      setError("Failed to verify code");
    } finally {
      setLoadingTotp(false);
    }
  };

  if (session.isPending || !session.data) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Set up MFA</h1>
          <p className="text-sm text-muted-foreground">
            MFA is mandatory. Set up either a passkey or authenticator app to continue.
          </p>
        </div>

        <div className="grid gap-4">
          <div className="rounded-xl border border-border p-4 space-y-3">
            <h2 className="font-semibold">Option 1: Passkey (recommended)</h2>
            <button
              onClick={setupPasskey}
              disabled={loadingPasskey}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium
                hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loadingPasskey && <Loader2 className="h-4 w-4 animate-spin" />}
              <KeyRound className="h-4 w-4" />
              Add passkey
            </button>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3">
            <h2 className="font-semibold">Option 2: Authenticator app (TOTP)</h2>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Current account password"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm
                focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
            />
            {!totpUri ? (
              <button
                onClick={startTotpSetup}
                disabled={loadingTotp || password.length < 8}
                className="w-full h-10 rounded-lg border border-border text-sm font-medium
                  hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loadingTotp && <Loader2 className="h-4 w-4 animate-spin" />}
                Start TOTP setup
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Scan this QR code in your authenticator app, then enter 6-digit code.
                </p>
                <div className="rounded-lg border border-border p-3 flex items-center justify-center bg-white">
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="TOTP QR code" className="h-[220px] w-[220px]" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  )}
                </div>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm
                    focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
                />
                <button
                  onClick={verifyTotp}
                  disabled={loadingTotp || otpCode.length !== 6}
                  className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium
                    hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Verify code
                </button>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-destructive text-center">{error}</p>}
      </div>
    </main>
  );
}

