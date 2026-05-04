import Razorpay from "razorpay";
import { createHmac } from "node:crypto";

let instance: InstanceType<typeof Razorpay> | null = null;

function readTrimmedEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return "";
}

export function getRazorpay(): InstanceType<typeof Razorpay> {
  const keyId = readTrimmedEnv("RAZORPAY_KEY_ID", "RAZORPAY_API_KEY");
  const keySecret = readTrimmedEnv("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) {
    throw new Error(
      "Missing Razorpay credentials. Set RAZORPAY_KEY_ID (or RAZORPAY_API_KEY) and RAZORPAY_KEY_SECRET."
    );
  }
  if (!instance) {
    instance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return instance;
}

export function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature) return false;

  const secret =
    readTrimmedEnv("RAZORPAY_WEBHOOK_SECRET") ||
    readTrimmedEnv("RAZORPAY_KEY_SECRET");
  if (!secret) return false;

  const expected = createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return expected === signature;
}

export function getRazorpayKeyId(): string {
  return readTrimmedEnv("RAZORPAY_KEY_ID", "RAZORPAY_API_KEY");
}

export async function ensureRazorpayCustomer(params: {
  existingCustomerId?: string | null;
  orgId: string;
  email?: string | null;
}) {
  const razorpay = getRazorpay();
  if (params.existingCustomerId) {
    return params.existingCustomerId;
  }
  const customer = await razorpay.customers.create({
    name: `Org ${params.orgId}`,
    email: params.email ?? undefined,
    notes: { org_id: params.orgId },
  });
  return customer.id;
}

export async function createMethodSetupOrder(params: {
  orgId: string;
  customerId: string;
  amountPaise?: number;
}) {
  const razorpay = getRazorpay();
  const order = await razorpay.orders.create({
    amount: params.amountPaise ?? 100,
    currency: "INR",
    receipt: `pm_setup_${params.orgId}_${Date.now()}`,
    notes: {
      org_id: params.orgId,
      purpose: "payment_method_setup",
      customer_id: params.customerId,
    },
  });
  return order;
}

export async function fetchPayment(paymentId: string) {
  const razorpay = getRazorpay();
  return razorpay.payments.fetch(paymentId);
}

export async function createInvoiceOrder(params: {
  orgId: string;
  invoiceId: string;
  amountPaise: number;
}) {
  const razorpay = getRazorpay();
  const order = await razorpay.orders.create({
    amount: params.amountPaise,
    currency: "INR",
    receipt: `invoice_${params.invoiceId}`,
    notes: {
      org_id: params.orgId,
      invoice_id: params.invoiceId,
      purpose: "postpaid_usage",
    },
  });
  return order;
}
