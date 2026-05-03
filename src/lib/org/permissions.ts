import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type OrgRole = "owner" | "admin" | "member";

export interface OrgContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  orgId: string;
  role: OrgRole;
}

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

export function hasMinRole(actual: OrgRole, required: OrgRole): boolean {
  return ROLE_HIERARCHY[actual] >= ROLE_HIERARCHY[required];
}

export async function requireOrgMember(orgId: string): Promise<
  | { ctx: OrgContext; error: null }
  | { ctx: null; error: NextResponse }
> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { ctx: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const fullOrg = await auth.api.getFullOrganization({
    headers: await headers(),
    query: { organizationId: orgId },
  });

  if (!fullOrg) {
    return { ctx: null, error: NextResponse.json({ error: "Organization not found" }, { status: 404 }) };
  }

  const member = fullOrg.members.find((m) => m.userId === session.user.id);
  if (!member) {
    return { ctx: null, error: NextResponse.json({ error: "Not a member of this organization" }, { status: 403 }) };
  }

  const supabase = await createClient();
  return {
    ctx: {
      supabase,
      userId: session.user.id,
      orgId,
      role: member.role as OrgRole,
    },
    error: null,
  };
}

export async function requireOrgRole(orgId: string, minRole: OrgRole): Promise<
  | { ctx: OrgContext; error: null }
  | { ctx: null; error: NextResponse }
> {
  const result = await requireOrgMember(orgId);
  if (result.error) return result;

  if (!hasMinRole(result.ctx.role, minRole)) {
    return {
      ctx: null,
      error: NextResponse.json(
        { error: `Requires ${minRole} role or higher` },
        { status: 403 }
      ),
    };
  }

  return result;
}

export async function checkDataSourceAccess(
  orgId: string,
  userId: string,
  dataSourceId: string,
  role: OrgRole
): Promise<boolean> {
  if (role === "owner" || role === "admin") return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from("data_source_access")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("data_source_id", dataSourceId)
    .single();

  return !!data;
}
