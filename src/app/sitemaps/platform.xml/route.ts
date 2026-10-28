// ==============================================================================
// RESTROCHARGE - Platform Public Pages Sitemap
// Canonical platform landing, pricing, and restaurant directory pages
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "restrocharge.vivexatech.in";
  const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  const nowIso = new Date().toISOString();

  const platformPages = [
    { path: "", changefreq: "daily", priority: "1.0" },
    { path: "/pricing", changefreq: "weekly", priority: "0.8" },
    { path: "/restaurants", changefreq: "daily", priority: "0.8" },
    { path: "/restaurants/request", changefreq: "monthly", priority: "0.7" },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const p of platformPages) {
    xml += `  <url>\n`;
    xml += `    <loc>${origin}${p.path}</loc>\n`;
    xml += `    <lastmod>${nowIso}</lastmod>\n`;
    xml += `    <changefreq>${p.changefreq}</changefreq>\n`;
    xml += `    <priority>${p.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
