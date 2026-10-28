"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PublicNavbar } from "@/components/public/navbar";
import { PublicFooter } from "@/components/public/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ArrowRight, Utensils, Building2, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function RestaurantRegistrationRequestPage() {
  const [formData, setFormData] = useState({
    applicantName: "",
    restaurantName: "",
    email: "",
    phone: "",
    city: "",
    cuisine: "",
    estimatedTables: 12,
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.applicantName || !formData.restaurantName || !formData.email || !formData.phone || !formData.city) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      setSubmitted(true);
      setSubmittedId(data.request?.id || "REQ-OK");
      toast.success("Onboarding request submitted successfully!");
    } catch (err: any) {
      toast.error(err.message || "An error occurred while submitting.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicNavbar />

      <main className="flex-1 py-12 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {submitted ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-elevated text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="text-3xl font-display font-bold text-slate-900">
                Request Received!
              </h1>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Thank you for applying to onboard <strong>{formData.restaurantName}</strong> onto RestroCharge. Our Vivexa Tech onboarding team has received your details (Reference ID: <span className="font-mono font-semibold text-slate-900">{submittedId}</span>).
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 max-w-md mx-auto text-left">
                <strong>Important Process Notice:</strong> Per Vivexa Tech security architecture, restaurant subscriptions and table QR codes are verified and issued by our certified operations team before going live.
              </div>
              <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
                <Link href="/">
                  <Button variant="outline">Return to Homepage</Button>
                </Link>
                <Link href="/pricing">
                  <Button>View Subscription Plans</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-elevated">
              <div className="text-center max-w-xl mx-auto mb-10">
                <span className="text-brand-600 font-semibold text-xs tracking-wider uppercase">
                  Vivexa Tech Onboarding
                </span>
                <h1 className="text-3xl font-display font-extrabold text-slate-900 mt-1">
                  Request Restaurant Onboarding
                </h1>
                <p className="text-xs text-slate-500 mt-2">
                  Fill in your dining establishment details below. An executive will configure your digital menu and table QR codes.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Your Full Name *
                    </label>
                    <Input
                      placeholder="e.g. Rashid Khan"
                      value={formData.applicantName}
                      onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Restaurant Name *
                    </label>
                    <Input
                      placeholder="e.g. Royal Spice Bistro"
                      value={formData.restaurantName}
                      onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Business Email Address *
                    </label>
                    <Input
                      type="email"
                      placeholder="owner@yourrestaurant.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Contact Phone Number *
                    </label>
                    <Input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      City *
                    </label>
                    <Input
                      placeholder="e.g. Jaipur"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Cuisine Type
                    </label>
                    <Input
                      placeholder="e.g. Mughlai, Cafe, Tandoor"
                      value={formData.cuisine}
                      onChange={(e) => setFormData({ ...formData, cuisine: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Estimated Tables
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      value={formData.estimatedTables}
                      onChange={(e) => setFormData({ ...formData, estimatedTables: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Additional Requirements or Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Tell us about your seating areas (e.g., Rooftop, AC Hall), bar setup, or current POS system..."
                    className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    size="lg"
                    isLoading={isSubmitting}
                    className="w-full font-semibold shadow-md"
                  >
                    Submit Onboarding Application
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>

                <p className="text-[11px] text-slate-400 text-center">
                  By submitting, you agree to RestroCharge&apos;s terms and Vivexa Tech SaaS privacy policy.
                </p>
              </form>
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
