import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Phone,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  UtensilsCrossed,
  ChefHat,
  Award,
} from "lucide-react";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { resolveBestOfferForItem } from "@/lib/services/offers-engine";

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
  if (!restaurant) return { title: "Restaurant Not Found | RestroCharge" };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://restrocharge.vivexatech.in";
  const canonicalUrl = `${baseUrl}/${restaurant.slug}`;

  return {
    title: restaurant.websiteConfig?.seoTitle || `${restaurant.name} | Official Restaurant Website`,
    description:
      restaurant.websiteConfig?.seoDescription ||
      `Welcome to ${restaurant.name} in ${restaurant.city}. Explore our authentic ${restaurant.cuisineType} menu, opening hours, and dine-in experience.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${restaurant.name} | Official Website`,
      description: restaurant.description,
      url: canonicalUrl,
      images: [
        {
          url: restaurant.branding?.coverImageUrl || restaurant.branding?.logoUrl || "",
          width: 1200,
          height: 630,
          alt: restaurant.name,
        },
      ],
    },
  };
}

export default async function RestaurantHomePage({ params }: Props) {
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
  const branding = restaurant.branding;
  const config = restaurant.websiteConfig;
  const primaryColor = branding?.primaryColor || "#ea580c";

  // Featured dishes preview (first 6 available items)
  const featuredProducts = products
    .filter((p) => p.isAvailable && (p.isFeatured || true))
    .slice(0, 6);

  // Schema.org Structured Data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name,
    image: branding?.coverImageUrl || branding?.logoUrl,
    telephone: config?.contactPhone || restaurant.phone,
    email: config?.contactEmail || restaurant.ownerEmail,
    servesCuisine: restaurant.cuisineType,
    url: `${process.env.NEXT_PUBLIC_APP_URL || "https://restrocharge.vivexatech.in"}/${restaurant.slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: config?.address || restaurant.address,
      addressLocality: config?.city || restaurant.city,
      addressRegion: restaurant.state,
      postalCode: restaurant.postalCode,
      addressCountry: "IN",
    },
    ...(restaurant.locationSettings?.isConfigured &&
      restaurant.locationSettings.latitude &&
      restaurant.locationSettings.longitude && {
        geo: {
          "@type": "GeoCoordinates",
          latitude: restaurant.locationSettings.latitude,
          longitude: restaurant.locationSettings.longitude,
        },
      }),
  };

  return (
    <>
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-950 text-white py-24 sm:py-32 lg:py-36">
        {/* Cover Image Background */}
        <div className="absolute inset-0 opacity-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              branding?.coverImageUrl ||
              "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80"
            }
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/40" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/10 backdrop-blur-md border border-white/20 text-white">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" />
            <span>{restaurant.cuisineType}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-display font-extrabold tracking-tight leading-tight">
            {config?.heroTitle || `Experience Authentic Flavors at ${restaurant.name}`}
          </h1>

          <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {config?.heroSubtitle || restaurant.description}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link href={`/${restaurant.slug}/menu`}>
              <button
                className="px-7 py-3.5 rounded-xl font-bold text-white text-sm shadow-xl hover:opacity-95 transition flex items-center space-x-2"
                style={{ backgroundColor: primaryColor }}
              >
                <span>Browse Full Menu</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>

            <a href={`tel:${config?.contactPhone || restaurant.phone}`}>
              <button className="px-6 py-3.5 rounded-xl font-semibold text-white text-sm bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 transition flex items-center space-x-2">
                <Phone className="h-4 w-4" />
                <span>Call Restaurant</span>
              </button>
            </a>

            {config?.directionsUrl && (
              <a
                href={config.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 rounded-xl font-semibold text-slate-200 text-sm bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 transition flex items-center space-x-2"
              >
                <MapPin className="h-4 w-4 text-brand-400" />
                <span>Directions</span>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Story & Culinary Highlights */}
      <section className="py-20 bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-widest text-brand-600">
            <ChefHat className="h-4 w-4" />
            <span>Our Culinary Story</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            Crafted with Passion & Fresh Ingredients
          </h2>

          <p className="text-base text-slate-600 leading-relaxed max-w-3xl mx-auto">
            {config?.aboutText || restaurant.description}
          </p>

          {config?.amenities && config.amenities.length > 0 && (
            <div className="pt-4 flex flex-wrap items-center justify-center gap-2.5">
              {config.amenities.map((amenity, i) => (
                <span
                  key={i}
                  className="inline-flex items-center text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-full"
                >
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600 mr-1.5" />
                  {amenity}
                </span>
              ))}
            </div>
          )}

          <div className="pt-2">
            <Link
              href={`/${restaurant.slug}/about`}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 underline"
            >
              Read full story and restaurant details →
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Menu Highlights Preview */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-brand-600">
                Signature Selections
              </span>
              <h2 className="text-3xl font-display font-bold text-slate-900 mt-1">
                Featured Dishes
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                A preview of our most celebrated dishes. Browse our complete menu for all categories.
              </p>
            </div>

            <Link href={`/${restaurant.slug}/menu`}>
              <Button size="sm" className="font-semibold shadow-sm">
                View All {products.length} Items
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProducts.map((prod) => (
              <div
                key={prod.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card hover:shadow-elevated transition flex flex-col justify-between"
              >
                <div>
                  {prod.imageUrl && (
                    <div className="h-44 w-full rounded-xl bg-slate-100 overflow-hidden mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        prod.isVeg ? "bg-emerald-600" : "bg-red-600"
                      }`}
                      title={prod.isVeg ? "Vegetarian" : "Non-Vegetarian"}
                    />
                    <h3 className="font-bold text-sm text-slate-900 line-clamp-1">
                      {prod.name}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                    {prod.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {(() => {
                    const offerEval = resolveBestOfferForItem(prod, undefined, offers);
                    if (offerEval.hasOffer) {
                      return (
                        <div className="flex items-baseline space-x-1.5">
                          <span className="text-xs line-through text-slate-400 font-medium">
                            {formatCurrency(prod.price)}
                          </span>
                          <span className="text-sm font-bold text-brand-700 font-display">
                            {formatCurrency(offerEval.effectivePrice)}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <span className="text-sm font-bold text-slate-900 font-display">
                        {formatCurrency(prod.price)}
                      </span>
                    );
                  })()}
                  <Link
                    href={`/${restaurant.slug}/menu`}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    View in Menu
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section Preview */}
      {branding?.galleryImages && branding.galleryImages.length > 0 && (
        <section className="py-20 bg-white border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-xl mx-auto mb-12">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-600">
                Visual Ambiance
              </span>
              <h2 className="text-3xl font-display font-bold text-slate-900 mt-1">
                Inside {restaurant.name}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {branding.galleryImages.slice(0, 3).map((img, i) => (
                <div key={i} className="h-64 rounded-2xl overflow-hidden shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Opening Hours & Directions Overview */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-brand-600" />
              <h3 className="font-display font-bold text-lg text-slate-900">
                Opening Hours
              </h3>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              {config?.openingHours?.map((slot, i) => (
                <div
                  key={i}
                  className="flex justify-between py-1.5 border-b border-slate-100 last:border-0"
                >
                  <span className="font-semibold text-slate-800">{slot.days}</span>
                  <span>
                    {slot.open} - {slot.close}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-brand-600" />
              <h3 className="font-display font-bold text-lg text-slate-900">
                Location & Reservations
              </h3>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <p>
                <strong>Address:</strong> {config?.address || restaurant.address},{" "}
                {config?.city || restaurant.city}
              </p>
              <p>
                <strong>Phone:</strong> {config?.contactPhone || restaurant.phone}
              </p>
              <p>
                <strong>Email:</strong> {config?.contactEmail || restaurant.ownerEmail}
              </p>
            </div>
            <div className="pt-2 flex items-center space-x-3">
              <Link href={`/${restaurant.slug}/about`}>
                <Button variant="outline" size="sm" className="text-xs">
                  Full Details & Directions
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
