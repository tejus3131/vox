import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgRole, requireOrgMember } from "@/lib/org/permissions";

const grantSchema = z.object({
  orgId: z.string().min(1),
  userId: z.string().min(1),
  dataSourceId: z.string().uuid(),
});

const revokeSchema = z.object({
  orgId: z.string().min(1),
  userId: z.string().min(1),
  dataSourceId: z.string().uuid(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  const dataSourceId = searchParams.get("dataSourceId");

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const result = await requireOrgMember(orgId);
  if (result.error) return result.error;

  let query = result.ctx.supabase
    .from("data_source_access")
    .select("*")
    .eq("org_id", orgId);

  if (dataSourceId) {
    query = query.eq("data_source_id", dataSourceId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ grants: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = grantSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orgId, userId, dataSourceId } = parsed.data;
  const result = await requireOrgRole(orgId, "admin");
  if (result.error) return result.error;

  const { data, error } = await result.ctx.supabase
    .from("data_source_access")
    .upsert(
      {
        org_id: orgId,
        user_id: userId,
        data_source_id: dataSourceId,
        granted_by: result.ctx.userId,
      } as Record<string, unknown>,
      { onConflict: "org_id,user_id,data_source_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ grant: data });
}

export async function DELETE(request: Request) {
  const parsed = revokeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orgId, userId, dataSourceId } = parsed.data;
  const result = await requireOrgRole(orgId, "admin");
  if (result.error) return result.error;

  const { error } = await result.ctx.supabase
    .from("data_source_access")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("data_source_id", dataSourceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
