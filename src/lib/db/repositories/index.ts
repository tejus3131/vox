import type { SupabaseClient } from "@supabase/supabase-js";

export async function listDataSources(supabase: SupabaseClient, userId: string) {
  return supabase
    .from("data_sources")
    .select("id, user_id, name, db_type, status, created_at, updated_at, last_tested_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
}

export async function getDataSourceById(supabase: SupabaseClient, userId: string, id: string) {
  return supabase
    .from("data_sources")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
}

export async function insertDataSource(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  return supabase.from("data_sources").insert(payload).select("*").single();
}

export async function updateDataSource(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Record<string, unknown>
) {
  return supabase
    .from("data_sources")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
}

export async function deleteDataSource(supabase: SupabaseClient, userId: string, id: string) {
  return supabase.from("data_sources").delete().eq("id", id).eq("user_id", userId);
}

export async function listChatSessions(
  supabase: SupabaseClient,
  userId: string,
  dataSourceId: string
) {
  return supabase
    .from("chat_sessions")
    .select("id, user_id, data_source_id, title, archived, last_message_at, created_at, updated_at")
    .eq("user_id", userId)
    .eq("data_source_id", dataSourceId)
    .eq("archived", false)
    .order("last_message_at", { ascending: false });
}

export async function createChatSession(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  return supabase.from("chat_sessions").insert(payload).select("*").single();
}

export async function getChatSessionById(supabase: SupabaseClient, userId: string, chatId: string) {
  return supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", chatId)
    .eq("user_id", userId)
    .single();
}

export async function archiveChatSession(supabase: SupabaseClient, userId: string, chatId: string) {
  return supabase
    .from("chat_sessions")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", chatId)
    .eq("user_id", userId);
}

export async function updateChatSession(
  supabase: SupabaseClient,
  chatId: string,
  userId: string,
  patch: Record<string, unknown>
) {
  return supabase
    .from("chat_sessions")
    .update(patch)
    .eq("id", chatId)
    .eq("user_id", userId)
    .select("*")
    .single();
}

export async function listChatMessages(
  supabase: SupabaseClient,
  chatSessionId: string,
  limit = 100
) {
  return supabase
    .from("chat_messages")
    .select("*")
    .eq("chat_session_id", chatSessionId)
    .order("created_at", { ascending: true })
    .limit(limit);
}

export async function listRecentChatMessages(
  supabase: SupabaseClient,
  chatSessionId: string,
  limit = 30
) {
  return supabase
    .from("chat_messages")
    .select("*")
    .eq("chat_session_id", chatSessionId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function createChatMessage(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  return supabase.from("chat_messages").insert(payload).select("*").single();
}

export async function countUserMessages(
  supabase: SupabaseClient,
  chatSessionId: string
) {
  return supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("chat_session_id", chatSessionId)
    .eq("role", "user");
}

export async function updateChatMessage(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>
) {
  return supabase.from("chat_messages").update(patch).eq("id", id).select("*").single();
}

export async function touchChatSession(
  supabase: SupabaseClient,
  chatSessionId: string
) {
  return supabase
    .from("chat_sessions")
    .update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", chatSessionId);
}

export async function createQueryRun(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  return supabase.from("query_runs").insert(payload).select("*").single();
}

export async function listQueryRunsForMessage(supabase: SupabaseClient, messageId: string) {
  return supabase
    .from("query_runs")
    .select("*")
    .eq("chat_message_id", messageId)
    .order("attempt_index", { ascending: false });
}

export async function listQueryRunsForMessages(
  supabase: SupabaseClient,
  messageIds: string[]
) {
  if (messageIds.length === 0) {
    return { data: [] as Record<string, unknown>[], error: null };
  }
  return supabase
    .from("query_runs")
    .select("*")
    .in("chat_message_id", messageIds)
    .order("attempt_index", { ascending: true });
}
