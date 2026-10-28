// ==============================================================================
// RESTROCHARGE - Search Engine Robots Configuration
// Dynamically directs crawlers to sitemap index and disallows private routes
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "restrocharge.vivexatech.in";
  const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  const robots = `# RestroCharge Search Engine Directive
User-agent: *
Allow: /
Allow: /pricing
Allow: /restaurants
Allow: /restaurants/request
Allow: /*/menu
Allow: /*/about

# Disallow private dashboards, staff terminals, table QR ordering, and API endpoints
Disallow: /super-admin/
Disallow: /dashboard/
Disallow: /staff/
Disallow: /order/
Disallow: /api/
Disallow: /login
Disallow: /forgot-password

# Canonical Sitemap Index
Sitemap: ${origin}/sitemap.xml
`;

  return new NextResponse(robots, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
