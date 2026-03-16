import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchemaCompatibility } from "@/lib/app-runtime";
import { requireUser } from "@/lib/api/auth";
import {
  deleteDataSource,
  getDataSourceById,
  updateDataSource,
} from "@/lib/db/repositories";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["active", "invalid", "disabled"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await ensureSchemaCompatibility();
  if (!gate.ok) return gate.response;

  const { supabase, user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await updateDataSource(supabase, user.id, id, patch);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to update data source" }, { status: 500 });
  }

  return NextResponse.json({ data_source: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await ensureSchemaCompatibility();
  if (!gate.ok) return gate.response;

  const { supabase, user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;
  const { id } = await params;

  const existing = await getDataSourceById(supabase, user.id, id);
  if (existing.error || !existing.data) {
    return NextResponse.json({ error: "Data source not found" }, { status: 404 });
  }

  const { error } = await deleteDataSource(supabase, user.id, id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
