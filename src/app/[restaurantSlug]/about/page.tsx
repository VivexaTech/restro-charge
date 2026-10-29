import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Compass,
  ExternalLink,
  ChevronRight,
  CheckCircle,
  Instagram,
  Facebook,
  Twitter,
  ChefHat,
} from "lucide-react";
import { dataStore } from "@/lib/services/data-store";
import { Button } from "@/components/ui/button";

interface Props {
  params: {
    restaurantSlug: string;
  };
}

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

import { firestoreService } from "@/lib/services/firestore-service";

export async function generateMetadata({ params }: Props) {
  const { restaurantSlug } = params;
  if (RESERVED_SLUGS.includes(restaurantSlug.toLowerCase())) return {};

  let restaurant = dataStore.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) {
    restaurant = await firestoreService.getRestaurantBySlug(restaurantSlug);
    if (restaurant) dataStore.saveRestaurantLocally(restaurant);
  }
  if (!restaurant) return { title: "About Not Found | RestroCharge" };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://restrocharge.vivexatech.in";
  const canonicalUrl = `${baseUrl}/${restaurant.slug}/about`;

  return {
    title: `About & Contact | ${restaurant.name} - Location, Hours & Reservations`,
    description: `Learn about the culinary story behind ${restaurant.name} in ${restaurant.city}. Find our address, phone number, opening hours schedule, and directions.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `About & Contact | ${restaurant.name}`,
      description: `Visit ${restaurant.name} in ${restaurant.city}. View our story, address, and contact information.`,
      url: canonicalUrl,
    },
  };
}

export default async function RestaurantAboutPage({ params }: Props) {
  const { restaurantSlug } = params;
  if (RESERVED_SLUGS.includes(restaurantSlug.toLowerCase())) notFound();

  let restaurant = dataStore.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) {
    restaurant = await firestoreService.getRestaurantBySlug(restaurantSlug);
    if (restaurant) dataStore.saveRestaurantLocally(restaurant);
  }
  if (!restaurant) notFound();

  const branding = restaurant.branding;
  const config = restaurant.websiteConfig;
  const primaryColor = branding?.primaryColor || "#ea580c";
  const social = config?.socialLinks || {};

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center space-x-2 text-xs text-slate-500">
          <Link href={`/${restaurant.slug}`} className="hover:text-slate-900 transition-colors">
            Home
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="font-semibold text-slate-900">About & Contact</span>
        </nav>

        {/* Story Section */}
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center space-x-2">
            <ChefHat className="h-5 w-5" style={{ color: primaryColor }} />
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: primaryColor }}
            >
              Our Heritage & Philosophy
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-slate-900">
            About {restaurant.name}
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            {config?.aboutText || restaurant.description}
          </p>

          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Specializing in {restaurant.cuisineType}, we take immense pride in crafting exceptional dining experiences that blend culinary artistry with attentive hospitality.
          </p>

          {/* Amenities & Features */}
          {config?.amenities && config.amenities.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Venue Amenities & Facilities
              </h3>
              <div className="flex flex-wrap gap-2">
                {config.amenities.map((amenity, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600 mr-1.5" />
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Contact, Hours & Map Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Contact Details Card */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
            <h2 className="text-xl font-bold font-display text-slate-900 flex items-center space-x-2">
              <Phone className="h-5 w-5" style={{ color: primaryColor }} />
              <span>Contact Information</span>
            </h2>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="flex items-start space-x-3">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block mb-0.5">Physical Address</strong>
                  <p>{config?.address || restaurant.address}</p>
                  <p>
                    {config?.city || restaurant.city}, {restaurant.state} - {restaurant.postalCode}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Phone className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block mb-0.5">Telephone</strong>
                  <a
                    href={`tel:${config?.contactPhone || restaurant.phone}`}
                    className="text-brand-600 hover:underline font-semibold"
                  >
                    {config?.contactPhone || restaurant.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Mail className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block mb-0.5">Email Inquiries</strong>
                  <a
                    href={`mailto:${config?.contactEmail || restaurant.ownerEmail}`}
                    className="text-brand-600 hover:underline font-semibold"
                  >
                    {config?.contactEmail || restaurant.ownerEmail}
                  </a>
                </div>
              </div>
            </div>

            {/* Social Media */}
            {(social.instagram || social.facebook || social.twitter) && (
              <div className="pt-4 border-t border-slate-100">
                <strong className="text-xs font-bold text-slate-800 block mb-2">
                  Social Channels
                </strong>
                <div className="flex items-center space-x-2">
                  {social.instagram && (
                    <a
                      href={social.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
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
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
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
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      title="Twitter"
                    >
                      <Twitter className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Operating Hours Card */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
            <h2 className="text-xl font-bold font-display text-slate-900 flex items-center space-x-2">
              <Clock className="h-5 w-5" style={{ color: primaryColor }} />
              <span>Operating Hours</span>
            </h2>

            <div className="space-y-3 text-xs text-slate-600">
              {config?.openingHours?.map((slot, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <span className="font-bold text-slate-800">{slot.days}</span>
                  <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                    {slot.open} – {slot.close}
                  </span>
                </div>
              ))}
            </div>

            {config?.directionsUrl && (
              <div className="pt-4 border-t border-slate-100">
                <a
                  href={config.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  <Compass className="h-3.5 w-3.5 mr-1.5" />
                  Open Navigation Route in Maps →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Map Embed Preview (If Location Configured) */}
        {restaurant.locationSettings?.isConfigured &&
          restaurant.locationSettings.latitude &&
          restaurant.locationSettings.longitude && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-brand-600" />
                  <span>Interactive Map & Location</span>
                </h3>
                <a
                  href={`https://www.google.com/maps?q=${restaurant.locationSettings.latitude},${restaurant.locationSettings.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-brand-600 hover:underline flex items-center"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Google Maps
                </a>
              </div>

              <div className="h-64 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <iframe
                  title={`${restaurant.name} Location`}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                    restaurant.locationSettings.longitude - 0.005
                  }%2C${restaurant.locationSettings.latitude - 0.005}%2C${
                    restaurant.locationSettings.longitude + 0.005
                  }%2C${restaurant.locationSettings.latitude + 0.005}&layer=mapnik&marker=${
                    restaurant.locationSettings.latitude
                  }%2C${restaurant.locationSettings.longitude}`}
                />
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
