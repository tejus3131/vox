import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const supabase = await createClient();

  const [billingResp, usageResp, invoiceResp] = await Promise.all([
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
  ]);

  return NextResponse.json({
    billing: billingResp.data,
    usage: usageResp.data ?? [],
    invoices: invoiceResp.data ?? [],
  });
}
