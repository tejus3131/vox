import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchemaCompatibility } from "@/lib/app-runtime";
import { requireUser } from "@/lib/api/auth";
import { runQuery } from "@/lib/ai/langgraph/query-service";

const querySchema = z.object({
  query: z.string().min(1),
  request_id: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const gate = await ensureSchemaCompatibility();
  if (!gate.ok) return gate.response;

  const { supabase, user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;

  const { chatId } = await params;
  const parsed = querySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const output = await runQuery(supabase, user, {
    chatId,
    query: parsed.data.query,
    requestId: parsed.data.request_id,
  });

  return new Response(output.stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
