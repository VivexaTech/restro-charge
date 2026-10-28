"use client";

import React, { useState } from "react";
import { Users, Shield, Plus, Mail, CheckCircle2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { UserProfile, UserRole } from "@/lib/types";
import { SEED_USERS } from "@/lib/mock-data/seed";
import { toast } from "sonner";

export default function SuperAdminTeamPage() {
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>(
    SEED_USERS.filter((u) => u.email.endsWith("@vivexatech.in") || u.role === "SUPER_ADMIN")
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("ONBOARDING_EXECUTIVE");

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      toast.error("Please fill in name and email.");
      return;
    }

    const newMember: UserProfile = {
      uid: `usr_${Date.now()}`,
      displayName: name,
      email,
      role,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTeamMembers((prev) => [...prev, newMember]);
    toast.success(`Team member ${name} added with role ${role.replace("_", " ")}`);
    setIsModalOpen(false);
    setName("");
    setEmail("");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
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

        <Button size="sm" onClick={() => setIsModalOpen(true)} className="font-semibold shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Internal Member
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
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
                  <Badge variant="success">Active</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Vivexa Tech Team Member"
        description="Assign least-privilege administrative roles."
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <Input
              placeholder="e.g. Priya Nair"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Email</label>
            <Input
              type="email"
              placeholder="priya@vivexatech.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Member</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
