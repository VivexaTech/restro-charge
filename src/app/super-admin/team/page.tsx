"use client";

import React, { useState, useEffect } from "react";
import { Users, Shield, Plus, Mail, CheckCircle2, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { UserProfile, UserRole } from "@/lib/types";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth/client-auth";

export default function SuperAdminTeamPage() {
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("ONBOARDING_EXECUTIVE");

  const fetchTeam = async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/admin/team");
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.team || []);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to load Vivexa team members");
      }
    } catch (err: any) {
      console.error("Fetch team error:", err);
      toast.error("Network error while loading team members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Please fill in name and official email.");
      return;
    }

    if (password && password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authFetch("/api/admin/team", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          password: password.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `Team member added successfully!`);
        setIsModalOpen(false);
        setName("");
        setEmail("");
        setPassword("");
        setRole("ONBOARDING_EXECUTIVE");
        await fetchTeam();
      } else {
        toast.error(data.error || "Failed to add team member");
      }
    } catch (err: any) {
      console.error("Add team member error:", err);
      toast.error("Network error while creating team member account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            Access Control
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            Vivexa Tech Internal Team
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage administrative personnel, onboarding executives, and platform engineers.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto font-semibold shadow-sm text-xs"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Internal Member
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Loading Vivexa team accounts from database...</p>
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">No Internal Members</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add platform personnel who assist in onboarding restaurants and managing subscriptions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Official Email</th>
                  <th className="py-3 px-4">System Role</th>
                  <th className="py-3 px-4">Permissions Scope</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamMembers.map((m) => (
                  <tr key={m.uid} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{m.displayName}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">{m.email}</td>
                    <td className="py-3.5 px-4">
                      <Badge variant={m.role === "SUPER_ADMIN" ? "default" : "neutral"}>
                        {m.role.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {m.role === "SUPER_ADMIN" && "Full platform control, billing, QR, subscriptions"}
                      {m.role === "ONBOARDING_EXECUTIVE" && "Restaurant onboarding, menu config, table QR issuance"}
                      {m.role === "SALES_MANAGER" && "View accounts, subscription renewals, lead reviews"}
                      {m.role === "SUPPORT_EXECUTIVE" && "Read-only access, diagnostics, order logs"}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={m.isActive ? "success" : "neutral"}>
                        {m.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Vivexa Tech Team Member"
        description="Assign least-privilege administrative roles. Record is persisted directly to Cloud Firestore."
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <Input
              placeholder="e.g. Priya Nair"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Email *</label>
            <Input
              type="email"
              placeholder="priya@vivexatech.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Login Password *</label>
            <Input
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ONBOARDING_EXECUTIVE">Onboarding Executive (Table QR & Setup)</option>
              <option value="SALES_MANAGER">Sales Manager (Subscriptions & Requests)</option>
              <option value="SUPPORT_EXECUTIVE">Support Executive (Diagnostics)</option>
              <option value="SUPER_ADMIN">Super Admin (Full Platform Control)</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Creating Member...
                </>
              ) : (
                "Add Team Member"
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
