import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Phone,
  MapPin,
  Clock,
  ExternalLink,
  UtensilsCrossed,
  AlertTriangle,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  Globe,
} from "lucide-react";
import { dataStore } from "@/lib/services/data-store";
import { getSubscriptionAccess } from "@/lib/services/subscription";
import { Button } from "@/components/ui/button";

const RESERVED_SLUGS = [
  "pricing",
  "restaurants",
  "login",
  "forgot-password",
  "dashboard",
  "staff",
  "super-admin",
  "order",
  "api",
  "sitemap.xml",
  "robots.txt",
  "sitemaps",
];

interface Props {
  children: React.ReactNode;
  params: {
    restaurantSlug: string;
  };
}

export default function RestaurantWebsiteLayout({ children, params }: Props) {
  const { restaurantSlug } = params;

  if (RESERVED_SLUGS.includes(restaurantSlug.toLowerCase())) {
    notFound();
  }

  const restaurant = dataStore.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) {
    notFound();
  }

  // Subscription & Grace Period Check
  const subAccess = getSubscriptionAccess(restaurant.subscription);

  // If suspended or expired beyond 3-day grace period, or unpublished, display notice
  if (!subAccess.canViewSite || !restaurant.published) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-elevated">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">{restaurant.name}</h1>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            This restaurant website is currently offline. If you are the owner, please check your subscription status in the RestroCharge dashboard.
          </p>
          <div className="space-y-2">
            <Link href="/login">
              <Button size="sm" className="w-full">
                Restaurant Owner Login
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm" className="w-full">
                Visit RestroCharge Platform
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const branding = restaurant.branding;
  const config = restaurant.websiteConfig;
  const primaryColor = branding?.primaryColor || "#ea580c";

  // Verified social links
  const social = config?.socialLinks || {};

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* Grace period warning banner if applicable */}
      {subAccess.isGracePeriod && (
        <div className="bg-amber-600 text-white text-xs py-2 px-4 text-center font-medium shadow-sm">
          Notice: This restaurant website is operating under its {subAccess.graceDaysRemaining}-day subscription grace period.
        </div>
      )}

      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Identity */}
          <Link href={`/${restaurant.slug}`} className="flex items-center space-x-3 group">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={restaurant.name}
                className="h-12 w-12 rounded-xl object-cover border border-slate-200 shadow-sm group-hover:scale-105 transition-transform"
              />
            ) : (
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {restaurant.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-lg sm:text-xl font-bold font-display text-slate-900 tracking-tight leading-none group-hover:text-slate-800 transition-colors">
                {restaurant.name}
              </h1>
              <span className="text-xs text-slate-500 font-medium mt-0.5 block">
                {restaurant.cuisineType}
              </span>
            </div>
          </Link>

          {/* Navigation Links (3 Minimum Public Pages) */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href={`/${restaurant.slug}`}
              className="text-sm font-semibold text-slate-700 hover:text-brand-600 transition-colors"
            >
              Home
            </Link>
            <Link
              href={`/${restaurant.slug}/menu`}
              className="text-sm font-semibold text-slate-700 hover:text-brand-600 transition-colors"
            >
              Menu
            </Link>
            <Link
              href={`/${restaurant.slug}/about`}
              className="text-sm font-semibold text-slate-700 hover:text-brand-600 transition-colors"
            >
              About & Contact
            </Link>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center space-x-2.5">
            <a href={`tel:${config?.contactPhone || restaurant.phone}`}>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex items-center text-xs h-9"
              >
                <Phone className="h-3.5 w-3.5 mr-1.5" />
                Call Restaurant
              </Button>
            </a>
            <Link href={`/${restaurant.slug}/menu`}>
              <button
                className="px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm hover:opacity-95 transition"
                style={{ backgroundColor: primaryColor }}
              >
                View Menu
              </button>
            </Link>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-100 py-2.5 bg-slate-50/80 text-xs font-semibold text-slate-600">
          <Link href={`/${restaurant.slug}`} className="hover:text-brand-600">
            Home
          </Link>
          <span className="text-slate-300">•</span>
          <Link href={`/${restaurant.slug}/menu`} className="hover:text-brand-600">
            Menu
          </Link>
          <span className="text-slate-300">•</span>
          <Link href={`/${restaurant.slug}/about`} className="hover:text-brand-600">
            About & Contact
          </Link>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1">{children}</main>

      {/* Professional Three-Column Footer */}
      <footer className="bg-slate-950 text-slate-300 pt-16 pb-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-12 border-b border-slate-800">
            {/* Column 1: Restaurant Identity */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                {branding?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={branding.logoUrl}
                    alt={restaurant.name}
                    className="h-10 w-10 rounded-xl object-cover border border-slate-700"
                  />
                ) : (
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-base"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {restaurant.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-white font-display leading-tight">
                    {restaurant.name}
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">
                    {restaurant.cuisineType}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                {restaurant.description ||
                  "Serving exquisite culinary dishes crafted with premium ingredients and generational passion."}
              </p>

              <div className="text-[11px] text-slate-500 font-mono">
                Location: {restaurant.city}, {restaurant.state}
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Explore Website
              </h4>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <Link
                    href={`/${restaurant.slug}`}
                    className="hover:text-white transition-colors"
                  >
                    Restaurant Home
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${restaurant.slug}/menu`}
                    className="hover:text-white transition-colors"
                  >
                    Full A La Carte Menu
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${restaurant.slug}/about`}
                    className="hover:text-white transition-colors"
                  >
                    About Story & Contact Details
                  </Link>
                </li>
                {config?.directionsUrl && (
                  <li>
                    <a
                      href={config.directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors inline-flex items-center"
                    >
                      <MapPin className="h-3 w-3 mr-1 text-brand-400" />
                      Get Driving Directions
                    </a>
                  </li>
                )}
              </ul>
            </div>

            {/* Column 3: Contact & Verified Social Media */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Contact & Hours
              </h4>
              <div className="space-y-2 text-xs text-slate-400">
                <p>
                  <strong className="text-slate-300">Address:</strong>{" "}
                  {config?.address || restaurant.address}, {config?.city || restaurant.city}
                </p>
                <p>
                  <strong className="text-slate-300">Phone:</strong>{" "}
                  <a
                    href={`tel:${config?.contactPhone || restaurant.phone}`}
                    className="hover:text-white transition-colors"
                  >
                    {config?.contactPhone || restaurant.phone}
                  </a>
                </p>
                <p>
                  <strong className="text-slate-300">Email:</strong>{" "}
                  <a
                    href={`mailto:${config?.contactEmail || restaurant.ownerEmail}`}
                    className="hover:text-white transition-colors"
                  >
                    {config?.contactEmail || restaurant.ownerEmail}
                  </a>
                </p>
              </div>

              {/* Verified Social Media Links */}
              {(social.instagram || social.facebook || social.twitter) && (
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-2 uppercase tracking-wider">
                    Follow Us
                  </span>
                  <div className="flex items-center space-x-3">
                    {social.instagram && (
                      <a
                        href={social.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                        title="Instagram"
                      >
                        <Instagram className="h-4 w-4" />
                      </a>
                    )}
                    {social.facebook && (
                      <a
                        href={social.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                        title="Facebook"
                      >
                        <Facebook className="h-4 w-4" />
                      </a>
                    )}
                    {social.twitter && (
                      <a
                        href={social.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                        title="Twitter / X"
                      >
                        <Twitter className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Bar: Copyright & Platform Attribution */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} {restaurant.name}. All rights reserved.</p>
            <p className="flex items-center space-x-1.5 text-slate-400">
              <span>Independent restaurant website powered by</span>
              <Link href="/" className="text-brand-400 hover:text-brand-300 font-semibold underline">
                RestroCharge by Vivexa Tech
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
