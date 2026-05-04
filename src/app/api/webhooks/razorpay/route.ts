import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(body, signature)) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return new NextResponse("Invalid payload", { status: 400 });
  }
  const eventId = event.event_id ?? event.id;
  const eventType = event.event;

  if (!eventId || !eventType) {
    return new NextResponse("Missing event data", { status: 400 });
  }

  const supabase = await createClient();
  const eventIdStr = String(eventId);
  const eventTypeStr = String(eventType);

  const insertResp = await supabase.from("webhook_events").insert({
    event_id: eventIdStr,
    event_type: eventTypeStr,
    status: "processing",
    payload_json: event,
    processed_at: new Date().toISOString(),
  });

  if (insertResp.error && insertResp.error.code === "23505") {
    return new NextResponse("Already processed", { status: 200 });
  }

  if (insertResp.error) {
    return new NextResponse("Failed to persist webhook state", { status: 500 });
  }

  try {
    await processWebhookEvent(supabase, eventTypeStr, event.payload as Record<string, unknown>);
    await supabase
      .from("webhook_events")
      .update({
        status: "processed",
        error_text: null,
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", eventIdStr);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await supabase
      .from("webhook_events")
      .update({
        status: "failed",
        error_text: message,
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", eventIdStr);
    return new NextResponse("Webhook processing failed", { status: 500 });
  }

  return new NextResponse("OK", { status: 200 });
}

async function processWebhookEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventType: string,
  payload: Record<string, unknown>
) {
  const readPaymentEntity = (
    payload: Record<string, unknown>
  ): Record<string, unknown> | null => {
    const rootPayment = payload.payment;
    if (rootPayment && typeof rootPayment === "object") {
      return rootPayment as Record<string, unknown>;
    }
    const nested = (payload.payment as { entity?: unknown } | undefined)?.entity;
    if (nested && typeof nested === "object") {
      return nested as Record<string, unknown>;
    }
    return null;
  };

  switch (eventType) {
    case "payment.captured": {
      const payment = readPaymentEntity(payload);
      if (!payment) return;

      const orderId = payment.order_id as string;
      if (orderId) {
        await supabase
          .from("invoices")
          .update({
            status: "paid",
            razorpay_payment_id: payment.id as string,
            amount_paid_paise: Number(payment.amount ?? 0),
            updated_at: new Date().toISOString(),
          })
          .eq("razorpay_order_id", orderId);

        const { data: invoice } = await supabase
          .from("invoices")
          .select("org_id")
          .eq("razorpay_order_id", orderId)
          .single();
        if (invoice?.org_id) {
          await supabase
            .from("billing_accounts")
            .update({ status: "active", updated_at: new Date().toISOString() })
            .eq("org_id", invoice.org_id);
        }
      }
      break;
    }

    case "payment.failed": {
      const payment = readPaymentEntity(payload);
      if (!payment) return;

      const orderId = payment.order_id as string;
      if (orderId) {
        await supabase
          .from("invoices")
          .update({
            status: "failed",
            external_error: String(
              ((payment.error_description as string | undefined) ?? "payment_failed")
            ),
            updated_at: new Date().toISOString(),
          })
          .eq("razorpay_order_id", orderId);

        const { data: invoice } = await supabase
          .from("invoices")
          .select("org_id")
          .eq("razorpay_order_id", orderId)
          .single();

        if (invoice) {
          await supabase
            .from("billing_accounts")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("org_id", invoice.org_id);
        }
      }
      break;
    }
  }
}
