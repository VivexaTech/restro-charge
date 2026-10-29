// ==============================================================================
// RESTROCHARGE - Platform Sitemap Index
// Dynamic XML sitemap index referencing platform pages and tenant sitemaps
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { dataStore } from "@/lib/services/data-store";
import { firestoreService } from "@/lib/services/firestore-service";
import { getSubscriptionAccess } from "@/lib/services/subscription";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "restrocharge.vivexatech.in";
  const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  let allR = await firestoreService.getRestaurants();
  if (!allR || allR.length === 0) {
    allR = dataStore.getRestaurants();
  }
  const restaurants = allR.filter((r) => {
    return r.published && getSubscriptionAccess(r.subscription).canViewSite;
  });

  const nowIso = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // 1. Platform pages sitemap
  xml += `  <sitemap>\n`;
  xml += `    <loc>${origin}/sitemaps/platform.xml</loc>\n`;
  xml += `    <lastmod>${nowIso}</lastmod>\n`;
  xml += `  </sitemap>\n`;

  // 2. Individual Restaurant Website Sitemaps
  for (const r of restaurants) {
    const lastMod = r.updatedAt ? new Date(r.updatedAt).toISOString() : nowIso;
    xml += `  <sitemap>\n`;
    xml += `    <loc>${origin}/sitemaps/restaurants/${r.slug}.xml</loc>\n`;
    xml += `    <lastmod>${lastMod}</lastmod>\n`;
    xml += `  </sitemap>\n`;
  }

  xml += `</sitemapindex>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
