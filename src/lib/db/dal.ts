import type { SupabaseClient } from "@supabase/supabase-js";

export function createOrgDAL(supabase: SupabaseClient, orgId: string) {
  return {
    dataSources: {
      list: () =>
        supabase
          .from("data_sources")
          .select("id, user_id, org_id, name, db_type, status, created_at, updated_at, last_tested_at")
          .eq("org_id", orgId)
          .order("updated_at", { ascending: false }),

      getById: (id: string) =>
        supabase
          .from("data_sources")
          .select("*")
          .eq("id", id)
          .eq("org_id", orgId)
          .single(),

      insert: (payload: Record<string, unknown>) =>
        supabase
          .from("data_sources")
          .insert({ ...payload, org_id: orgId })
          .select("*")
          .single(),

      update: (id: string, patch: Record<string, unknown>) =>
        supabase
          .from("data_sources")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq("org_id", orgId)
          .select("*")
          .single(),

      delete: (id: string) =>
        supabase
          .from("data_sources")
          .delete()
          .eq("id", id)
          .eq("org_id", orgId),
    },

    chatSessions: {
      list: (dataSourceId: string) =>
        supabase
          .from("chat_sessions")
          .select("id, user_id, data_source_id, org_id, title, archived, last_message_at, created_at, updated_at")
          .eq("org_id", orgId)
          .eq("data_source_id", dataSourceId)
          .eq("archived", false)
          .order("last_message_at", { ascending: false }),

      getById: (chatId: string) =>
        supabase
          .from("chat_sessions")
          .select("*")
          .eq("id", chatId)
          .eq("org_id", orgId)
          .single(),

      create: (payload: Record<string, unknown>) =>
        supabase
          .from("chat_sessions")
          .insert({ ...payload, org_id: orgId })
          .select("*")
          .single(),

      archive: (chatId: string) =>
        supabase
          .from("chat_sessions")
          .update({ archived: true, updated_at: new Date().toISOString() })
          .eq("id", chatId)
          .eq("org_id", orgId),

      update: (chatId: string, patch: Record<string, unknown>) =>
        supabase
          .from("chat_sessions")
          .update(patch)
          .eq("id", chatId)
          .eq("org_id", orgId)
          .select("*")
          .single(),

      touch: (chatId: string) =>
        supabase
          .from("chat_sessions")
          .update({
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", chatId),
    },

    chatMessages: {
      list: (chatSessionId: string, limit = 100) =>
        supabase
          .from("chat_messages")
          .select("*")
          .eq("chat_session_id", chatSessionId)
          .order("created_at", { ascending: true })
          .limit(limit),

      listRecent: (chatSessionId: string, limit = 30) =>
        supabase
          .from("chat_messages")
          .select("*")
          .eq("chat_session_id", chatSessionId)
          .order("created_at", { ascending: false })
          .limit(limit),

      create: (payload: Record<string, unknown>) =>
        supabase.from("chat_messages").insert(payload).select("*").single(),

      count: (chatSessionId: string) =>
        supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("chat_session_id", chatSessionId)
          .eq("role", "user"),

      update: (id: string, patch: Record<string, unknown>) =>
        supabase.from("chat_messages").update(patch).eq("id", id).select("*").single(),
    },

    queryRuns: {
      create: (payload: Record<string, unknown>) =>
        supabase.from("query_runs").insert(payload).select("*").single(),

      listForMessage: (messageId: string) =>
        supabase
          .from("query_runs")
          .select("*")
          .eq("chat_message_id", messageId)
          .order("attempt_index", { ascending: false }),

      listForMessages: (messageIds: string[]) => {
        if (messageIds.length === 0) {
          return Promise.resolve({ data: [] as Record<string, unknown>[], error: null });
        }
        return supabase
          .from("query_runs")
          .select("*")
          .in("chat_message_id", messageIds)
          .order("attempt_index", { ascending: true });
      },
    },

    dataSourceAccess: {
      check: async (userId: string, dataSourceId: string) => {
        const { data } = await supabase
          .from("data_source_access")
          .select("id")
          .eq("org_id", orgId)
          .eq("user_id", userId)
          .eq("data_source_id", dataSourceId)
          .single();
        return !!data;
      },

      list: (dataSourceId?: string) => {
        let query = supabase
          .from("data_source_access")
          .select("*")
          .eq("org_id", orgId);
        if (dataSourceId) {
          query = query.eq("data_source_id", dataSourceId);
        }
        return query;
      },
    },
  };
}
