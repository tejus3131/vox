import { createClient } from "@/lib/supabase/server";

const PROMPT_TOKEN_RATE = Number(process.env.PROMPT_TOKEN_RATE_PAISE ?? "0.01");
const COMPLETION_TOKEN_RATE = Number(process.env.COMPLETION_TOKEN_RATE_PAISE ?? "0.03");
const TOOL_CALL_RATE = Number(process.env.TOOL_CALL_RATE_PAISE ?? "0.5");
const BILLING_MARGIN = Number(process.env.BILLING_MARGIN ?? "0.4");
const MIN_COST_PAISE = 1;

export function calculateCost(params: {
  promptTokens: number;
  completionTokens: number;
  toolCalls: number;
}): number {
  const rawCost =
    params.promptTokens * PROMPT_TOKEN_RATE +
    params.completionTokens * COMPLETION_TOKEN_RATE +
    params.toolCalls * TOOL_CALL_RATE;

  const withMargin = rawCost * (1 + BILLING_MARGIN);
  return Math.max(Math.ceil(withMargin), MIN_COST_PAISE);
}

export async function recordUsage(params: {
  orgId: string;
  userId: string;
  messageId: string;
  attemptIndex: number;
  toolCalls: number;
  promptTokens: number;
  completionTokens: number;
}): Promise<{ costPaise: number; blocked: boolean }> {
  const costPaise = calculateCost(params);
  const idempotencyKey = `${params.messageId}:${params.attemptIndex}`;

  const supabase = await createClient();

  const { data: billing } = await supabase
    .from("billing_accounts")
    .select("status, trial_ends_at")
    .eq("org_id", params.orgId)
    .single();

  if (billing) {
    const trialExpired =
      billing.status === "trial" &&
      new Date(billing.trial_ends_at) < new Date();

    if (trialExpired) {
      const { data: paymentMethod } = await supabase
        .from("payment_methods")
        .select("id")
        .eq("org_id", params.orgId)
        .eq("is_default", true)
        .single();

      if (!paymentMethod) {
        return { costPaise, blocked: true };
      }

      await supabase
        .from("billing_accounts")
        .update({ status: "active" })
        .eq("org_id", params.orgId);
    }

    if (billing.status === "suspended") {
      return { costPaise, blocked: true };
    }
  }

  await supabase.from("usage_ledger").upsert(
    {
      idempotency_key: idempotencyKey,
      org_id: params.orgId,
      user_id: params.userId,
      chat_message_id: params.messageId,
      tool_calls: params.toolCalls,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      cost_paise: costPaise,
    } as Record<string, unknown>,
    { onConflict: "idempotency_key", ignoreDuplicates: true }
  );

  return { costPaise, blocked: false };
}

export async function getOrgUsageSummary(orgId: string, periodStart: Date, periodEnd: Date) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("usage_ledger")
    .select("cost_paise, created_at")
    .eq("org_id", orgId)
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString());

  const totalPaise = (data ?? []).reduce((sum, row) => sum + (row.cost_paise as number), 0);
  return { totalPaise, entries: data?.length ?? 0 };
}
