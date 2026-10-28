"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubscriptionPlan } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface PricingCardsProps {
  plans: SubscriptionPlan[];
}

export function PricingCards({ plans }: PricingCardsProps) {
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");

  if (!plans || plans.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-12 text-center max-w-lg mx-auto">
        <h3 className="text-lg font-bold text-slate-900">Subscription Plans Being Configured</h3>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          Our public subscription pricing tiers are currently undergoing revision. Contact our onboarding team directly for customized packages.
        </p>
        <Link href="/restaurants/request" className="inline-block mt-4">
          <Button size="sm" className="font-semibold">
            Contact Vivexa Tech Sales
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            onClick={() => setBillingCycle("MONTHLY")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              billingCycle === "MONTHLY"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle("ANNUAL")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center space-x-1.5 ${
              billingCycle === "ANNUAL"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Annual Billing</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
              Save ~17%
            </span>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {plans.map((plan) => {
          const price = billingCycle === "ANNUAL" ? plan.annualPrice : plan.monthlyPrice;
          const periodText = billingCycle === "ANNUAL" ? "/year" : "/month";

          return (
            <div
              key={plan.id}
              className={`rounded-2xl p-8 flex flex-col justify-between transition-all ${
                plan.isPopular
                  ? "border-2 border-brand-500 bg-white shadow-elevated relative"
                  : "border border-slate-200 bg-white shadow-card hover:shadow-soft"
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="bg-brand-500 text-white border-0 px-3 py-1 text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Most Popular Choice
                  </Badge>
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{plan.tagline}</p>

                <div className="mt-6 mb-6 pb-6 border-b border-slate-100">
                  <div className="flex items-baseline space-x-1">
                    <span className="text-4xl font-extrabold text-slate-900">
                      {formatCurrency(price)}
                    </span>
                    <span className="text-sm font-medium text-slate-500">{periodText}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Excludes food orders. Platform access and updates only.
                  </p>
                </div>

                {/* Plan limits */}
                <div className="bg-slate-50 rounded-xl p-3 mb-6 text-xs text-slate-700 space-y-1.5 border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tables:</span>
                    <span className="font-semibold">{plan.limits.maxTables === 999 ? "Unlimited" : `Up to ${plan.limits.maxTables}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Menu Items:</span>
                    <span className="font-semibold">{plan.limits.maxProducts === 9999 ? "Unlimited" : `Up to ${plan.limits.maxProducts}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Staff Accounts:</span>
                    <span className="font-semibold">{plan.limits.maxStaff} members</span>
                  </div>
                </div>

                {/* Features list */}
                <ul className="space-y-3 text-xs text-slate-600 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Link href={`/restaurants/request?plan=${plan.id}`}>
                  <Button
                    variant={plan.isPopular ? "default" : "outline"}
                    className="w-full font-semibold"
                  >
                    Select {plan.name}
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
