import Razorpay from "razorpay";
import { createHmac } from "node:crypto";

let instance: InstanceType<typeof Razorpay> | null = null;

export function getRazorpay(): InstanceType<typeof Razorpay> {
  if (!instance) {
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_API_KEY!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return instance;
}

export function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature) return false;

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expected = createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return expected === signature;
}
