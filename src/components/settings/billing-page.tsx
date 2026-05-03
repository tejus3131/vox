"use client";

import { useEffect, useMemo, useState } from "react";
import { SettingsLayout } from "./settings-layout";
import { CreditCard } from "lucide-react";

interface Props {
  orgSlug: string;
  orgId: string;
}

type BillingData = {
  billing: {
    status?: string;
    trial_ends_at?: string | null;
  } | null;
  usage: Array<{ cost_paise: number; created_at: string }>;
  invoices: Array<{
    id: string;
    status: string;
    amount_due_paise: number;
    amount_paid_paise: number;
    period_start: string;
    period_end: string;
  }>;
};

export function BillingPage({ orgSlug, orgId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BillingData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/billing?orgId=${encodeURIComponent(orgId)}`);
        const body = (await res.json()) as BillingData & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(body.error ?? "Failed to load billing");
          return;
        }
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setError("Failed to load billing");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const usageTotalRupees = useMemo(() => {
    const paise = (data?.usage ?? []).reduce((sum, row) => sum + Number(row.cost_paise || 0), 0);
    return (paise / 100).toFixed(2);
  }, [data]);

  return (
    <SettingsLayout orgSlug={orgSlug}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Billing</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your billing and payment methods
          </p>
        </div>

        <div className="border border-border rounded-lg p-8 text-center space-y-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading billing...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <>
              <h3 className="font-semibold text-lg capitalize">
                {data?.billing?.status ?? "unknown"} plan
              </h3>
              {data?.billing?.trial_ends_at && (
                <p className="text-sm text-muted-foreground">
                  Trial ends {new Date(data.billing.trial_ends_at).toLocaleDateString()}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Current tracked usage: INR {usageTotalRupees}
              </p>
              <button
                onClick={() => window.alert("Payment setup will be enabled through Razorpay checkout integration next.")}
                className="h-9 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Setup Payment Method
              </button>
            </>
          )}
        </div>

        {!loading && !error && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium">Period</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-right px-4 py-2.5 font-medium">Amount Due (INR)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.invoices ?? []).slice(0, 8).map((invoice) => (
                  <tr key={invoice.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      {new Date(invoice.period_start).toLocaleDateString()} -{" "}
                      {new Date(invoice.period_end).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 capitalize">{invoice.status}</td>
                    <td className="px-4 py-3 text-right">
                      {(Number(invoice.amount_due_paise || 0) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {(data?.invoices ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                      No invoices yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
