// ==============================================================================
// RESTROCHARGE - Dedicated Tenant Restaurant XML Sitemap
// Independently crawlable sitemap for every individual restaurant website.
// Includes only public indexable pages (Home, Menu, About).
// Excludes private tables, QR ordering links, and admin routes.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";
import { getSubscriptionAccess } from "@/lib/services/subscription";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const host = req.headers.get("host") || "restrocharge.vivexatech.in";
  const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  const rawSlug = params.slug || "";
  const cleanSlug = rawSlug.replace(/\.xml$/i, "").toLowerCase().trim();

  let restaurant = dataStore.getRestaurantBySlug(cleanSlug);
  if (!restaurant) {
    restaurant = await firestoreService.getRestaurantBySlug(cleanSlug);
    if (restaurant) dataStore.saveRestaurantLocally(restaurant);
  }
  if (!restaurant || !restaurant.published) {
    return new NextResponse("Restaurant not found or website not published.", { status: 404 });
  }

  const subAccess = getSubscriptionAccess(restaurant.subscription);
  if (!subAccess.canViewSite) {
    return new NextResponse("Restaurant website is offline.", { status: 403 });
  }

  const lastMod = restaurant.updatedAt
    ? new Date(restaurant.updatedAt).toISOString()
    : new Date().toISOString();

  const restaurantPages = [
    { path: `/${restaurant.slug}`, changefreq: "weekly", priority: "0.9" },
    { path: `/${restaurant.slug}/menu`, changefreq: "weekly", priority: "0.8" },
    { path: `/${restaurant.slug}/about`, changefreq: "monthly", priority: "0.7" },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const page of restaurantPages) {
    xml += `  <url>\n`;
    xml += `    <loc>${origin}${page.path}</loc>\n`;
    xml += `    <lastmod>${lastMod}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
