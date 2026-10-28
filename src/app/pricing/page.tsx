import React from "react";
import { PublicNavbar } from "@/components/public/navbar";
import { PublicFooter } from "@/components/public/footer";
import { PricingCards } from "@/components/public/pricing-cards";
import { dataStore } from "@/lib/services/data-store";

export const metadata = {
  title: "Pricing Plans | RestroCharge by Vivexa Tech",
  description: "Affordable restaurant management & QR ordering subscriptions. Single source of truth pricing.",
};

export default function PricingPage() {
  const plans = dataStore.getPlans();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicNavbar />

      <main className="flex-1 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-brand-600 font-semibold text-xs tracking-wider uppercase">
              Subscription Plans
            </span>
            <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-slate-900 mt-2">
              Predictable Pricing. Zero Food Commissions.
            </h1>
            <p className="text-slate-600 mt-4 text-lg">
              Choose the right tier for your dining room. Upgrade, downgrade, or renew at any time via Razorpay or Vivexa Tech.
            </p>
          </div>

          <PricingCards plans={plans} />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
