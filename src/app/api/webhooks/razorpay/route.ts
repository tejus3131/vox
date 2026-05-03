import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(body, signature)) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(body);
  const eventId = event.event_id ?? event.id;
  const eventType = event.event;

  if (!eventId || !eventType) {
    return new NextResponse("Missing event data", { status: 400 });
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .single();

  if (existing) {
    return new NextResponse("Already processed", { status: 200 });
  }

  try {
    await processWebhookEvent(supabase, eventType, event.payload);
  } catch (err) {
    console.error("[Razorpay Webhook] Processing failed:", err);
  }

  await supabase.from("webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
  });

  return new NextResponse("OK", { status: 200 });
}

async function processWebhookEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventType: string,
  payload: Record<string, unknown>
) {
  switch (eventType) {
    case "payment.captured": {
      const payment = payload.payment as Record<string, unknown> | undefined;
      if (!payment) return;

      const orderId = payment.order_id as string;
      if (orderId) {
        await supabase
          .from("invoices")
          .update({
            status: "paid",
            razorpay_payment_id: payment.id as string,
          })
          .eq("razorpay_order_id", orderId);
      }
      break;
    }

    case "payment.failed": {
      const payment = payload.payment as Record<string, unknown> | undefined;
      if (!payment) return;

      const orderId = payment.order_id as string;
      if (orderId) {
        await supabase
          .from("invoices")
          .update({ status: "failed" })
          .eq("razorpay_order_id", orderId);

        const { data: invoice } = await supabase
          .from("invoices")
          .select("org_id")
          .eq("razorpay_order_id", orderId)
          .single();

        if (invoice) {
          await supabase
            .from("billing_accounts")
            .update({ status: "past_due" })
            .eq("org_id", invoice.org_id);
        }
      }
      break;
    }
  }
}
