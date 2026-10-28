"use client";

import React, { useState, useEffect } from "react";
import {
  Receipt,
  Percent,
  CheckCircle2,
  ShieldCheck,
  Save,
  Calculator,
  Layers,
  CreditCard,
  Edit2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { RestaurantProfile, BillingConfig, SubscriptionPlan } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { calculateOrderBill } from "@/lib/services/billing";
import { toast } from "sonner";

export default function SuperAdminBillingConfigPage() {
  const [activeTab, setActiveTab] = useState<"taxes" | "plans">("taxes");

  const [restaurants, setRestaurants] = useState<RestaurantProfile[]>([]);
  const [selectedRestId, setSelectedRestId] = useState<string>("");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Billing configuration form
  const [billing, setBilling] = useState<BillingConfig>({
    itemOnly: false,
    gstEnabled: true,
    gstRate: 5,
    serviceChargeEnabled: false,
    serviceChargeRate: 0,
    calculationBasis: "TAX_ON_SUBTOTAL",
  });

  // Plan editing modal
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planMonthlyPrice, setPlanMonthlyPrice] = useState<number>(999);
  const [planAnnualPrice, setPlanAnnualPrice] = useState<number>(9990);
  const [planTagline, setPlanTagline] = useState<string>("");
  const [isSavingPlan, setIsSavingPlan] = useState<boolean>(false);

  const selectedRest = restaurants.find((r) => r.id === selectedRestId);

  const loadAll = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/restaurants");
      const data = await res.json();
      const list = data.restaurants || [];
      setRestaurants(list);
      if (list.length > 0 && !selectedRestId) {
        setSelectedRestId(list[0].id);
        setBilling(list[0].billingConfig);
      }

      const planRes = await fetch("/api/subscriptions/plans");
      const planData = await planRes.json();
      setPlans(planData.plans || []);
    } catch {
      toast.error("Failed to load billing configs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleRestaurantChange = (id: string) => {
    setSelectedRestId(id);
    const target = restaurants.find((r) => r.id === id);
    if (target) {
      setBilling(target.billingConfig);
    }
  };

  const handleSaveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestId) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/restaurants/${selectedRestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingConfig: billing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setRestaurants((prev) =>
        prev.map((r) => (r.id === selectedRestId ? { ...r, billingConfig: billing } : r))
      );
      toast.success("Billing and tax configuration updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update billing config.");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditPlan = (p: SubscriptionPlan) => {
    setEditingPlan(p);
    setPlanMonthlyPrice(p.monthlyPrice);
    setPlanAnnualPrice(p.annualPrice);
    setPlanTagline(p.tagline);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setIsSavingPlan(true);
    try {
      const res = await fetch("/api/subscriptions/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPlan.id,
          monthlyPrice: Number(planMonthlyPrice),
          annualPrice: Number(planAnnualPrice),
          tagline: planTagline,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPlans((prev) =>
        prev.map((pl) => (pl.id === editingPlan.id ? data.plan : pl))
      );
      toast.success(`Pricing updated for ${editingPlan.name}!`);
      setEditingPlan(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update plan pricing");
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Sample order simulation of ₹1,000 subtotal
  const sampleItems = [
    { productId: "sim1", name: "Sample Signature Dish", price: 1000, quantity: 1, isVeg: true },
  ];
  const sampleBill = calculateOrderBill(sampleItems, billing);

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            Vivexa Tech Central Control
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            Billing & SaaS Pricing Governance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure restaurant GST/tax rules and authoritative platform SaaS subscription tier prices.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("taxes")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === "taxes"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Restaurant Taxes</span>
          </button>
          <button
            onClick={() => setActiveTab("plans")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === "plans"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>SaaS Plan Pricing</span>
          </button>
        </div>
      </div>

      {activeTab === "taxes" ? (
        <div className="space-y-6">
          {/* Select Restaurant */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
              Target Restaurant:
            </label>
            <select
              value={selectedRestId}
              onChange={(e) => handleRestaurantChange(e.target.value)}
              className="rounded-xl border border-slate-300 p-2 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.city})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form controls */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-6">
              <form onSubmit={handleSaveBilling} className="space-y-6">
                <h3 className="font-bold text-base text-slate-900 font-display">
                  Tax & Charges Policy for {selectedRest?.name}
                </h3>

                {/* Item Only Switch */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">Item Amount Only (Zero Additional Taxes)</span>
                    <span className="text-[11px] text-slate-500">
                      Customer pays raw menu item prices with no added tax or service fees.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={billing.itemOnly}
                    onChange={(e) => setBilling({ ...billing, itemOnly: e.target.checked })}
                    className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
                  />
                </div>

                {!billing.itemOnly && (
                  <>
                    {/* GST Settings */}
                    <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-xs text-slate-800 block">GST / Sales Tax Enabled</span>
                          <span className="text-[11px] text-slate-500">
                            Apply government Goods & Services Tax to food bill.
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={billing.gstEnabled}
                          onChange={(e) => setBilling({ ...billing, gstEnabled: e.target.checked })}
                          className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
                        />
                      </div>

                      {billing.gstEnabled && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            GST Percentage Rate (%)
                          </label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max="28"
                            value={billing.gstRate}
                            onChange={(e) => setBilling({ ...billing, gstRate: Number(e.target.value) })}
                            className="max-w-xs text-xs font-bold"
                          />
                        </div>
                      )}
                    </div>

                    {/* Service Charge */}
                    <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-xs text-slate-800 block">Dine-In Service Charge Enabled</span>
                          <span className="text-[11px] text-slate-500">
                            Optional restaurant hospitality fee retained by staff.
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={billing.serviceChargeEnabled}
                          onChange={(e) => setBilling({ ...billing, serviceChargeEnabled: e.target.checked })}
                          className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
                        />
                      </div>

                      {billing.serviceChargeEnabled && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Service Charge Rate (%)
                          </label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max="20"
                            value={billing.serviceChargeRate}
                            onChange={(e) => setBilling({ ...billing, serviceChargeRate: Number(e.target.value) })}
                            className="max-w-xs text-xs font-bold"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="pt-2 flex justify-end">
                  <Button type="submit" isLoading={isSaving} className="font-bold shadow-sm">
                    <Save className="h-4 w-4 mr-1.5" />
                    Save Billing Rules
                  </Button>
                </div>
              </form>
            </div>

            {/* Live Calculation Preview */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-card space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-brand-400 font-bold text-xs mb-2">
                  <Calculator className="h-4 w-4" />
                  <span>Live Simulator Preview</span>
                </div>
                <h4 className="text-sm font-bold">Sample Order: ₹1,000 Food Subtotal</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  How guest checks will compute under current rule settings:
                </p>

                <div className="mt-4 p-4 rounded-xl bg-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formatCurrency(sampleBill.subtotal)}</span>
                  </div>

                  {sampleBill.serviceChargeEnabled && (
                    <div className="flex justify-between text-slate-300">
                      <span>Service Charge ({sampleBill.serviceChargeRate}%):</span>
                      <span className="font-mono text-emerald-400">
                        +{formatCurrency(sampleBill.serviceChargeAmount)}
                      </span>
                    </div>
                  )}

                  {sampleBill.gstEnabled && (
                    <div className="flex justify-between text-slate-300">
                      <span>GST ({sampleBill.gstRate}%):</span>
                      <span className="font-mono text-emerald-400">
                        +{formatCurrency(sampleBill.gstAmount)}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-white text-sm">
                    <span>Customer Bill:</span>
                    <span className="text-brand-400 font-mono">
                      {formatCurrency(sampleBill.finalTotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-[11px] text-slate-300 space-y-1">
                <span className="font-bold block text-white">Vivexa Authority Note:</span>
                <p>
                  Restaurant owners cannot override tax calculations or delete GST receipts. Settings apply uniformly to digital orders and generated bills.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* SaaS Plans & Pricing Management Tab */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-base text-slate-900">{p.name}</h3>
                    {p.isPopular && (
                      <span className="bg-brand-50 text-brand-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-brand-200">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-4 min-h-[32px]">{p.tagline}</p>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Monthly:</span>
                      <strong className="text-slate-900">{formatCurrency(p.monthlyPrice)}/mo</strong>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Annual:</span>
                      <strong className="text-emerald-700">{formatCurrency(p.annualPrice)}/yr</strong>
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600 mb-6">
                    {p.features.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-center space-x-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  onClick={() => openEditPlan(p)}
                  variant="outline"
                  size="sm"
                  className="w-full font-semibold"
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                  Edit Plan Pricing
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Plan Pricing Modal */}
      {editingPlan && (
        <Modal
          isOpen={Boolean(editingPlan)}
          onClose={() => setEditingPlan(null)}
          title={`Edit ${editingPlan.name} Pricing`}
          description="Update authoritative tier price. Changes reflect immediately on /pricing and checkout."
        >
          <form onSubmit={handleSavePlan} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Plan Tagline
              </label>
              <Input
                value={planTagline}
                onChange={(e) => setPlanTagline(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly Price (₹) *
                </label>
                <Input
                  type="number"
                  min={0}
                  value={planMonthlyPrice}
                  onChange={(e) => setPlanMonthlyPrice(Number(e.target.value))}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Annual Price (₹) *
                </label>
                <Input
                  type="number"
                  min={0}
                  value={planAnnualPrice}
                  onChange={(e) => setPlanAnnualPrice(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setEditingPlan(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSavingPlan} className="font-bold">
                Save Plan Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
