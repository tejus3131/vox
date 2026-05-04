import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import { requireOrgRole } from "@/lib/org/permissions";
import { createClient } from "@/lib/supabase/server";
import { fetchPayment } from "@/lib/billing/razorpay";

const schema = z.object({
  orgId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
});

export async function POST(request: Request) {
  const { user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orgId, razorpayPaymentId, razorpayOrderId } = parsed.data;
  const roleResult = await requireOrgRole(orgId, "admin");
  if (roleResult.error) return roleResult.error;

  const payment = await fetchPayment(razorpayPaymentId);
  if (!payment || payment.order_id !== razorpayOrderId) {
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  const status = String(payment.status ?? "");
  if (!["captured", "authorized"].includes(status)) {
    return NextResponse.json({ error: "Payment not successful yet" }, { status: 400 });
  }

  const methodType = String(payment.method ?? "card");
  const last4 =
    typeof payment.card === "object" && payment.card && "last4" in payment.card
      ? String((payment.card as { last4?: string }).last4 ?? "")
      : null;

  const supabase = await createClient();
  await supabase
    .from("payment_methods")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("org_id", orgId);

  const insertResp = await supabase
    .from("payment_methods")
    .insert({
      org_id: orgId,
      razorpay_token_id: razorpayPaymentId,
      razorpay_customer_id: payment.customer_id ?? null,
      type: methodType,
      last4,
      is_default: true,
      metadata: {
        setup_order_id: razorpayOrderId,
      },
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertResp.error || !insertResp.data) {
    return NextResponse.json({ error: "Failed to save payment method" }, { status: 500 });
  }

  await supabase
    .from("billing_accounts")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);

  return NextResponse.json({ success: true, paymentMethodId: insertResp.data.id });
}
