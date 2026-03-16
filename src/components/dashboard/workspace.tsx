"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage, ChatSession, QueryRun, StreamEvent } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  dbId: string;
  activeChatId: string | null;
  initialChats: ChatSession[];
  initialMessages: ChatMessage[];
  initialQueryRunsByMessage: Record<string, QueryRun[]>;
}

type QueryAttemptUI = {
  id: string;
  sqlText: string;
  rowsPreview: Record<string, unknown>[];
  columns: string[];
};

type SendPhase = "idle" | "streaming" | "hydrating_messages";

export function Workspace({
  dbId,
  activeChatId,
  initialChats,
  initialMessages,
  initialQueryRunsByMessage,
}: Props) {
  const router = useRouter();
  const sendInFlightRef = useRef(false);
  const activeRequestIdRef = useRef<string | null>(null);
  const [localChatId, setLocalChatId] = useState<string | null>(activeChatId);
  const [chats, setChats] = useState(initialChats);
  const [messages, setMessages] = useState(initialMessages);
  const [queryRunsByMessage, setQueryRunsByMessage] = useState<Record<string, QueryRun[]>>(
    initialQueryRunsByMessage
  );
  const [input, setInput] = useState("");
  const [sendPhase, setSendPhase] = useState<SendPhase>("idle");
  const [streamText, setStreamText] = useState("");
  const [liveQueryAttempts, setLiveQueryAttempts] = useState<QueryAttemptUI[]>([]);
  const isStreaming = sendPhase !== "idle";
  const isSendDisabled = sendPhase !== "idle";

  useEffect(() => {
    setLocalChatId(activeChatId);
  }, [activeChatId]);

  const sortedChats = useMemo(
    () => [...chats].sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at)),
    [chats]
  );

  const removeChat = async (id: string) => {
    const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setChats((prev) => prev.filter((c) => c.id !== id));
    if ((activeChatId === id) || (localChatId === id)) {
      setLocalChatId(null);
      router.push(`/${dbId}`);
    }
  };

  const handleSend = async () => {
    if (sendInFlightRef.current) return;

    const query = input.trim();
    if (!query || isSendDisabled) return;
    sendInFlightRef.current = true;
    setInput("");
    setSendPhase("streaming");
    setStreamText("");
    setLiveQueryAttempts([]);
    let requestId: string | null = null;
    try {
      requestId = crypto.randomUUID();
      activeRequestIdRef.current = requestId;
      let chatIdForSend = activeChatId ?? localChatId;

      if (!chatIdForSend) {
        const createRes = await fetch(`/api/data-sources/${dbId}/chats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Chat" }),
        });
        if (!createRes.ok) {
          setSendPhase("idle");
          return;
        }
        const created = await createRes.json();
        const chatSession = created.chat_session as ChatSession | undefined;
        if (!chatSession) {
          setSendPhase("idle");
          return;
        }
        chatIdForSend = chatSession.id;
        setLocalChatId(chatSession.id);
        setChats((prev) => {
          if (prev.some((c) => c.id === chatSession.id)) return prev;
          return [chatSession, ...prev];
        });
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `/${dbId}/${chatSession.id}`);
        }
      }

      const endpoint = `/api/chats/${chatIdForSend}/query`;

      setMessages((prev) => [
      ...prev,
      {
        id: `tmp-user-${Date.now()}`,
        chat_session_id: chatIdForSend ?? "pending",
        role: "user",
        content: query,
        status: "completed",
        model: null,
        token_usage: null,
        error: null,
        created_at: new Date().toISOString(),
      },
    ]);

      const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, request_id: requestId }),
    });

      if (!res.ok || !res.body) {
        setSendPhase("idle");
        return;
      }

      const resolvedChatId = chatIdForSend;
      let finalAssistantId: string | null = null;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamedText = "";
      let terminalErrorMessage: string | null = null;

      while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;
        let event: StreamEvent;
        try {
          event = JSON.parse(payload) as StreamEvent;
        } catch {
          continue;
        }
        if (event.request_id !== requestId || activeRequestIdRef.current !== requestId) {
          continue;
        }

        if (event.type === "title_updated") {
          setChats((prev) =>
            prev.map((chat) =>
              chat.id === event.chat_session_id ? { ...chat, title: event.title } : chat
            )
          );
        } else if (event.type === "text") {
          streamedText += event.delta;
          setStreamText(streamedText);
        } else if (event.type === "sql") {
          setLiveQueryAttempts((prev) => {
            const existing = prev.find((attempt) => attempt.id === event.query_run_id);
            if (existing) {
              return prev.map((attempt) =>
                attempt.id === event.query_run_id ? { ...attempt, sqlText: event.sql_text } : attempt
              );
            }
            return [
              ...prev,
              {
                id: event.query_run_id,
                sqlText: event.sql_text,
                rowsPreview: [],
                columns: [],
              },
            ];
          });
        } else if (event.type === "query_result_preview") {
          setLiveQueryAttempts((prev) => {
            const existing = prev.find((attempt) => attempt.id === event.query_run_id);
            if (existing) {
              return prev.map((attempt) =>
                attempt.id === event.query_run_id
                  ? {
                      ...attempt,
                      rowsPreview: event.rows_preview,
                      columns: event.columns,
                    }
                  : attempt
              );
            }
            return [
              ...prev,
              {
                id: event.query_run_id,
                sqlText: "",
                rowsPreview: event.rows_preview,
                columns: event.columns,
              },
            ];
          });
        } else if (event.type === "done") {
          finalAssistantId = event.assistant_message_id;
        } else if (event.type === "error") {
          terminalErrorMessage = event.message;
        }
      }
      }

      if (resolvedChatId) {
      setSendPhase("hydrating_messages");
      const messagesRes = await fetch(`/api/chats/${resolvedChatId}/messages`);
      if (messagesRes.ok) {
        const body = await messagesRes.json();
        setMessages(body.messages ?? []);
        setQueryRunsByMessage(body.query_runs_by_message ?? {});
        setLiveQueryAttempts([]);
      } else if (finalAssistantId) {
        setMessages((prev) => [
          ...prev,
          {
            id: finalAssistantId,
            chat_session_id: resolvedChatId,
            role: "assistant",
            content: streamedText,
            status: terminalErrorMessage ? "error" : "completed",
            model: null,
            token_usage: null,
            error: terminalErrorMessage ? { message: terminalErrorMessage } : null,
            created_at: new Date().toISOString(),
          },
        ]);
      }

      setStreamText("");
      setSendPhase("idle");

      void (async () => {
        const chatsRes = await fetch(`/api/data-sources/${dbId}/chats`);
        if (!chatsRes.ok) return;
        const body = await chatsRes.json();
        if (activeRequestIdRef.current !== null && activeRequestIdRef.current !== requestId) return;
        setChats(body.chat_sessions ?? []);
      })();
      } else if (finalAssistantId) {
      setMessages((prev) => [
        ...prev,
        {
          id: finalAssistantId,
          chat_session_id: activeChatId ?? "pending",
          role: "assistant",
          content: streamedText,
          status: "completed",
          model: null,
          token_usage: null,
          error: null,
          created_at: new Date().toISOString(),
        },
      ]);
        setSendPhase("idle");
        setStreamText("");
      } else {
        setSendPhase("idle");
        setStreamText("");
      }
    } catch {
      setSendPhase("idle");
      setStreamText("");
      setLiveQueryAttempts([]);
    } finally {
      if (activeRequestIdRef.current === requestId) {
        activeRequestIdRef.current = null;
      }
      sendInFlightRef.current = false;
    }
  };

  return (
    <div className="flex h-[100dvh]">
      <aside className="w-72 border-r border-border p-3 space-y-3 overflow-y-auto">
        <button
          className="w-full h-9 rounded bg-primary text-primary-foreground text-sm"
          onClick={() => {
            setLocalChatId(null);
            router.push(`/${dbId}`);
          }}
        >
          New Chat
        </button>
        {sortedChats.map((chat) => (
          <div key={chat.id} className="rounded border border-border p-2 text-sm">
            <button
              className="w-full text-left"
              onClick={() => router.push(`/${dbId}/${chat.id}`)}
            >
              {chat.title}
            </button>
            <button
              className="text-xs text-destructive mt-1"
              onClick={() => void removeChat(chat.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              <div className="text-xs text-muted-foreground">{msg.role}</div>
              <div className="rounded-lg border border-border p-3 whitespace-pre-wrap prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
              {msg.role === "assistant" && (queryRunsByMessage[msg.id]?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  {queryRunsByMessage[msg.id]
                    .slice()
                    .sort((a, b) => a.attempt_index - b.attempt_index)
                    .map((run, i) => (
                      <details key={run.id} open className="rounded-lg border border-border p-3">
                        <summary className="cursor-pointer text-sm font-medium">
                          SQL Query #{i + 1}
                        </summary>
                        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">{run.sql_text}</pre>
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm">Result Preview</summary>
                          <div className="overflow-x-auto mt-2">
                            <table className="text-xs min-w-full">
                              <thead>
                                <tr>
                                  {(run.columns ?? []).map((c) => (
                                    <th key={c} className="text-left border-b border-border px-2 py-1">{c}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(run.rows_preview ?? []).map((row, idx) => (
                                  <tr key={idx}>
                                    {(run.columns ?? []).map((c) => (
                                      <td key={`${idx}-${c}`} className="border-b border-border px-2 py-1">
                                        {String(row[c] ?? "")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </details>
                    ))}
                </div>
              )}
            </div>
          ))}
          {isStreaming && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">assistant</div>
              <div className="rounded-lg border border-border p-3 whitespace-pre-wrap">{streamText || "Thinking..."}</div>
            </div>
          )}
          {isStreaming && liveQueryAttempts.map((attempt, i) => (
            <details key={attempt.id} open className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                SQL Query {liveQueryAttempts.length > 1 ? `#${i + 1}` : ""}
              </summary>
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">{attempt.sqlText}</pre>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm">Result Preview</summary>
                <div className="overflow-x-auto mt-2">
                  <table className="text-xs min-w-full">
                    <thead>
                      <tr>
                        {attempt.columns.map((c) => (
                          <th key={c} className="text-left border-b border-border px-2 py-1">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attempt.rowsPreview.map((row, idx) => (
                        <tr key={idx}>
                          {attempt.columns.map((c) => (
                            <td key={`${idx}-${c}`} className="border-b border-border px-2 py-1">
                              {String(row[c] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </details>
          ))}
        </div>
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2">
            <input
              className="h-10 flex-1 rounded border border-border bg-background px-3"
              placeholder="Ask a question about your data..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <button
              className="h-10 px-4 rounded bg-primary text-primary-foreground disabled:opacity-60"
              onClick={() => void handleSend()}
              disabled={isSendDisabled}
            >
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
