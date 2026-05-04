import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/org/permissions";
import { getOrCreateBillingAccount } from "@/lib/billing/account";

export async function GET(request: Request) {
  const { user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }
  const orgResult = await requireOrgMember(orgId);
  if (orgResult.error) return orgResult.error;
  await getOrCreateBillingAccount(orgId);

  const supabase = await createClient();

  const [billingResp, usageResp, invoiceResp, paymentMethodResp] = await Promise.all([
    supabase
      .from("billing_accounts")
      .select("*")
      .eq("org_id", orgId)
      .single(),
    supabase
      .from("usage_ledger")
      .select("cost_paise, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("invoices")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("payment_methods")
      .select("id, type, last4, is_default, created_at")
      .eq("org_id", orgId)
      .eq("is_default", true)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    billing: billingResp.data,
    usage: usageResp.data ?? [],
    invoices: invoiceResp.data ?? [],
    payment_method: paymentMethodResp.data,
  });
}
