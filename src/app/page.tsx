import React from "react";
import Link from "next/link";
import { PublicNavbar } from "@/components/public/navbar";
import { PublicHero } from "@/components/public/hero";
import { PublicHowItWorks } from "@/components/public/how-it-works";
import { PublicFeatures } from "@/components/public/features";
import { PricingCards } from "@/components/public/pricing-cards";
import { PublicFooter } from "@/components/public/footer";
import { dataStore } from "@/lib/services/data-store";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Sparkles, ExternalLink, HelpCircle } from "lucide-react";

export default function HomePage() {
  const plans = dataStore.getPlans();
  const publishedRestaurants = dataStore.getPublishedRestaurants().slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicNavbar />

      <main className="flex-1">
        <PublicHero />
        <PublicHowItWorks />
        <PublicFeatures />

        {/* Featured Restaurants Showcase */}
        <section className="py-20 bg-slate-50 border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
              <div>
                <span className="text-brand-600 font-semibold text-xs tracking-wider uppercase">
                  Live Venues Powered by RestroCharge
                </span>
                <h2 className="text-3xl font-display font-bold text-slate-900 mt-1">
                  Explore Featured Restaurants
                </h2>
                <p className="text-slate-600 text-sm mt-2">
                  Browse live menus and custom websites created on RestroCharge.
                </p>
              </div>
              <div className="mt-4 md:mt-0">
                <Link href="/restaurants">
                  <Button variant="outline" size="sm">
                    View Full Directory
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {publishedRestaurants.map((rest) => (
                <div
                  key={rest.id}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-card hover:shadow-soft transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="h-44 w-full relative overflow-hidden bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={rest.branding.coverImageUrl}
                        alt={rest.name}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-700 shadow-sm">
                        {rest.cuisineType}
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-lg font-bold text-slate-900 mb-1">{rest.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center mb-3">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 mr-1" />
                        {rest.city}, {rest.state}
                      </p>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {rest.description}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 pt-0 border-t border-slate-100 mt-4 flex items-center justify-between">
                    <Link href={`/${rest.slug}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full font-medium">
                        View Restaurant Website
                        <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-brand-600 font-semibold text-xs tracking-wider uppercase">
                Transparent Pricing
              </span>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mt-2">
                Simple Plans for Ambitious Restaurants
              </h2>
              <p className="text-slate-600 mt-3 text-base">
                Single monthly or annual subscription. Zero commissions on customer dining checks.
              </p>
            </div>

            <PricingCards plans={plans} />
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section className="py-20 bg-slate-50 border-t border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-brand-600 font-semibold text-xs tracking-wider uppercase">
                Frequently Asked Questions
              </span>
              <h2 className="text-3xl font-display font-bold text-slate-900 mt-2">
                Everything You Need to Know
              </h2>
            </div>

            <div className="space-y-4">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-900 text-base mb-2">
                  Does RestroCharge take a percentage commission on food orders?
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  No. RestroCharge charges zero percentage commissions on food sales. Diners pay your restaurant directly at the counter or through your floor staff. You only pay for your RestroCharge software subscription.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-900 text-base mb-2">
                  Who generates the table QR codes?
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Only the authorized Vivexa Tech onboarding team generates and issues stable, print-ready QR codes for your tables. This ensures stable URLs, correct table mapping, and tenant isolation.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-900 text-base mb-2">
                  What happens if our subscription expires?
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  RestroCharge provides an automatic 3-day grace period with renewal alerts. During the grace period, your public site and QR ordering remain active. After the grace period concludes, ordering is paused until self-renewal or administrative reactivation. All historical order and menu data is safely retained.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to action */}
        <section className="py-20 bg-slate-900 text-white relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold">
              Ready to modernise your dining operations?
            </h2>
            <p className="text-slate-400 text-base max-w-xl mx-auto">
              Join leading restaurants using RestroCharge for faster table turns, zero waiter order mistakes, and a modern digital presence.
            </p>
            <div className="pt-2">
              <Link href="/restaurants/request">
                <Button size="lg" className="font-semibold px-8 shadow-lg">
                  Request Onboarding from Vivexa Tech
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
