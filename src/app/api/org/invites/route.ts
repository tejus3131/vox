import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { requireOrgRole } from "@/lib/org/permissions";

const inviteSchema = z.object({
  orgId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
  resend: z.boolean().optional(),
});

export async function POST(request: Request) {
  const parsed = inviteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { code: "invite_invalid_request", error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { orgId, email, role, resend } = parsed.data;
  const result = await requireOrgRole(orgId, "admin");
  if (result.error) return result.error;

  try {
    const invitation = await auth.api.createInvitation({
      headers: await headers(),
      body: {
        organizationId: orgId,
        email,
        role,
        resend,
      },
    });

    return NextResponse.json({ invitation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create invitation";
    Sentry.captureException(err, {
      tags: { area: "org_invites", action: resend ? "resend" : "create" },
      extra: { orgId, email, role },
    });
    return NextResponse.json(
      {
        code: resend ? "invite_resend_failed" : "invite_create_failed",
        error: message,
      },
      { status: 400 }
    );
  }
}

const cancelInvitationSchema = z.object({
  orgId: z.string().min(1),
  invitationId: z.string().min(1),
});

export async function DELETE(request: Request) {
  const parsed = cancelInvitationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { code: "invite_cancel_invalid_request", error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { orgId, invitationId } = parsed.data;
  const result = await requireOrgRole(orgId, "admin");
  if (result.error) return result.error;

  try {
    await auth.api.cancelInvitation({
      headers: await headers(),
      body: { invitationId },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel invitation";
    Sentry.captureException(err, {
      tags: { area: "org_invites", action: "cancel" },
      extra: { orgId, invitationId },
    });
    return NextResponse.json(
      { code: "invite_cancel_failed", error: message },
      { status: 400 }
    );
  }
}
