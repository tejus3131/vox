"use client";

import { useState } from "react";
import { SettingsLayout } from "./settings-layout";

interface DataSource {
  id: string;
  name: string;
  status: string;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  user?: { name?: string; email?: string };
}

interface Grant {
  id: string;
  org_id: string;
  user_id: string;
  data_source_id: string;
}

interface Props {
  orgSlug: string;
  orgId: string;
  dataSources: DataSource[];
  members: Member[];
  grants: Grant[];
}

export function DatabaseAccessPage({ orgSlug, orgId, dataSources, members, grants }: Props) {
  const [localGrants, setLocalGrants] = useState(grants);
  const [toggling, setToggling] = useState<string | null>(null);

  const hasAccess = (userId: string, dsId: string) =>
    localGrants.some((g) => g.user_id === userId && g.data_source_id === dsId);

  const toggleAccess = async (userId: string, dsId: string) => {
    const key = `${userId}:${dsId}`;
    setToggling(key);

    const exists = hasAccess(userId, dsId);
    try {
      const res = await fetch("/api/org/data-source-access", {
        method: exists ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, userId, dataSourceId: dsId }),
      });

      if (res.ok) {
        if (exists) {
          setLocalGrants((prev) =>
            prev.filter((g) => !(g.user_id === userId && g.data_source_id === dsId))
          );
        } else {
          const data = await res.json();
          setLocalGrants((prev) => [...prev, data.grant]);
        }
      }
    } finally {
      setToggling(null);
    }
  };

  const regularMembers = members.filter((m) => m.role === "member");

  return (
    <SettingsLayout orgSlug={orgSlug}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Database Access</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Control which members can access each database. Owners and admins always have full access.
          </p>
        </div>

        {dataSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No databases connected yet.</p>
        ) : regularMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No regular members to manage access for. Owners and admins have full access.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium">Member</th>
                  {dataSources.map((ds) => (
                    <th key={ds.id} className="text-center px-4 py-2.5 font-medium">
                      {ds.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regularMembers.map((member) => (
                  <tr key={member.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{member.user?.name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                    </td>
                    {dataSources.map((ds) => {
                      const key = `${member.userId}:${ds.id}`;
                      const granted = hasAccess(member.userId, ds.id);
                      return (
                        <td key={ds.id} className="text-center px-4 py-3">
                          <button
                            onClick={() => toggleAccess(member.userId, ds.id)}
                            disabled={toggling === key}
                            className={`h-5 w-5 rounded border-2 transition-all cursor-pointer inline-flex items-center justify-center
                              ${granted
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-border hover:border-primary/50"
                              }
                              ${toggling === key ? "opacity-50" : ""}`}
                          >
                            {granted && (
                              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
