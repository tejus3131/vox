import { createClient } from "@/lib/supabase/server";

type BillingAccountRow = {
  org_id: string;
  razorpay_customer_id: string | null;
  status: string;
  trial_ends_at: string;
};

export async function getOrCreateBillingAccount(orgId: string): Promise<BillingAccountRow> {
  const supabase = await createClient();
  const existing = await supabase
    .from("billing_accounts")
    .select("org_id, razorpay_customer_id, status, trial_ends_at")
    .eq("org_id", orgId)
    .maybeSingle();

  if (existing.data) {
    return existing.data as BillingAccountRow;
  }

  const now = new Date();
  const inserted = await supabase
    .from("billing_accounts")
    .insert({
      org_id: orgId,
      status: "trial",
      trial_ends_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select("org_id, razorpay_customer_id, status, trial_ends_at")
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message ?? "Failed to initialize billing account");
  }

  return inserted.data as BillingAccountRow;
}
