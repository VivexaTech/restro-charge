import React from "react";
import { UserCheck, Settings, QrCode, Smartphone, LayoutDashboard } from "lucide-react";

export function PublicHowItWorks() {
  const steps = [
    {
      step: "01",
      icon: UserCheck,
      title: "Your restaurant joins RestroCharge",
      description: "Submit a registration request. Our team verifies your restaurant credentials and establishes your tenant workspace.",
    },
    {
      step: "02",
      icon: Settings,
      title: "Our team sets up your restaurant",
      description: "Vivexa Tech operations sets up your profile, customized branding, opening hours, and central billing settings.",
    },
    {
      step: "03",
      icon: QrCode,
      title: "We configure your menu & table QR codes",
      description: "Only authorized Vivexa Tech staff creates stable tables and issues high-resolution printable QR codes for your venue.",
    },
    {
      step: "04",
      icon: Smartphone,
      title: "Customers scan and order",
      description: "Diners scan the table QR with any smartphone camera. No app download or account creation required.",
    },
    {
      step: "05",
      icon: LayoutDashboard,
      title: "Your staff manages orders in real-time",
      description: "Orders stream into your live dashboard and Kitchen Display System (KDS) with instant sound chimes.",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-brand-400 font-semibold text-xs tracking-wider uppercase">
            Simple 5-Step Process
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold mt-2">
            How RestroCharge Transforms Your Dining Room
          </h2>
          <p className="text-slate-400 mt-3 text-base">
            From initial onboarding to table turnover, Vivexa Tech manages the complexity so you can focus on great food.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 relative flex flex-col justify-between hover:border-brand-500/50 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black text-brand-400 font-display">
                      {item.step}
                    </span>
                    <div className="h-10 w-10 rounded-xl bg-slate-700/60 flex items-center justify-center text-brand-400">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-base text-white mb-2 leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
