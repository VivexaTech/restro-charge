"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Shield,
  CheckCircle2,
  UserCheck,
  XCircle,
  Loader2,
  KeyRound,
  Store,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { UserProfile, UserRole } from "@/lib/types";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { authFetch } from "@/lib/auth/client-auth";
import { useActiveRestaurant } from "@/lib/hooks/use-active-restaurant";
import { StaffSoundPreferenceCard } from "@/components/staff/sound-preference-card";

export default function RestaurantStaffManagementPage() {
  const { user } = useAuth();
  const {
    restaurantId: activeRestaurantId,
    restaurant: activeRestaurant,
    allRestaurants,
    selectRestaurant,
    isSuperAdmin,
    loading: resLoading,
  } = useActiveRestaurant();

  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("KITCHEN_STAFF");
  const [modalRestaurantId, setModalRestaurantId] = useState<string>("");

  // Sync modalRestaurantId when activeRestaurantId or allRestaurants change
  useEffect(() => {
    if (activeRestaurantId) {
      setModalRestaurantId(activeRestaurantId);
    } else if (allRestaurants.length > 0) {
      setModalRestaurantId(allRestaurants[0].id);
    }
  }, [activeRestaurantId, allRestaurants]);

  const fetchStaff = async () => {
    if (!activeRestaurantId) {
      setStaffList([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await authFetch(`/api/staff?restaurantId=${activeRestaurantId}`);
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staff || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || "Failed to load staff list");
      }
    } catch (err: any) {
      console.error("Staff fetch error:", err);
      toast.error("Network error while loading staff records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeRestaurantId) {
      fetchStaff();
    } else if (!resLoading) {
      setLoading(false);
    }
  }, [activeRestaurantId, resLoading]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Please enter staff name and email.");
      return;
    }

    if (password && password.length < 6) {
      toast.error("Temporary password must be at least 6 characters.");
      return;
    }

    const targetRestaurantId = modalRestaurantId || activeRestaurantId || allRestaurants[0]?.id;
    if (!targetRestaurantId) {
      toast.error("Please select an active restaurant venue first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authFetch("/api/staff", {
        method: "POST",
        body: JSON.stringify({
          restaurantId: targetRestaurantId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          password: password.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `Staff account created successfully!`);
        setIsModalOpen(false);
        setName("");
        setEmail("");
        setPassword("");
        setRole("KITCHEN_STAFF");
        // Refetch authoritative list from Firestore
        await fetchStaff();
      } else {
        toast.error(data.error || "Failed to create staff account.");
      }
    } catch (err: any) {
      console.error("Add staff error:", err);
      toast.error("Network error while creating staff account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (uid: string, current: boolean) => {
    const targetRestaurantId = activeRestaurantId || allRestaurants[0]?.id;
    if (!targetRestaurantId) {
      toast.error("Restaurant context is required.");
      return;
    }

    try {
      const res = await authFetch(`/api/staff/${uid}`, {
        method: "PATCH",
        body: JSON.stringify({
          restaurantId: targetRestaurantId,
          isActive: !current,
        }),
      });

      if (res.ok) {
        setStaffList((prev) =>
          prev.map((s) => (s.uid === uid ? { ...s, isActive: !current } : s))
        );
        toast.success(`Staff status updated to ${!current ? "Active" : "Disabled"}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to update staff status");
      }
    } catch (err: any) {
      toast.error("Failed to update staff status");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 overflow-x-hidden">
      {/* Top Header */}
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

        <Button
          size="sm"
          onClick={() => {
            if (activeRestaurantId) setModalRestaurantId(activeRestaurantId);
            setIsModalOpen(true);
          }}
          className="w-full sm:w-auto font-semibold shadow-sm text-xs"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Staff Member
        </Button>
      </div>

      {/* Multi-tenant Venue Switcher Banner (Visible to Super Admin or Multi-restaurant Managers) */}
      {(isSuperAdmin || allRestaurants.length > 1) && (
        <div className="bg-brand-50/70 border border-brand-200/70 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-700 flex items-center justify-center shrink-0">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-900">
                  {activeRestaurant?.name || (activeRestaurantId ? `Restaurant: ${activeRestaurantId}` : "No Venue Selected")}
                </span>
                {isSuperAdmin && (
                  <Badge variant="default" className="text-[10px] py-0 px-2 font-semibold">
                    Super Admin Scope
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Staff accounts will be provisioned under this restaurant venue.
              </p>
            </div>
          </div>

          {allRestaurants.length > 0 && (
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <label htmlFor="venue-select" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Switch Venue:
              </label>
              <select
                id="venue-select"
                value={activeRestaurantId}
                onChange={(e) => {
                  selectRestaurant(e.target.value);
                  setModalRestaurantId(e.target.value);
                }}
                className="text-xs font-semibold bg-white border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs cursor-pointer w-full sm:w-auto"
              >
                {allRestaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.slug})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Staff Table / Empty State */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        {loading || resLoading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Loading staff records from database...</p>
          </div>
        ) : !activeRestaurantId && allRestaurants.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">No Restaurant Configured</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Please create a restaurant venue first from the Super Admin portal before adding staff.
            </p>
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">No Staff Members Added Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your kitchen chefs and floor servers for <strong>{activeRestaurant?.name || "this venue"}</strong> so they can sign in and manage live tickets.
            </p>
            <Button
              size="sm"
              onClick={() => {
                if (activeRestaurantId) setModalRestaurantId(activeRestaurantId);
                setIsModalOpen(true);
              }}
              className="text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add First Staff Member
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                        {s.role.replace(/_/g, " ")}
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
        )}
      </div>

      {/* Staff Order Notification Sound Setting (Requirement B) */}
      <StaffSoundPreferenceCard />

      {/* Add Staff Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Staff Member"
        description="Create credentials for floor servers or kitchen cooks. Record is persisted directly to Cloud Firestore."
      >
        <form onSubmit={handleAddStaff} className="space-y-4">
          {/* Restaurant Venue Selector (when multiple venues or Super Admin) */}
          {(isSuperAdmin || allRestaurants.length > 1) && allRestaurants.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Restaurant Venue *
              </label>
              <select
                value={modalRestaurantId || activeRestaurantId}
                onChange={(e) => setModalRestaurantId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              >
                {allRestaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.slug})
                  </option>
                ))}
              </select>
            </div>
          )}

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
              placeholder="chef@restrocharge.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Login Password *
            </label>
            <Input
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              The staff member will use this password along with their email to log in to the staff dashboard.
            </p>
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
                  Creating Account...
                </>
              ) : (
                "Create Staff Account"
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
