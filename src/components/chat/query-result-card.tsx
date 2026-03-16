"use client";

import { useState } from "react";
import type { QueryRun } from "@/types";
import {
  ChevronDown,
  Code2,
  Table2,
  Copy,
  Check,
} from "lucide-react";

interface QueryResultCardProps {
  run: QueryRun;
  index: number;
  total: number;
}

export function QueryResultCard({ run, index, total }: QueryResultCardProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copySQL = async () => {
    await navigator.clipboard.writeText(run.sql_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const columns = run.columns ?? [];
  const rows = run.rows_preview ?? [];
  const label =
    total > 1 ? `SQL Query #${index + 1}` : "SQL Query";

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium
          hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <Code2 className="h-4 w-4 text-primary shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        {run.row_count != null && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {run.row_count} row{run.row_count !== 1 ? "s" : ""}
          </span>
        )}
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
            run.status === "ok"
              ? "bg-success/15 text-success"
              : run.status === "error"
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {run.status}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-border">
          {/* SQL */}
          <div className="relative">
            <pre className="p-3 text-xs font-mono bg-muted/40 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
              {run.sql_text}
            </pre>
            <button
              className="absolute top-2 right-2 p-1.5 rounded-md bg-card border border-border
                text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={copySQL}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Results table */}
          {columns.length > 0 && rows.length > 0 && (
            <div className="border-t border-border">
              <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
                <Table2 className="h-3.5 w-3.5" />
                Result Preview
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      {columns.map((c) => (
                        <th
                          key={c}
                          className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap sticky top-0 bg-muted/50"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-t border-border hover:bg-muted/30 transition-colors"
                      >
                        {columns.map((c) => (
                          <td
                            key={`${idx}-${c}`}
                            className="px-3 py-1.5 whitespace-nowrap font-mono tabular-nums"
                          >
                            {String(
                              (row as Record<string, unknown>)[c] ?? ""
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error */}
          {run.status === "error" && run.error_text && (
            <div className="border-t border-border px-4 py-3 text-xs text-destructive bg-destructive/5">
              {run.error_text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface LiveQueryCardProps {
  id: string;
  sqlText: string;
  columns: string[];
  rowsPreview: Record<string, unknown>[];
  index: number;
  total: number;
}

export function LiveQueryCard({
  sqlText,
  columns,
  rowsPreview,
  index,
  total,
}: LiveQueryCardProps) {
  const label =
    total > 1 ? `SQL Query #${index + 1}` : "SQL Query";

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
        <Code2 className="h-4 w-4 text-primary shrink-0 animate-pulse-subtle" />
        <span>{label}</span>
      </div>
      <div className="border-t border-border">
        <pre className="p-3 text-xs font-mono bg-muted/40 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
          {sqlText}
        </pre>
        {columns.length > 0 && rowsPreview.length > 0 && (
          <div className="border-t border-border">
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
              <Table2 className="h-3.5 w-3.5" />
              Result Preview
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    {columns.map((c) => (
                      <th
                        key={c}
                        className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowsPreview.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-t border-border"
                    >
                      {columns.map((c) => (
                        <td
                          key={`${idx}-${c}`}
                          className="px-3 py-1.5 whitespace-nowrap font-mono tabular-nums"
                        >
                          {String(row[c] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
