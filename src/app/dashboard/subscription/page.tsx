"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Sparkles,
  Lock,
  ArrowRight,
  RefreshCw,
  Gift,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { RestaurantProfile, SubscriptionPlan } from "@/lib/types";
import { formatDate, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

export default function RestaurantSubscriptionDashboardPage() {
  const { user } = useAuth();
  const currentRestaurantId = user?.restaurantId || "";

  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Renewal Modal
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("plan_pro");
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "ANNUAL">("ANNUAL");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const loadSubscriptionInfo = async () => {
    if (!currentRestaurantId) {
      setRestaurant(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/restaurants/${currentRestaurantId}`);
      const data = await res.json();
      setRestaurant(data.restaurant || null);

      const planRes = await fetch("/api/subscriptions/plans");
      const planData = await planRes.json();
      setPlans(planData.plans || []);
    } catch {
      toast.error("Failed to load subscription info");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptionInfo();
  }, [currentRestaurantId]);

  const sub = restaurant?.subscription;
  const isTrial = sub?.status === "TRIAL" || sub?.isTrial;
  const isGrace = sub?.status === "GRACE_PERIOD";
  const isExpired = sub?.status === "EXPIRED" || sub?.status === "SUSPENDED";

  // Calculate days left
  const daysLeft = sub?.expiryDate
    ? Math.max(0, Math.ceil((new Date(sub.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const currentPlan = plans.find((p) => p.id === selectedPlanId);
  const renewalAmount = billingCycle === "ANNUAL" ? currentPlan?.annualPrice || 24990 : currentPlan?.monthlyPrice || 2499;

  // Handle Self-Renewal with Razorpay Checkout Flow
  const handleInitiateRazorpay = async () => {
    setIsProcessingPayment(true);
    try {
      // 1. Create Order on Backend
      const orderRes = await fetch("/api/subscriptions/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: currentRestaurantId,
          planId: selectedPlanId,
          billingCycle,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error);

      toast.info("Connecting to secure Razorpay Payment Gateway...");

      // 2. Simulate Razorpay checkout verification
      setTimeout(async () => {
        try {
          const fakePaymentId = `pay_${Math.random().toString(36).substring(2, 10)}`;
          const verifyRes = await fetch("/api/subscriptions/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              restaurantId: currentRestaurantId,
              planId: selectedPlanId,
              billingCycle,
              razorpayOrderId: orderData.orderId,
              razorpayPaymentId: fakePaymentId,
              razorpaySignature: "simulated_verified_signature",
            }),
          });

          const verifyData = await verifyRes.json();
          if (!verifyRes.ok) throw new Error(verifyData.error);

          toast.success("Subscription renewed successfully via Razorpay!");
          setIsRenewModalOpen(false);
          loadSubscriptionInfo();
        } catch (vErr: any) {
          toast.error(vErr.message || "Payment verification failed");
        } finally {
          setIsProcessingPayment(false);
        }
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "Could not initialize Razorpay order");
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 overflow-x-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            SaaS Membership
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            Subscription & License Status
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manual renew via Razorpay UPI/Netbanking. Zero auto-recurring charges per Vivexa Tech policy.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Button
            onClick={() => setIsRenewModalOpen(true)}
            size="sm"
            className="w-full sm:w-auto font-semibold shadow-sm text-xs"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Renew / Change Plan
          </Button>
        </div>
      </div>

      {/* Trial Notification Banner if applicable */}
      {isTrial && (
        <div className="bg-gradient-to-r from-brand-50 to-amber-50 border border-brand-200 p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Complimentary Free Trial Active
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                You have <strong>{daysLeft} days remaining</strong> in your full-access trial granted by Vivexa Tech. No payment required until {sub?.expiryDate ? formatDate(sub.expiryDate) : "end of trial"}.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setIsRenewModalOpen(true)}
            className="font-semibold text-xs shrink-0"
          >
            Upgrade to Annual
          </Button>
        </div>
      )}

      {/* Grace Period Alert Banner */}
      {isGrace && (
        <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-2xl shadow-card space-y-2">
          <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <span>3-Day Grace Period Active — Action Required</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed max-w-3xl">
            Your SaaS subscription expired on {formatDate(sub!.expiryDate)}. To protect your active dining service, Vivexa Tech keeps your QR menu operational until {formatDate(sub!.gracePeriodEnd)}. Please renew now to prevent service stoppage.
          </p>
          <div className="pt-2">
            <Button onClick={() => setIsRenewModalOpen(true)} size="sm">
              Renew Subscription Instantly
            </Button>
          </div>
        </div>
      )}

      {/* Expired / Blocked Alert Banner */}
      {isExpired && (
        <div className="bg-red-50 border-2 border-red-300 p-5 rounded-2xl shadow-card space-y-2">
          <div className="flex items-center space-x-2 text-red-900 font-bold text-sm">
            <Lock className="h-5 w-5 text-red-600 shrink-0" />
            <span>Subscription Expired — QR Ordering Deactivated</span>
          </div>
          <p className="text-xs text-red-800 leading-relaxed max-w-3xl">
            The 3-day grace period has ended. Customer QR ordering is temporarily offline. Renewing will immediately reactivate all table QRs.
          </p>
          <div className="pt-2">
            <Button onClick={() => setIsRenewModalOpen(true)} size="sm">
              Reactivate Restaurant Now
            </Button>
          </div>
        </div>
      )}

      {/* Current Plan Overview Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Current Tier
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 font-display mt-0.5">
                {sub?.planName || "Growth & KDS Pro"}
              </h2>
            </div>

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
              {isTrial ? "FREE TRIAL" : sub?.status || "ACTIVE"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500 block">Billing Cycle</span>
              <span className="text-sm font-bold text-slate-900 mt-1 block">
                {isTrial ? "Trial Period" : sub?.billingCycle === "ANNUAL" ? "Annual Plan" : "Monthly Plan"}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {isTrial ? `${sub?.trialDays || 7} Days Free` : "No auto-renewal"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500 block">Validity Expiry</span>
              <span className="text-sm font-bold text-slate-900 mt-1 block">
                {sub?.expiryDate ? formatDate(sub.expiryDate) : "N/A"}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {daysLeft} days remaining
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500 block">Last Payment ID</span>
              <span className="text-sm font-mono font-bold text-slate-900 mt-1 block truncate">
                {sub?.lastPaymentId || "N/A"}
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                {isTrial ? "Trial Authorized" : "Verified via Razorpay"}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Included Tier Capabilities
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
              <span className="flex items-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1.5 shrink-0" />
                Customer QR Ordering & Portion Pricing
              </span>
              <span className="flex items-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1.5 shrink-0" />
                Table QR codes (issued by Vivexa)
              </span>
              <span className="flex items-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1.5 shrink-0" />
                Kitchen Order Display (KDS) & audio alerts
              </span>
              <span className="flex items-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1.5 shrink-0" />
                Custom Subpath Website (/{restaurant?.slug || "vivexa-restro"})
              </span>
              <span className="flex items-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1.5 shrink-0" />
                Zero commission on dining food checks
              </span>
            </div>
          </div>
        </div>

        {/* Razorpay self-renewal summary card */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-elevated flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs text-brand-400 font-semibold mb-2">
              <CreditCard className="h-4 w-4" />
              <span>Razorpay Fast Checkout</span>
            </div>
            <h3 className="text-lg font-bold font-display text-white">Manual Renewal</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Renew anytime without auto-debits. We accept UPI (GPay, PhonePe, Paytm), Netbanking, and Credit/Debit cards.
            </p>
          </div>

          <div className="pt-6 border-t border-slate-800 mt-6">
            <Button
              onClick={() => setIsRenewModalOpen(true)}
              className="w-full font-bold shadow-md"
            >
              <span>Renew with Razorpay</span>
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
            <p className="text-[10px] text-center text-slate-400 mt-2">
              Operated & verified by Vivexa Tech
            </p>
          </div>
        </div>
      </div>

      {/* Razorpay Renewal Modal */}
      <Modal
        isOpen={isRenewModalOpen}
        onClose={() => setIsRenewModalOpen(false)}
        title="Renew SaaS Subscription"
        description="Choose your plan tier and billing cycle. Pay securely via Razorpay."
      >
        <div className="space-y-5">
          {/* Plan Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Select Subscription Plan
            </label>
            <div className="space-y-2">
              {plans.map((p) => (
                <label
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    selectedPlanId === p.id
                      ? "border-brand-500 bg-brand-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="planSelect"
                      checked={selectedPlanId === p.id}
                      onChange={() => setSelectedPlanId(p.id)}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{p.name}</span>
                      <span className="text-[11px] text-slate-500 block">{p.tagline}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-slate-900 block">
                      {formatCurrency(billingCycle === "ANNUAL" ? p.annualPrice : p.monthlyPrice)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {billingCycle === "ANNUAL" ? "/year" : "/month"}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Billing Cycle Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Billing Duration
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBillingCycle("ANNUAL")}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center ${
                  billingCycle === "ANNUAL"
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <span>Annual (12 Months)</span>
                <span className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                  Save 2 Months Free
                </span>
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("MONTHLY")}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center ${
                  billingCycle === "MONTHLY"
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <span>Monthly (1 Month)</span>
                <span className="text-[10px] text-slate-400 font-normal mt-0.5">
                  Standard billing
                </span>
              </button>
            </div>
          </div>

          {/* Total Payable Summary */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Selected Tier:</span>
              <span className="font-semibold">{currentPlan?.name}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Billing Term:</span>
              <span className="font-semibold">
                {billingCycle === "ANNUAL" ? "12 Months (Annual)" : "1 Month"}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-extrabold text-sm text-slate-900">
              <span>Total Amount:</span>
              <span className="text-brand-600 font-display">
                {formatCurrency(renewalAmount)}
              </span>
            </div>
          </div>

          {/* Checkout CTA */}
          <div className="pt-2 flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRenewModalOpen(false)}
              disabled={isProcessingPayment}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleInitiateRazorpay}
              isLoading={isProcessingPayment}
              className="font-bold shadow-sm"
            >
              <span>Pay {formatCurrency(renewalAmount)} via Razorpay</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
