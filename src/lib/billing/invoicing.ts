import { createClient } from "@/lib/supabase/server";
import { createInvoiceOrder } from "@/lib/billing/razorpay";

type OrgBillingAccount = {
  org_id: string;
};

export async function closeUsagePeriod(params: { orgId?: string | null } = {}) {
  const supabase = await createClient();
  const accountQuery = supabase
    .from("billing_accounts")
    .select("org_id");

  const accountsResp = params.orgId
    ? await accountQuery.eq("org_id", params.orgId)
    : await accountQuery;

  const accounts = (accountsResp.data ?? []) as OrgBillingAccount[];
  const results: Array<{ orgId: string; status: string; invoiceId?: string; amountPaise?: number }> = [];

  for (const account of accounts) {
    const orgId = account.org_id;
    const { data: latestInvoice } = await supabase
      .from("invoices")
      .select("period_end")
      .eq("org_id", orgId)
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    const periodStart = latestInvoice?.period_end
      ? new Date(latestInvoice.period_end as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date();

    const { data: ledger } = await supabase
      .from("usage_ledger")
      .select("cost_paise")
      .eq("org_id", orgId)
      .gte("created_at", periodStart.toISOString())
      .lte("created_at", periodEnd.toISOString());

    const totalPaise = (ledger ?? []).reduce(
      (sum, row) => sum + Number((row as { cost_paise?: number }).cost_paise ?? 0),
      0
    );

    if (totalPaise <= 0) {
      results.push({ orgId, status: "no_usage" });
      continue;
    }

    const insertResp = await supabase
      .from("invoices")
      .insert({
        org_id: orgId,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        total_paise: totalPaise,
        amount_due_paise: totalPaise,
        amount_paid_paise: 0,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertResp.error || !insertResp.data) {
      results.push({ orgId, status: "invoice_insert_failed" });
      continue;
    }

    const invoiceId = String(insertResp.data.id);
    try {
      const order = await createInvoiceOrder({
        orgId,
        invoiceId,
        amountPaise: totalPaise,
      });

      await supabase
        .from("invoices")
        .update({
          razorpay_order_id: order.id,
          status: "payment_pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      results.push({
        orgId,
        status: "invoice_created",
        invoiceId,
        amountPaise: totalPaise,
      });
    } catch (error) {
      await supabase
        .from("invoices")
        .update({
          status: "failed",
          external_error:
            error instanceof Error ? error.message : "order_creation_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);
      results.push({ orgId, status: "order_creation_failed", invoiceId, amountPaise: totalPaise });
    }
  }

  return results;
}
