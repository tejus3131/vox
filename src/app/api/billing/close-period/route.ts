import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import { requireOrgRole } from "@/lib/org/permissions";
import { closeUsagePeriod } from "@/lib/billing/invoicing";

const bodySchema = z.object({
  orgId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    const result = await closeUsagePeriod({});
    return NextResponse.json({ result });
  }

  const { user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || !parsed.data.orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const roleResult = await requireOrgRole(parsed.data.orgId, "admin");
  if (roleResult.error) return roleResult.error;

  const result = await closeUsagePeriod({ orgId: parsed.data.orgId });
  return NextResponse.json({ result });
}
