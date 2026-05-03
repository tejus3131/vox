"use client";

import type { ChatMessage, QueryRun } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { QueryResultCard } from "./query-result-card";
import { User, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  message: ChatMessage;
  queryRuns?: QueryRun[];
  branchInfo?: { current: number; total: number; onSwitch: (index: number) => void };
}

export function MessageBubble({ message, queryRuns, branchInfo }: Props) {
  const isUser = message.role === "user";
  const editing = false;

  return (
    <div className={`group flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium mt-0.5 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-2 max-w-[90%] sm:max-w-[75%] min-w-0 ${isUser ? "items-end" : "items-start"}`}>
        {/* Branch navigation */}
        {branchInfo && branchInfo.total > 1 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <button
              onClick={() => branchInfo.onSwitch(branchInfo.current - 1)}
              disabled={branchInfo.current === 0}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="tabular-nums">
              {branchInfo.current + 1}/{branchInfo.total}
            </span>
            <button
              onClick={() => branchInfo.onSwitch(branchInfo.current + 1)}
              disabled={branchInfo.current === branchInfo.total - 1}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="relative">
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              isUser
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-card border border-border rounded-bl-md"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose-chat">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Edited indicator */}
          {message.branch_index != null && message.branch_index > 0 && !editing && (
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              (edited)
            </span>
          )}
        </div>

        {/* Query runs */}
        {!isUser && queryRuns && queryRuns.length > 0 && (
          <div className="w-full space-y-2">
            {queryRuns
              .slice()
              .sort((a, b) => a.attempt_index - b.attempt_index)
              .map((run, i) => (
                <QueryResultCard
                  key={run.id}
                  run={run}
                  index={i}
                  total={queryRuns.length}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StreamBubbleProps {
  text: string;
}

export function StreamBubble({ text }: StreamBubbleProps) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center mt-0.5">
        <Sparkles className="h-4 w-4 animate-pulse-subtle" />
      </div>
      <div className="max-w-[90%] sm:max-w-[75%] min-w-0">
        <div className="rounded-2xl rounded-bl-md bg-card border border-border px-4 py-2.5 text-sm leading-relaxed">
          {text ? (
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {text}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
              </div>
              <span className="text-xs">Thinking...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
