"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  Search,
  Gift,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { RestaurantProfile, SubscriptionPlan } from "@/lib/types";
import { formatDate, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth/client-auth";

export default function SuperAdminSubscriptionsPage() {
  const [restaurants, setRestaurants] = useState<RestaurantProfile[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  // Manual Renewal modal state
  const [isRenewModalOpen, setIsRenewModalOpen] = useState<boolean>(false);
  const [selectedRest, setSelectedRest] = useState<RestaurantProfile | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("plan_pro");
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [renewReason, setRenewReason] = useState<string>("");
  const [isSubmittingRenew, setIsSubmittingRenew] = useState<boolean>(false);

  // Free Trial Modal state
  const [isTrialModalOpen, setIsTrialModalOpen] = useState<boolean>(false);
  const [trialRestId, setTrialRestId] = useState<string>("");
  const [trialDays, setTrialDays] = useState<number>(7);
  const [trialReason, setTrialReason] = useState<string>("Onboarding Evaluation Trial");
  const [trialPlanId, setTrialPlanId] = useState<string>("plan_pro");
  const [isSubmittingTrial, setIsSubmittingTrial] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const restRes = await fetch("/api/restaurants");
      const restData = await restRes.json();
      setRestaurants(restData.restaurants || []);

      const planRes = await fetch("/api/subscriptions/plans");
      const planData = await planRes.json();
      setPlans(planData.plans || []);
    } catch {
      toast.error("Failed to load subscription data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openManualRenew = (r: RestaurantProfile) => {
    setSelectedRest(r);
    setSelectedPlanId(r.subscription?.planId || "plan_pro");
    setDurationMonths(1);
    setRenewReason("");
    setIsRenewModalOpen(true);
  };

  const openGrantTrial = (r?: RestaurantProfile) => {
    if (r) {
      setTrialRestId(r.id);
    } else if (restaurants.length > 0) {
      setTrialRestId(restaurants[0].id);
    }
    setTrialDays(7);
    setTrialReason("Onboarding Evaluation Trial");
    setTrialPlanId("plan_pro");
    setIsTrialModalOpen(true);
  };

  const handleManualRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRest || !renewReason.trim()) {
      toast.error("Please specify a reason for manual renewal.");
      return;
    }

    setIsSubmittingRenew(true);
    try {
      const res = await authFetch("/api/subscriptions/manual-renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRest.id,
          planId: selectedPlanId,
          durationMonths,
          reason: renewReason,
          authorizedBy: "Vivexa Super Admin",
          callerRole: "SUPER_ADMIN",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Subscription renewed for ${selectedRest.name}!`);
      setIsRenewModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Manual renewal failed.");
    } finally {
      setIsSubmittingRenew(false);
    }
  };

  const handleGrantTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trialRestId) {
      toast.error("Please select a restaurant.");
      return;
    }

    setIsSubmittingTrial(true);
    try {
      const res = await authFetch("/api/subscriptions/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: trialRestId,
          trialDays: Number(trialDays),
          reason: trialReason,
          planId: trialPlanId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.message || "Free trial granted successfully!");
      setIsTrialModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to grant trial.");
    } finally {
      setIsSubmittingTrial(false);
    }
  };

  const calculatePreviewExpiry = () => {
    if (!selectedRest) return "N/A";
    const now = new Date();
    let base = now;
    if (selectedRest.subscription && new Date(selectedRest.subscription.expiryDate) > now) {
      base = new Date(selectedRest.subscription.expiryDate);
    }
    const preview = new Date(base);
    preview.setMonth(preview.getMonth() + durationMonths);
    return formatDate(preview);
  };

  const filtered = restaurants.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q) ||
      (r.subscription?.planName && r.subscription.planName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            SaaS Revenue & Tenancy
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            Subscription Governance & Free Trials
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Grant complimentary trials (default 7 days), monitor expiration dates, and process manual renewals.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            onClick={() => openGrantTrial()}
            size="sm"
            className="font-semibold shadow-sm bg-brand-600 hover:bg-brand-700 text-white"
          >
            <Gift className="h-4 w-4 mr-1.5" />
            Grant Free Trial
          </Button>
        </div>
      </div>

      {/* Search and Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search restaurant or plan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
          <span className="text-xs text-slate-400 font-semibold">
            {filtered.length} {filtered.length === 1 ? "restaurant" : "restaurants"} registered
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Restaurant</th>
                <th className="py-3 px-4">Plan & Tier</th>
                <th className="py-3 px-4">Subscription Status</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Days Remaining</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const sub = r.subscription;
                const isTrial = sub?.status === "TRIAL" || sub?.isTrial;
                const isGrace = sub?.status === "GRACE_PERIOD";
                const daysLeft = sub?.expiryDate
                  ? Math.max(0, Math.ceil((new Date(sub.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                  : 0;

                return (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 block">{r.name}</span>
                        {r.isDemo && (
                          <span className="bg-brand-50 text-brand-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-brand-200">
                            Demo
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 font-mono text-[10px]">/{r.slug}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">{sub?.planName}</span>
                      <span className="text-slate-400 text-[10px]">{sub?.billingCycle}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          isTrial
                            ? "warning"
                            : sub?.status === "ACTIVE"
                            ? "success"
                            : isGrace
                            ? "warning"
                            : "danger"
                        }
                      >
                        {isTrial ? "FREE TRIAL" : sub?.status}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {sub?.expiryDate ? formatDate(sub.expiryDate) : "—"}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {daysLeft} days
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openGrantTrial(r)}
                          className="text-xs h-7 font-semibold"
                        >
                          <Gift className="h-3 w-3 mr-1 text-brand-600" />
                          Grant Trial
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => openManualRenew(r)}
                          className="text-xs h-7 font-semibold shadow-sm"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Renew
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant Free Trial Modal */}
      <Modal
        isOpen={isTrialModalOpen}
        onClose={() => setIsTrialModalOpen(false)}
        title="Grant / Extend Free Trial"
        description="Authorize complimentary platform access for a restaurant. Zero payment required."
      >
        <form onSubmit={handleGrantTrial} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Restaurant *
            </label>
            <select
              value={trialRestId}
              onChange={(e) => setTrialRestId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
              required
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.city})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trial Duration (Days) *
              </label>
              <Input
                type="number"
                min={1}
                max={90}
                value={trialDays}
                onChange={(e) => setTrialDays(Number(e.target.value))}
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Default: 7 days
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Included Plan Tier
              </label>
              <select
                value={trialPlanId}
                onChange={(e) => setTrialPlanId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Internal Audit Reason / Note *
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g. 7-day initial pilot granted by Vivexa onboarding team"
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={trialReason}
              onChange={(e) => setTrialReason(e.target.value)}
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 leading-snug">
            <strong>Audit Guarantee:</strong> Granting this trial enables table ordering immediately. An immutable audit record will log your administrator UID.
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setIsTrialModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmittingTrial} className="bg-brand-600 hover:bg-brand-700 font-bold">
              Confirm & Grant Trial
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manual Renewal Modal */}
      <Modal
        isOpen={isRenewModalOpen}
        onClose={() => setIsRenewModalOpen(false)}
        title="Super Admin Manual Subscription Renewal"
        description={`Venue: ${selectedRest?.name || ""}`}
      >
        <form onSubmit={handleManualRenew} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Subscription Plan
            </label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatCurrency(p.monthlyPrice)}/mo)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Renewal Duration (Months)
            </label>
            <select
              value={durationMonths}
              onChange={(e) => setDurationMonths(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value={1}>1 Month (Monthly Extension)</option>
              <option value={3}>3 Months (Quarterly)</option>
              <option value={6}>6 Months (Half-Yearly)</option>
              <option value={12}>12 Months (Full Annual Period)</option>
            </select>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Current Status:</span>
              <strong className="text-slate-900">{selectedRest?.subscription?.status}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Proposed New Expiry:</span>
              <strong className="text-emerald-700 font-mono">{calculatePreviewExpiry()}</strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Internal Audit Reason / Note *
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Offline bank transfer verified by accounts team / Contract extension"
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={renewReason}
              onChange={(e) => setRenewReason(e.target.value)}
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setIsRenewModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmittingRenew}>
              Confirm Manual Renewal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
