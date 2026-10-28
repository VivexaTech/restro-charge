// ==============================================================================
// RESTROCHARGE - QR Code Generation Service (Vivexa Tech Exclusive)
// Stable URLs, high-res generation, and printable layouts.
// ==============================================================================

import QRCode from "qrcode";

export interface QRCodeData {
  targetUrl: string;
  dataUrl: string; // PNG base64 data url
  svgString: string;
  restaurantSlug: string;
  tableCode: string;
}

/**
 * Builds the canonical stable URL for customer QR ordering.
 */
export function buildTableOrderUrl(
  restaurantSlug: string,
  tableCode: string,
  baseUrl?: string
): string {
  const host = baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://restrocharge.vivexatech.in";
  // Clean trailing slash
  const cleanHost = host.replace(/\/+$/, "");
  return `${cleanHost}/order/${restaurantSlug}/${tableCode}`;
}

/**
 * Generates high-resolution QR code data URLs for print and display.
 * Strict permission: ONLY authorized Vivexa Tech team may generate/issue QR codes!
 */
export async function generateTableQRCode(
  restaurantSlug: string,
  tableCode: string,
  baseUrl?: string
): Promise<QRCodeData> {
  const targetUrl = buildTableOrderUrl(restaurantSlug, tableCode, baseUrl);

  // Generate crisp high-resolution PNG
  const dataUrl = await QRCode.toDataURL(targetUrl, {
    width: 512,
    margin: 2,
    color: {
      dark: "#0f172a", // Slate 900
      light: "#ffffff",
    },
    errorCorrectionLevel: "H", // High error correction for restaurant table durability
  });

  // Also generate vector SVG string
  const svgString = await QRCode.toString(targetUrl, {
    type: "svg",
    margin: 2,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });

  return {
    targetUrl,
    dataUrl,
    svgString,
    restaurantSlug,
    tableCode,
  };
}
