import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { requireOrgRole, requireOrgMember } from "@/lib/org/permissions";

const updateMemberSchema = z.object({
  orgId: z.string().min(1),
  memberId: z.string().min(1),
  role: z.enum(["admin", "member"]),
});

const removeMemberSchema = z.object({
  orgId: z.string().min(1),
  memberId: z.string().min(1),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const result = await requireOrgMember(orgId);
  if (result.error) return result.error;

  const fullOrg = await auth.api.getFullOrganization({
    headers: await headers(),
    query: { organizationId: orgId },
  });

  return NextResponse.json({
    members: fullOrg?.members ?? [],
    invitations: fullOrg?.invitations ?? [],
  });
}

export async function PATCH(request: Request) {
  const parsed = updateMemberSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orgId, memberId, role } = parsed.data;
  const result = await requireOrgRole(orgId, "admin");
  if (result.error) return result.error;

  try {
    await auth.api.updateMemberRole({
      headers: await headers(),
      body: {
        organizationId: orgId,
        memberId,
        role,
      },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update role";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const parsed = removeMemberSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orgId, memberId } = parsed.data;
  const result = await requireOrgRole(orgId, "admin");
  if (result.error) return result.error;

  try {
    await auth.api.removeMember({
      headers: await headers(),
      body: {
        organizationId: orgId,
        memberIdOrEmail: memberId,
      },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove member";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
