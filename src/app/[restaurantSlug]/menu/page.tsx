import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { UtensilsCrossed, ChevronRight, AlertCircle, Sparkles, Tag } from "lucide-react";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";
import { formatCurrency } from "@/lib/utils";
import {
  isOfferActive,
  resolveBestOfferForItem,
  validateAndEvaluateCombo,
} from "@/lib/services/offers-engine";

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

  let restaurant = dataStore.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) {
    restaurant = await firestoreService.getRestaurantBySlug(restaurantSlug);
    if (restaurant) dataStore.saveRestaurantLocally(restaurant);
  }
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

export default async function RestaurantMenuPage({ params }: Props) {
  const { restaurantSlug } = params;
  if (RESERVED_SLUGS.includes(restaurantSlug.toLowerCase())) notFound();

  let restaurant = dataStore.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) {
    restaurant = await firestoreService.getRestaurantBySlug(restaurantSlug);
    if (restaurant) dataStore.saveRestaurantLocally(restaurant);
  }
  if (!restaurant) notFound();

  let categories = dataStore.getCategories(restaurant.id);
  if (categories.length === 0) {
    categories = await firestoreService.getCategories(restaurant.id);
    categories.forEach((c) => dataStore.saveCategory(c));
  }

  let products = dataStore.getProducts(restaurant.id);
  if (products.length === 0) {
    products = await firestoreService.getProducts(restaurant.id);
    products.forEach((p) => dataStore.saveProduct(p));
  }

  let offers = dataStore.getOffers(restaurant.id);
  if (offers.length === 0) {
    offers = await firestoreService.getOffers(restaurant.id);
    offers.forEach((o) => dataStore.saveOfferLocally(o));
  }
  const activeCombos = offers.filter((o) => o.offerType === "COMBO" && isOfferActive(o));
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

        {/* Active Combos & Deals Showcase */}
        {activeCombos.length > 0 && (
          <div className="mb-12 bg-gradient-to-br from-purple-50/70 via-white to-amber-50/40 rounded-3xl p-6 sm:p-8 border border-purple-200 shadow-sm">
            <div className="flex items-center space-x-2.5 mb-6">
              <span className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-2xl font-bold font-display text-slate-900">
                  Special Combos & Deals
                </h2>
                <p className="text-xs text-slate-500">
                  Value meal bundles prepared fresh daily.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCombos.map((combo) => {
                const comboEval = validateAndEvaluateCombo(combo, products);
                return (
                  <div
                    key={combo.id}
                    className="bg-white rounded-2xl p-5 border border-purple-100 shadow-sm flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-extrabold uppercase bg-purple-600 text-white px-2 py-0.5 rounded">
                          COMBO MEAL
                        </span>
                        <h3 className="font-bold text-base text-slate-900 font-display">
                          {combo.name}
                        </h3>
                      </div>
                      {combo.description && (
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                          {combo.description}
                        </p>
                      )}

                      <div className="mt-3 bg-purple-50/50 p-2.5 rounded-xl border border-purple-100/60 text-xs text-slate-600 space-y-1">
                        <span className="font-bold text-purple-900 text-[11px] block">
                          Included in Bundle:
                        </span>
                        {comboEval.comboItemsSnapshot.map((ci) => (
                          <div key={ci.productId} className="flex items-center space-x-1.5">
                            <span className="text-purple-600 font-bold">•</span>
                            <span>
                              {ci.quantity}x {ci.productName}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div>
                        {comboEval.regularTotal > (combo.comboPrice || 0) && (
                          <span className="text-xs line-through text-slate-400 font-medium mr-2">
                            {formatCurrency(comboEval.regularTotal)}
                          </span>
                        )}
                        <span className="text-xl font-extrabold text-purple-700 font-display">
                          {formatCurrency(combo.comboPrice || 0)}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                        Saves {formatCurrency(Math.max(0, comboEval.regularTotal - (combo.comboPrice || 0)))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Categorized Dishes */}
        <div className="space-y-12">
          {categories.map((cat) => {
            if (cat.id === "cat_pj_special_offers" || cat.name.toLowerCase().includes("special offer")) {
              return null; // Special offers are rendered via table QR dine-in ordering
            }
            const catProducts = products.filter(
              (p) => p.categoryId === cat.id && !p.id.startsWith("prod_pj_offer_")
            );
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
                  {catProducts.map((prod) => {
                    const offerEval = resolveBestOfferForItem(prod, undefined, offers);

                    return (
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
                            {offerEval.hasOffer ? (
                              <div className="flex items-baseline space-x-1.5">
                                <span className="text-xs line-through text-slate-400 font-medium">
                                  {formatCurrency(prod.price)}
                                </span>
                                <span className="text-sm font-bold text-brand-700 font-display">
                                  {formatCurrency(offerEval.effectivePrice)}
                                </span>
                                {offerEval.appliedOffer && (
                                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                                    {offerEval.appliedOffer.name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm font-bold text-slate-900 font-display">
                                {formatCurrency(prod.price)}
                              </span>
                            )}
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
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
