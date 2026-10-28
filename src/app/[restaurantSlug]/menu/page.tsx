import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { UtensilsCrossed, ChevronRight, AlertCircle } from "lucide-react";
import { dataStore } from "@/lib/services/data-store";
import { formatCurrency } from "@/lib/utils";

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

export async function generateMetadata({ params }: Props) {
  const { restaurantSlug } = params;
  if (RESERVED_SLUGS.includes(restaurantSlug.toLowerCase())) return {};

  const restaurant = dataStore.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) return { title: "Menu Not Found | RestroCharge" };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://restrocharge.vivexatech.in";
  const canonicalUrl = `${baseUrl}/${restaurant.slug}/menu`;

  return {
    title: `Menu | ${restaurant.name} - Complete Food & Beverage Catalog`,
    description: `Explore the full digital menu for ${restaurant.name} in ${restaurant.city}. View dishes, prices, vegetarian options, and chef specialties.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Menu | ${restaurant.name}`,
      description: `Complete digital dining menu for ${restaurant.name}.`,
      url: canonicalUrl,
    },
  };
}

export default function RestaurantMenuPage({ params }: Props) {
  const { restaurantSlug } = params;
  if (RESERVED_SLUGS.includes(restaurantSlug.toLowerCase())) notFound();

  const restaurant = dataStore.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();

  const categories = dataStore.getCategories(restaurant.id);
  const products = dataStore.getProducts(restaurant.id);
  const branding = restaurant.branding;
  const primaryColor = branding?.primaryColor || "#ea580c";

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center space-x-2 text-xs text-slate-500 mb-6">
          <Link href={`/${restaurant.slug}`} className="hover:text-slate-900 transition-colors">
            Home
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="font-semibold text-slate-900">Menu</span>
        </nav>

        {/* Page Header */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: primaryColor }}
            >
              A La Carte Catalog
            </span>
            <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-slate-900 mt-1">
              {restaurant.name} Menu
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xl leading-relaxed">
              Browse our freshly prepared dishes below. For dine-in patrons, instant contact-free table ordering is powered by table QR codes on your table.
            </p>
          </div>

          <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200/80 text-xs text-amber-900 flex items-start space-x-2 max-w-xs shrink-0">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              <strong>Table Ordering:</strong> Scan the table QR at your dining seat to place an order directly to the kitchen.
            </p>
          </div>
        </div>

        {/* Categorized Dishes */}
        <div className="space-y-12">
          {categories.map((cat) => {
            const catProducts = products.filter((p) => p.categoryId === cat.id);
            if (catProducts.length === 0) return null;

            return (
              <div key={cat.id} className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h2 className="text-2xl font-bold font-display text-slate-900">
                    {cat.name}
                  </h2>
                  {cat.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {catProducts.map((prod) => (
                    <div
                      key={prod.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card hover:shadow-elevated transition flex items-start justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              prod.isVeg ? "bg-emerald-600" : "bg-red-600"
                            }`}
                            title={prod.isVeg ? "Vegetarian" : "Non-Vegetarian"}
                          />
                          <h3 className="font-bold text-sm text-slate-900">
                            {prod.name}
                          </h3>
                        </div>

                        <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                          {prod.description}
                        </p>

                        <div className="mt-3 flex items-center space-x-3">
                          <span className="text-sm font-bold text-slate-900 font-display">
                            {formatCurrency(prod.price)}
                          </span>
                          {!prod.isAvailable && (
                            <span className="text-[10px] text-amber-700 bg-amber-100 font-semibold px-2 py-0.5 rounded">
                              Sold Out Today
                            </span>
                          )}
                        </div>
                      </div>

                      {prod.imageUrl && (
                        <div className="h-20 w-20 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
