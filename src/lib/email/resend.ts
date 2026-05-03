import { Resend } from "resend";

let instance: Resend | null = null;

export function getResend(): Resend {
  if (!instance) {
    instance = new Resend(process.env.RESEND_API_KEY);
  }
  return instance;
}

const FROM = process.env.EMAIL_FROM ?? "Vox <noreply@vox.app>";
const APP_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000";

async function sendEmailOrThrow(
  payload: Parameters<ReturnType<typeof getResend>["emails"]["send"]>[0]
) {
  const resend = getResend();
  const result = await resend.emails.send(payload);
  if (result.error) {
    throw new Error(result.error.message || "email_send_failed");
  }
  if (!result.data?.id) {
    throw new Error("email_send_missing_id");
  }
  return result.data;
}

export async function sendOrgInviteEmail(params: {
  to: string;
  orgName: string;
  role: string;
  invitationId: string;
}) {
  const inviteUrl = `${APP_URL}/invite/${params.invitationId}`;

  await sendEmailOrThrow({
    from: FROM,
    to: params.to,
    subject: `You've been invited to ${params.orgName}`,
    html: `
      <h2>You've been invited to ${params.orgName}</h2>
      <p>You've been invited as <strong>${params.role}</strong> to join <strong>${params.orgName}</strong> on Vox.</p>
      <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Accept Invite</a></p>
      <p style="color:#666;font-size:14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
    `,
  });
}

export async function sendWelcomeEmail(params: { to: string; name: string }) {
  await sendEmailOrThrow({
    from: FROM,
    to: params.to,
    subject: "Welcome to Vox",
    html: `
      <h2>Welcome to Vox, ${params.name}!</h2>
      <p>You're all set to start querying your databases with natural language.</p>
      <h3>Quick Start</h3>
      <ol>
        <li>Create an organization</li>
        <li>Connect a PostgreSQL database</li>
        <li>Start asking questions in plain English</li>
      </ol>
      <p><a href="${APP_URL}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Go to Vox</a></p>
    `,
  });
}

export async function sendPasswordResetEmail(params: { to: string; resetUrl: string }) {
  await sendEmailOrThrow({
    from: FROM,
    to: params.to,
    subject: "Reset your Vox password",
    html: `
      <h2>Password Reset</h2>
      <p>Click the button below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${params.resetUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Reset Password</a></p>
      <p style="color:#666;font-size:14px;">If you didn't request a password reset, you can safely ignore this email.</p>
    `,
  });
}

export async function sendUsageAlertEmail(params: {
  to: string;
  orgName: string;
  messageCount: number;
  estimatedCost: string;
}) {
  await sendEmailOrThrow({
    from: FROM,
    to: params.to,
    subject: `Usage alert for ${params.orgName}`,
    html: `
      <h2>Usage Alert</h2>
      <p>Your organization <strong>${params.orgName}</strong> has used <strong>${params.messageCount}</strong> messages this billing period.</p>
      <p>Estimated cost: <strong>${params.estimatedCost}</strong></p>
      <p><a href="${APP_URL}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View Usage</a></p>
    `,
  });
}

export async function sendInvoiceEmail(params: {
  to: string;
  orgName: string;
  invoiceId: string;
  period: string;
  amount: string;
}) {
  await sendEmailOrThrow({
    from: FROM,
    to: params.to,
    subject: `Invoice for ${params.orgName} - ${params.period}`,
    html: `
      <h2>Invoice #${params.invoiceId}</h2>
      <p>Invoice for <strong>${params.orgName}</strong> for the period <strong>${params.period}</strong>.</p>
      <p>Amount: <strong>${params.amount}</strong></p>
      <p><a href="${APP_URL}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View Invoice</a></p>
    `,
  });
}

export async function sendPaymentFailedEmail(params: {
  to: string;
  orgName: string;
  invoiceId: string;
}) {
  await sendEmailOrThrow({
    from: FROM,
    to: params.to,
    subject: `Payment failed for ${params.orgName}`,
    html: `
      <h2>Payment Failed</h2>
      <p>Payment failed for invoice <strong>#${params.invoiceId}</strong> for <strong>${params.orgName}</strong>.</p>
      <p>Please update your payment method within 7 days to avoid service interruption.</p>
      <p><a href="${APP_URL}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Update Payment Method</a></p>
    `,
  });
}
