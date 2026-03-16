"use client";

import { useRef, useEffect, useCallback } from "react";
import { SendHorizontal, Loader2 } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  streaming: boolean;
}

export function MessageInput({
  value,
  onChange,
  onSend,
  disabled,
  streaming,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-md px-3 sm:px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      <div
        className="flex items-end gap-2 max-w-3xl mx-auto rounded-xl border border-border
          bg-card p-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/20 transition-all"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your data..."
          aria-label="Message input"
          disabled={disabled}
          className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed
            placeholder:text-muted-foreground/50 focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className="shrink-0 h-10 w-10 sm:h-9 sm:w-9 rounded-lg bg-primary text-primary-foreground
            flex items-center justify-center transition-all
            hover:bg-primary/90 active:bg-primary/80
            disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
        >
          {streaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </button>
      </div>
      <p className="hidden sm:block text-center text-[10px] text-muted-foreground/50 mt-1.5">
        Press Enter to send, Shift+Enter for a new line
      </p>
    </div>
  );
}
