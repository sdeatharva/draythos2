"use client";

import React from "react";
import { History, ArrowRight } from "lucide-react";

interface ChangeLogProps {
  logs: Array<{
    log_id: string;
    mapping_version: number;
    op: string;
    alias: string;
    old_concept?: string;
    new_concept?: string;
    by?: string;
    reason?: string;
    at: string;
  }>;
}

export function ChangeLog({ logs }: ChangeLogProps) {
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-surface border border-hairline rounded-lg p-4 text-center text-xs text-muted">
        No override modifications recorded yet. Baseline seed active.
      </div>
    );
  }

  return (
    <div className="bg-surface border border-hairline rounded-lg p-4 space-y-3 shadow-2xs">
      <div className="flex items-center gap-2">
        <History className="w-3.5 h-3.5 text-muted" />
        <h3 className="text-sm font-medium text-primary">
          Version history and audit log
        </h3>
      </div>

      <div className="overflow-x-auto rounded border border-hairline">
        <table className="w-full text-left text-xs text-secondary">
          <thead className="bg-raised text-secondary font-normal border-b border-hairline text-xs">
            <tr>
              <th className="py-2.5 px-3 font-normal">Version</th>
              <th className="py-2.5 px-3 font-normal">Operation</th>
              <th className="py-2.5 px-3 font-normal">Synonym</th>
              <th className="py-2.5 px-3 font-normal">Transition</th>
              <th className="py-2.5 px-3 font-normal">Reason / user</th>
              <th className="py-2.5 px-3 font-normal">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline font-mono text-xs">
            {logs.map((log) => (
              <tr key={log.log_id} className="hover:bg-raised/50 transition-colors">
                <td className="py-2.5 px-3 font-medium text-primary tabular">
                  v{log.mapping_version}
                </td>
                <td className="py-2.5 px-3 text-muted">{log.op}</td>
                <td className="py-2.5 px-3 text-primary">
                  {log.alias}
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted">{log.old_concept || "none"}</span>
                    <ArrowRight className="w-3 h-3 text-muted" />
                    <span className="text-positive font-medium">{log.new_concept || "deleted"}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 font-sans text-secondary">
                  {log.reason || "—"} ({log.by || "user"})
                </td>
                <td className="py-2.5 px-3 text-muted text-[11px] tabular">
                  {new Date(log.at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
