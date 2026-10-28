import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { CartProvider } from "@/context/cart-context";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  applicationName: "RestroCharge",
  title: "RestroCharge | Smart Restaurant Management Platform",
  description:
    "Manage restaurant websites, QR-based table ordering, menus, orders, subscriptions, and restaurant operations with RestroCharge.",
  keywords: [
    "RestroCharge",
    "Restaurant Management System",
    "QR Table Ordering",
    "Digital Menu",
    "Kitchen Display System",
    "Restaurant SaaS",
    "Vivexa Tech",
  ],
  authors: [{ name: "Vivexa Tech", url: "https://vivexatech.in" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen flex flex-col font-sans">
        <AuthProvider>
          <CartProvider>
            {children}
            <Toaster position="top-right" richColors />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
