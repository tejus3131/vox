"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage, ChatSession, QueryRun, StreamEvent } from "@/types";
import { ChatSidebar } from "./chat-sidebar";
import { MessageBubble, StreamBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { LiveQueryCard } from "./query-result-card";
import { PanelLeft, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  orgId: string;
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
  orgId,
  dbId,
  activeChatId,
  initialChats,
  initialMessages,
  initialQueryRunsByMessage,
}: Props) {
  const router = useRouter();
  const sendInFlightRef = useRef(false);
  const activeRequestIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [localChatId, setLocalChatId] = useState<string | null>(activeChatId);
  const [chats, setChats] = useState(initialChats);
  const [messages, setMessages] = useState(initialMessages);
  const [queryRunsByMessage, setQueryRunsByMessage] = useState<
    Record<string, QueryRun[]>
  >(initialQueryRunsByMessage);
  const [input, setInput] = useState("");
  const [sendPhase, setSendPhase] = useState<SendPhase>("idle");
  const [streamText, setStreamText] = useState("");
  const [liveQueryAttempts, setLiveQueryAttempts] = useState<QueryAttemptUI[]>(
    []
  );
  const [sendError, setSendError] = useState<string | null>(null);
  const isStreaming = sendPhase !== "idle";
  const routeFor = (chatId?: string | null) =>
    chatId ? `/${orgId}/${dbId}/${chatId}` : `/${orgId}/${dbId}`;

  useEffect(() => {
    setLocalChatId(activeChatId);
  }, [activeChatId]);

  // Auto-scroll to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamText, liveQueryAttempts]);

  const removeChat = async (id: string) => {
    const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id || localChatId === id) {
      setLocalChatId(null);
      router.push(routeFor());
    }
  };

  const readSseStream = async (
    response: Response,
    requestId: string,
    applyEvent: (event: StreamEvent) => void
  ) => {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const dataLines = frame
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.slice(6).trim())
          .filter(Boolean);
        if (dataLines.length === 0) continue;
        const payload = dataLines.join("\n");
        let event: StreamEvent;
        try {
          event = JSON.parse(payload) as StreamEvent;
        } catch {
          continue;
        }
        if (
          event.request_id !== requestId ||
          activeRequestIdRef.current !== requestId
        ) {
          continue;
        }
        applyEvent(event);
      }
    }
  };

  const hydrateChatState = async (
    chatId: string,
    streamedText: string,
    terminalErrorMessage: string | null,
    finalAssistantId: string | null
  ) => {
    setSendPhase("hydrating_messages");
    const messagesRes = await fetch(`/api/chats/${chatId}/messages`);
    if (messagesRes.ok) {
      const body = await messagesRes.json();
      setMessages(body.messages ?? []);
      setQueryRunsByMessage(body.query_runs_by_message ?? {});
      return true;
    }

    // Hydration failed: keep streamed response visible and preserve existing cards.
    if (streamedText || finalAssistantId || terminalErrorMessage) {
      setMessages((prev) => [
        ...prev,
        {
          id: finalAssistantId ?? `tmp-assistant-${Date.now()}`,
          chat_session_id: chatId,
          role: "assistant",
          content: streamedText || "Query failed before a final answer was generated.",
          status: terminalErrorMessage ? "error" : "completed",
          model: null,
          token_usage: null,
          error: terminalErrorMessage ? { message: terminalErrorMessage } : null,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    return false;
  };

  const refreshChats = async (requestId: string) => {
    const chatsRes = await fetch(`/api/data-sources/${dbId}/chats`);
    if (!chatsRes.ok) return;
    const body = await chatsRes.json();
    if (
      activeRequestIdRef.current !== null &&
      activeRequestIdRef.current !== requestId
    ) {
      return;
    }
    setChats(body.chat_sessions ?? []);
  };

  const runStreamFlow = async ({
    requestId,
    chatId,
    request,
    optimisticUserContent,
  }: {
    requestId: string;
    chatId: string;
    request: Promise<Response>;
    optimisticUserContent?: string;
  }) => {
    setSendError(null);
    if (optimisticUserContent) {
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-user-${Date.now()}`,
          chat_session_id: chatId,
          role: "user",
          content: optimisticUserContent,
          status: "completed",
          model: null,
          token_usage: null,
          error: null,
          created_at: new Date().toISOString(),
        },
      ]);
    }

    const res = await request;
    if (!res.ok || !res.body) {
      let message = "Failed to send message.";
      try {
        const body = await res.json();
        if (typeof body?.error === "string") message = body.error;
      } catch {
        // noop
      }
      throw new Error(message);
    }

    let finalAssistantId: string | null = null;
    let streamedText = "";
    let terminalErrorMessage: string | null = null;

    await readSseStream(res, requestId, (event) => {
      if (event.type === "title_updated") {
        setChats((prev) =>
          prev.map((c) =>
            c.id === event.chat_session_id ? { ...c, title: event.title } : c
          )
        );
        return;
      }
      if (event.type === "text") {
        streamedText += event.delta;
        setStreamText(streamedText);
        return;
      }
      if (event.type === "sql") {
        setLiveQueryAttempts((prev) => {
          const existing = prev.find((a) => a.id === event.query_run_id);
          if (existing) {
            return prev.map((a) =>
              a.id === event.query_run_id ? { ...a, sqlText: event.sql_text } : a
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
        return;
      }
      if (event.type === "query_result_preview") {
        setLiveQueryAttempts((prev) => {
          const existing = prev.find((a) => a.id === event.query_run_id);
          if (existing) {
            return prev.map((a) =>
              a.id === event.query_run_id
                ? {
                    ...a,
                    rowsPreview: event.rows_preview,
                    columns: event.columns,
                  }
                : a
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
        return;
      }
      if (event.type === "done") {
        finalAssistantId = event.assistant_message_id;
        return;
      }
      if (event.type === "error") {
        terminalErrorMessage = event.message;
      }
    });

    const hydrated = await hydrateChatState(
      chatId,
      streamedText,
      terminalErrorMessage,
      finalAssistantId
    );

    if (!hydrated && terminalErrorMessage) {
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-assistant-error-${Date.now()}`,
          chat_session_id: chatId,
          role: "assistant",
          content: "I ran into an error while processing your request.",
          status: "error",
          model: null,
          token_usage: null,
          error: { message: terminalErrorMessage },
          created_at: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleSend = async () => {
    if (sendInFlightRef.current) return;
    const rawInput = input;
    const query = rawInput.trim();
    if (!query || isStreaming) return;

    sendInFlightRef.current = true;
    setInput("");
    setSendError(null);
    setSendPhase("streaming");
    setStreamText("");
    setLiveQueryAttempts([]);

    const requestId = crypto.randomUUID();
    activeRequestIdRef.current = requestId;

    try {
      let chatIdForSend = activeChatId ?? localChatId;

      if (!chatIdForSend) {
        const createRes = await fetch(`/api/data-sources/${dbId}/chats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Chat" }),
        });
        if (!createRes.ok) {
          let message = "Failed to create chat.";
          try {
            const body = await createRes.json();
            if (typeof body?.error === "string") message = body.error;
          } catch {
            // noop
          }
          throw new Error(message);
        }
        const created = await createRes.json();
        const chatSession = created.chat_session as ChatSession | undefined;
        if (!chatSession) throw new Error("chat_create_missing_session");
        chatIdForSend = chatSession.id;
        setLocalChatId(chatSession.id);
        setChats((prev) =>
          prev.some((c) => c.id === chatSession.id) ? prev : [chatSession, ...prev]
        );
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", routeFor(chatSession.id));
        }
      }

      await runStreamFlow({
        requestId,
        chatId: chatIdForSend,
        request: fetch(`/api/chats/${chatIdForSend}/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, request_id: requestId }),
        }),
        optimisticUserContent: query,
      });

      setStreamText("");
      setLiveQueryAttempts([]);
      setSendPhase("idle");
      void refreshChats(requestId);
    } catch (error) {
      setSendPhase("idle");
      setStreamText("");
      setLiveQueryAttempts([]);
      setInput(rawInput);
      setSendError(error instanceof Error ? error.message : "Failed to send message.");
    } finally {
      if (activeRequestIdRef.current === requestId) {
        activeRequestIdRef.current = null;
      }
      sendInFlightRef.current = false;
    }
  };

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Sidebar backdrop on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <ChatSidebar
        orgId={orgId}
        dbId={dbId}
        chats={chats}
        activeChatId={activeChatId ?? localChatId}
        onNewChat={() => {
          setLocalChatId(null);
          setMessages([]);
          setQueryRunsByMessage({});
          router.push(routeFor());
        }}
        onSelectChat={(id) => router.push(routeFor(id))}
        onDeleteChat={removeChat}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
      />

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-background/80 backdrop-blur-md">
          {!sidebarOpen && (
            <Button
              variant="icon"
              size="icon"
              className="h-9 w-9 sm:h-8 sm:w-8"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}
          <Database className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium truncate">
            {chats.find((c) => c.id === (activeChatId ?? localChatId))
              ?.title ?? "New conversation"}
          </span>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 sm:px-6 space-y-3">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Database className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              </div>
              <h2 className="font-semibold text-lg sm:text-xl">
                Ask about your data
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Type a question in plain English and Vox will generate SQL,
                run it against your database, and show you the results.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  queryRuns={queryRunsByMessage[msg.id]}
                />
              ))}

              {/* Streaming assistant bubble */}
              {isStreaming && <StreamBubble text={streamText} />}

              {/* Live query attempts during streaming */}
              {isStreaming &&
                liveQueryAttempts.map((attempt, i) => (
                  <div key={attempt.id} className="ml-0 sm:ml-11">
                    <LiveQueryCard
                      id={attempt.id}
                      sqlText={attempt.sqlText}
                      columns={attempt.columns}
                      rowsPreview={attempt.rowsPreview}
                      index={i}
                      total={liveQueryAttempts.length}
                    />
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Input */}
        {sendError && (
          <div className="px-4 py-2 text-xs text-destructive border-t border-border bg-destructive/5">
            {sendError}
          </div>
        )}
        <MessageInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={isStreaming}
          streaming={isStreaming}
        />
      </main>
    </div>
  );
}
