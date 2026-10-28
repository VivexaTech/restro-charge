import React from "react";
import {
  QrCode,
  UtensilsCrossed,
  Globe,
  BellRing,
  ChefHat,
  PackageOpen,
  BarChart3,
  Users,
  CreditCard,
} from "lucide-react";

export function PublicFeatures() {
  const features = [
    {
      icon: QrCode,
      title: "QR-Based Table Ordering",
      description: "Fast mobile ordering with zero app install. Diners scan and submit food orders directly from their table.",
    },
    {
      icon: UtensilsCrossed,
      title: "Digital Restaurant Menu",
      description: "Crisp categories, dietary indicators (Veg/Non-veg), high-res food images, and instant out-of-stock toggling.",
    },
    {
      icon: Globe,
      title: "Branded Restaurant Website",
      description: "Every restaurant gets its own custom page under RestroCharge with personalized colors, logo, hours, and story.",
    },
    {
      icon: BellRing,
      title: "Real-Time Order Streams",
      description: "Instant order updates without manual refreshing. Sound chimes notify floor staff the moment an order lands.",
    },
    {
      icon: ChefHat,
      title: "Kitchen Order Display (KDS)",
      description: "Purpose-built tablet view for kitchen line cooks with big readable tickets, elapsed timers, and status buttons.",
    },
    {
      icon: PackageOpen,
      title: "Product & Stock Control",
      description: "Add, edit, or archive menu items safely. Preserve historical order records when menu prices or items evolve.",
    },
    {
      icon: BarChart3,
      title: "Order & Traffic Analytics",
      description: "Track daily order volumes, popular signature dishes, and table occupancy metrics from your admin panel.",
    },
    {
      icon: Users,
      title: "Role-Based Staff Access",
      description: "Dedicated accounts for owners, managers, floor servers, and kitchen line staff with strict least-privilege security.",
    },
    {
      icon: CreditCard,
      title: "Simple Subscription Management",
      description: "Self-renew RestroCharge platform access via Razorpay or manage through Vivexa Tech team with a 3-day grace period.",
    },
  ];

  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-brand-600 font-semibold text-xs tracking-wider uppercase">
            Platform Capabilities
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mt-2">
            Engineered for Modern Dining Operations
          </h2>
          <p className="text-slate-600 mt-3 text-base">
            Everything your dining room, kitchen, and management team need to deliver exceptional service.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="group p-8 rounded-2xl border border-slate-200/90 bg-white hover:border-brand-500/40 hover:shadow-soft transition-all"
              >
                <div className="h-12 w-12 rounded-xl bg-brand-50 text-brand-600 group-hover:bg-brand-500 group-hover:text-white flex items-center justify-center transition-colors mb-5">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-brand-600 transition-colors">
                  {feat.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {feat.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
