"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsLayout } from "./settings-layout";
import { UserPlus, Shield, Crown, User, Trash2, Send, X } from "lucide-react";

interface Member {
  id: string;
  userId: string;
  role: string;
  user?: { name?: string; email?: string; image?: string };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
}

interface Props {
  orgSlug: string;
  orgId: string;
  members: Member[];
  invitations: Invitation[];
}

const roleIcons: Record<string, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
};

const roleColors: Record<string, string> = {
  owner: "text-amber-500",
  admin: "text-primary",
  member: "text-muted-foreground",
};

export function MembersPage({ orgSlug, orgId, members, invitations }: Props) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [sending, setSending] = useState(false);
  const [memberRows, setMemberRows] = useState<Member[]>(members);
  const [inviteRows, setInviteRows] = useState<Invitation[]>(invitations);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/org/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Failed to send invite");
        return;
      }

      setSuccess(true);
      setInviteEmail("");
      if (data?.invitation) {
        setInviteRows((prev) => [data.invitation as Invitation, ...prev]);
      }
    } catch {
      setError("Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  const updateRole = async (memberId: string, role: "admin" | "member") => {
    const key = `role:${memberId}`;
    setBusyKey(key);
    setError(null);
    try {
      const res = await fetch("/api/org/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, memberId, role }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to update role");
        return;
      }
      setMemberRows((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m))
      );
    } finally {
      setBusyKey(null);
    }
  };

  const removeMember = async (memberId: string) => {
    const key = `remove:${memberId}`;
    setBusyKey(key);
    setError(null);
    try {
      const res = await fetch("/api/org/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, memberId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to remove member");
        return;
      }
      setMemberRows((prev) => prev.filter((m) => m.id !== memberId));
    } finally {
      setBusyKey(null);
    }
  };

  const cancelInvite = async (invitationId: string) => {
    const key = `cancel:${invitationId}`;
    setBusyKey(key);
    setError(null);
    try {
      const res = await fetch("/api/org/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, invitationId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to cancel invite");
        return;
      }
      setInviteRows((prev) => prev.filter((i) => i.id !== invitationId));
    } finally {
      setBusyKey(null);
    }
  };

  const resendInvite = async (invitation: Invitation) => {
    const key = `resend:${invitation.id}`;
    setBusyKey(key);
    setError(null);
    try {
      const res = await fetch("/api/org/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          email: invitation.email,
          role: invitation.role,
          resend: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to resend invite");
        return;
      }
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <SettingsLayout orgSlug={orgSlug}>
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Members</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage team members and invitations
          </p>
        </div>

        {/* Invite form */}
        <form onSubmit={handleInvite} className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Invite by email</label>
            <input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm
                focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
            />
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm cursor-pointer"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" loading={sending} leftIcon={<UserPlus className="h-4 w-4" />}>
            Invite
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-success">Invitation sent!</p>}

        {/* Members table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium">Member</th>
                <th className="text-left px-4 py-2.5 font-medium">Role</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberRows.map((member) => {
                const RoleIcon = roleIcons[member.role] ?? User;
                return (
                  <tr key={member.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{member.user?.name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize ${roleColors[member.role] ?? ""}`}>
                        <RoleIcon className="h-3.5 w-3.5" />
                        {member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {member.role !== "owner" && (
                        <div className="inline-flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(e) =>
                              updateRole(member.id, e.target.value as "admin" | "member")
                            }
                            disabled={busyKey === `role:${member.id}`}
                            className="h-8 px-2 rounded border border-border bg-background text-xs"
                          >
                            <option value="member">member</option>
                            <option value="admin">admin</option>
                          </select>
                          <button
                            onClick={() => removeMember(member.id)}
                            disabled={busyKey === `remove:${member.id}`}
                            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pending invitations */}
        {inviteRows.length > 0 && (
          <div>
            <h3 className="text-base font-semibold mb-3">Pending Invitations</h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="text-left px-4 py-2.5 font-medium">Email</th>
                    <th className="text-left px-4 py-2.5 font-medium">Role</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                    <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inviteRows.map((inv) => (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="px-4 py-3">{inv.email}</td>
                      <td className="px-4 py-3 capitalize">{inv.role}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-500">
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => resendInvite(inv)}
                            disabled={busyKey === `resend:${inv.id}`}
                            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                            title="Resend invite"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => cancelInvite(inv.id)}
                            disabled={busyKey === `cancel:${inv.id}`}
                            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                            title="Cancel invite"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
