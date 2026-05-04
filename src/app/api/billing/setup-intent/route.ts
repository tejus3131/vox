import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import { requireOrgRole } from "@/lib/org/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  createMethodSetupOrder,
  ensureRazorpayCustomer,
  getRazorpayKeyId,
} from "@/lib/billing/razorpay";
import { getOrCreateBillingAccount } from "@/lib/billing/account";

const schema = z.object({
  orgId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { user, unauthorized } = await requireUser();
    if (!user) return unauthorized!;

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { orgId } = parsed.data;
    const roleResult = await requireOrgRole(orgId, "admin");
    if (roleResult.error) return roleResult.error;

    const supabase = await createClient();
    const billing = await getOrCreateBillingAccount(orgId);

    const customerId = await ensureRazorpayCustomer({
      existingCustomerId: billing.razorpay_customer_id as string | null,
      orgId,
      email: user.email,
    });

    await supabase
      .from("billing_accounts")
      .update({
        razorpay_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId);

    const order = await createMethodSetupOrder({ orgId, customerId, amountPaise: 100 });

    return NextResponse.json({
      key: getRazorpayKeyId(),
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      customerId,
    });
  } catch (error) {
    console.error("[Billing Setup Intent] Failed", error);
    const asRazorpay = error as {
      statusCode?: number;
      error?: { description?: string; code?: string };
      message?: string;
    };
    let message = "Failed to initialize Razorpay setup intent";
    if (asRazorpay?.statusCode === 401) {
      message =
        "Razorpay authentication failed. Regenerate test Key ID + Key Secret in dashboard, update .env, and restart dev server.";
    } else if (asRazorpay?.error?.description) {
      message = asRazorpay.error.description;
    } else if (error instanceof Error && error.message) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
