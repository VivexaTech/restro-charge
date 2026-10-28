"use client";

import React, { useState } from "react";
import { Users, Plus, Shield, CheckCircle2, UserCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { UserProfile, UserRole } from "@/lib/types";
import { SEED_USERS } from "@/lib/mock-data/seed";
import { toast } from "sonner";

import { useAuth } from "@/context/auth-context";

export default function RestaurantStaffManagementPage() {
  const { user } = useAuth();
  const currentRestaurantId = user?.restaurantId || "rest_vivexa_01";

  const [staffList, setStaffList] = useState<UserProfile[]>(
    SEED_USERS.filter((u) => u.restaurantId === currentRestaurantId || (u.restaurantId === "rest_vivexa_01" && u.role !== "SUPER_ADMIN"))
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("KITCHEN_STAFF");

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      toast.error("Please enter staff name and email.");
      return;
    }

    const newStaff: UserProfile = {
      uid: `usr_staff_${Date.now()}`,
      displayName: name,
      email,
      role,
      restaurantId: currentRestaurantId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setStaffList((prev) => [...prev, newStaff]);
    toast.success(`Staff account for ${name} created successfully!`);
    setIsModalOpen(false);
    setName("");
    setEmail("");
  };

  const handleToggleActive = (uid: string, current: boolean) => {
    setStaffList((prev) =>
      prev.map((s) => (s.uid === uid ? { ...s, isActive: !current } : s))
    );
    toast.success("Staff status updated");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            Team & Shifts
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            Restaurant Staff Accounts
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Grant floor servers and kitchen line staff authorized access to RestroCharge.
          </p>
        </div>

        <Button size="sm" onClick={() => setIsModalOpen(true)} className="font-semibold shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Staff Member
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Staff Member</th>
              <th className="py-3 px-4">Login Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Operational Screen</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staffList.map((s) => (
              <tr key={s.uid} className="hover:bg-slate-50/60 transition">
                <td className="py-3.5 px-4 font-bold text-slate-900">{s.displayName}</td>
                <td className="py-3.5 px-4 text-slate-600 font-mono">{s.email}</td>
                <td className="py-3.5 px-4">
                  <Badge variant={s.role === "RESTAURANT_OWNER" ? "default" : "neutral"}>
                    {s.role.replace("_", " ")}
                  </Badge>
                </td>
                <td className="py-3.5 px-4 text-slate-500 font-mono">
                  {s.role === "KITCHEN_STAFF" ? "/staff/kitchen" : "/staff"}
                </td>
                <td className="py-3.5 px-4">
                  <Badge variant={s.isActive ? "success" : "neutral"}>
                    {s.isActive ? "Active" : "Disabled"}
                  </Badge>
                </td>
                <td className="py-3.5 px-4 text-right">
                  {s.role !== "RESTAURANT_OWNER" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(s.uid, s.isActive)}
                      className="h-7 text-xs text-slate-500 hover:text-slate-900"
                    >
                      {s.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Staff Member"
        description="Create credentials for floor servers or kitchen cooks."
      >
        <form onSubmit={handleAddStaff} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Staff Full Name *
            </label>
            <Input
              placeholder="e.g. Sameer Ansari"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Staff Email Address *
            </label>
            <Input
              type="email"
              placeholder="chef@vivexatech.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assigned Operational Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="KITCHEN_STAFF">Kitchen Staff (Kitchen Order Display only)</option>
              <option value="ORDER_STAFF">Order Staff (Receive & Update Table Tickets)</option>
              <option value="RESTAURANT_MANAGER">Restaurant Manager (Orders, Menu & Staff)</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Staff Account</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
