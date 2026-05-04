import { getResend } from "./resend";

const FROM = process.env.EMAIL_FROM ?? "Vox <noreply@vox.app>";

export async function sendVerificationEmail(params: {
  to: string;
  url: string;
  name?: string | null;
}) {
  const resend = getResend();
  const displayName = params.name?.trim() || "there";

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Verify your Vox email",
    html: `
      <h2>Verify your email</h2>
      <p>Hi ${displayName}, please verify your email to continue signing in to Vox.</p>
      <p><a href="${params.url}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Verify Email</a></p>
      <p style="color:#666;font-size:14px;">If you didn't create this account, you can ignore this message.</p>
    `,
  });
}

