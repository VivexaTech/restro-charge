import React from "react";
import Link from "next/link";
import { UtensilsCrossed, Shield, Mail, Phone, MapPin } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <span className="font-display font-bold text-xl text-white">
                RestroCharge
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Enterprise Multi-Tenant Restaurant Management, Digital Menus & QR Table Ordering SaaS developed and powered by Vivexa Tech.
            </p>
            <div className="flex items-center space-x-2 text-xs text-brand-400 font-medium">
              <Shield className="h-4 w-4" />
              <span>Production-grade Tenant Isolation</span>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Platform
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/#features" className="hover:text-white transition">
                  QR Table Ordering
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-white transition">
                  Kitchen Order Display (KDS)
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-white transition">
                  Custom Restaurant Websites
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition">
                  Pricing Plans
                </Link>
              </li>
              <li>
                <Link href="/restaurants" className="hover:text-white transition">
                  Restaurant Directory
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Access Portals */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Experiences
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/order/vivexa-restro/table-01" className="text-brand-400 hover:text-brand-300 transition">
                  Customer QR Demo (/order/vivexa-restro/table-01)
                </Link>
              </li>
              <li>
                <Link href="/vivexa-restro" className="hover:text-white transition">
                  Public Restaurant Site (/vivexa-restro)
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-white transition">
                  Restaurant Admin Dashboard
                </Link>
              </li>
              <li>
                <Link href="/staff/kitchen" className="hover:text-white transition">
                  Kitchen Display System (KDS)
                </Link>
              </li>
              <li>
                <Link href="/super-admin" className="hover:text-white transition">
                  Vivexa Tech Super Admin
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Vivexa Tech */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Vivexa Tech
            </h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-start space-x-2.5">
                <MapPin className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                <span>Vivexa Tech Software Labs, India</span>
              </li>
              <li className="flex items-center space-x-2.5">
                <Mail className="h-4 w-4 text-brand-400 shrink-0" />
                <span>support@vivexatech.in</span>
              </li>
              <li className="flex items-center space-x-2.5">
                <Phone className="h-4 w-4 text-brand-400 shrink-0" />
                <span>+91 98765 00000</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>© {new Date().getFullYear()} RestroCharge. Developed & Operated by Vivexa Tech. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <Link href="/privacy" className="hover:text-slate-300">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-300">Terms of Service</Link>
            <Link href="/security" className="hover:text-slate-300">Security Architecture</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
