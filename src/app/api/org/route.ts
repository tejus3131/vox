import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOrgRole } from "@/lib/org/permissions";

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createOrgSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const org = await auth.api.createOrganization({
    headers: await headers(),
    body: {
      name: parsed.data.name,
      slug: `org-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    },
  });

  if (!org) {
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }

  const supabase = await createClient();
  await supabase.from("billing_accounts").insert({
    org_id: org.id,
    status: "trial",
    trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return NextResponse.json({ organization: org });
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await auth.api.listOrganizations({
    headers: await headers(),
  });

  return NextResponse.json({ organizations: orgs ?? [] });
}

const deleteOrgSchema = z.object({
  orgId: z.string().min(1),
});

export async function DELETE(request: Request) {
  const parsed = deleteOrgSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orgId } = parsed.data;
  const roleResult = await requireOrgRole(orgId, "owner");
  if (roleResult.error) return roleResult.error;

  try {
    await auth.api.deleteOrganization({
      headers: await headers(),
      body: { organizationId: orgId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete organization";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
