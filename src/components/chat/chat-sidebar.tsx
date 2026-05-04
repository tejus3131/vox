"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ChatSession } from "@/types";
import {
  ArrowLeft,
  Plus,
  Trash2,
  MessageSquare,
  PanelLeftClose,
  LogOut,
} from "lucide-react";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface Props {
  orgId: string;
  dbId: string;
  chats: ChatSession[];
  activeChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  open: boolean;
  onToggle: () => void;
}

export function ChatSidebar({
  orgId,
  dbId,
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  open,
  onToggle,
}: Props) {
  const router = useRouter();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...chats].sort(
        (a, b) =>
          +new Date(b.last_message_at) - +new Date(a.last_message_at)
      ),
    [chats]
  );

  return (
    <aside
      className={`shrink-0 border-r border-border bg-sidebar flex flex-col transition-all duration-300 ease-in-out overflow-hidden
        ${open ? "w-72" : "w-0 border-r-0"}
        max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-xl
        ${open ? "max-md:w-72" : "max-md:w-0"}`}
    >
      <div className="flex flex-col h-full min-w-[18rem]">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <button
            onClick={() => router.push(`/${orgId}`)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium">Databases</span>
          </button>
          <div className="flex-1" />
          <Button variant="icon" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" onClick={onToggle} aria-label="Close sidebar">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        {/* New chat */}
        <div className="px-3 pt-3 pb-1">
          <Button
            variant="secondary"
            className="w-full justify-start"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={onNewChat}
          >
            New Chat
          </Button>
        </div>

        {/* Chat list */}
        <nav aria-label="Chat history" className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {sorted.length === 0 && (
            <p className="px-3 py-6 text-xs text-muted-foreground text-center">
              No conversations yet
            </p>
          )}
          {sorted.map((chat) => {
            const isActive = chat.id === activeChatId;
            const isConfirming = confirmDeleteId === chat.id;

            if (isConfirming) {
              return (
                <div
                  key={chat.id}
                  className="flex flex-col gap-2 px-3 py-2.5 rounded-lg bg-destructive/5 border border-destructive/15"
                >
                  <p className="text-xs text-destructive">
                    Delete this chat?
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        onDeleteChat(chat.id);
                        setConfirmDeleteId(null);
                      }}
                    >
                      Delete
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={chat.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors
                  ${
                    isActive
                      ? "bg-accent/60 text-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                onClick={() => onSelectChat(chat.id)}
              >
                <MessageSquare
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span className="flex-1 truncate text-sm">
                  {chat.title}
                </span>

                {/* Timestamp -- hidden on hover, replaced by delete */}
                <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums group-hover:hidden">
                  {timeAgo(chat.last_message_at)}
                </span>
                <button
                  className="hidden group-hover:flex shrink-0
                    p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(chat.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            leftIcon={<LogOut className="h-4 w-4" />}
            onClick={async () => {
              const { signOut } = await import("@/lib/auth-client");
              await signOut();
              window.location.href = "/";
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </aside>
  );
}
