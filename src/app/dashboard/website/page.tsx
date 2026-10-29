"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Globe,
  Palette,
  Eye,
  Save,
  CheckCircle2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RestaurantProfile } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

export default function RestaurantWebsiteCustomizerPage() {
  const { user } = useAuth();
  const currentRestaurantId = user?.restaurantId || "";
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [primaryColor, setPrimaryColor] = useState("#ea580c");
  const [fontPreset, setFontPreset] = useState<"outfit" | "inter" | "playfair" | "montserrat">("outfit");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [address, setAddress] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");

  const [sections, setSections] = useState({
    hero: true,
    about: true,
    menu: true,
    gallery: true,
    hours: true,
    contact: true,
    amenities: true,
  });

  useEffect(() => {
    async function load() {
      if (!currentRestaurantId) {
        setRestaurant(null);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`/api/restaurants/${currentRestaurantId}`);
        const data = await res.json();
        const r: RestaurantProfile = data.restaurant;
        if (r) {
          setRestaurant(r);
          setPrimaryColor(r.branding?.primaryColor || "#ea580c");
          setFontPreset(r.branding?.fontPreset || "outfit");
          setHeroTitle(r.websiteConfig?.heroTitle || "");
          setHeroSubtitle(r.websiteConfig?.heroSubtitle || "");
          setAboutText(r.websiteConfig?.aboutText || "");
          setContactPhone(r.websiteConfig?.contactPhone || "");
          setContactEmail(r.websiteConfig?.contactEmail || "");
          setAddress(r.websiteConfig?.address || "");
          setCoverImageUrl(r.branding?.coverImageUrl || "");
          if (r.websiteConfig?.sectionsVisibility) {
            setSections(r.websiteConfig.sectionsVisibility);
          }
        }
      } catch {
        toast.error("Failed to load restaurant profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentRestaurantId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRestaurantId) {
      toast.error("No restaurant linked to this account.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/restaurants/${currentRestaurantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branding: {
            ...restaurant?.branding,
            primaryColor,
            fontPreset,
            coverImageUrl,
          },
          websiteConfig: {
            ...restaurant?.websiteConfig,
            heroTitle,
            heroSubtitle,
            aboutText,
            contactPhone,
            contactEmail,
            address,
            sectionsVisibility: sections,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Website configuration published successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update website");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            Brand Identity
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            Restaurant Website Customizer
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Personalize your public subpath page ({process.env.NEXT_PUBLIC_APP_URL || "https://restrocharge.vivexatech.in"}/{restaurant?.slug || "your-restaurant"})
          </p>
        </div>

        <Link href={`/${restaurant?.slug || "vivexa-restro"}`} target="_blank">
          <Button variant="outline" size="sm" className="font-semibold">
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Live Preview
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Visual branding */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-5">
            <h3 className="font-bold text-base text-slate-900 font-display flex items-center">
              <Palette className="h-4 w-4 mr-2 text-brand-600" />
              Theme Colors & Typography
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Accent Color (Hex)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-12 rounded-lg cursor-pointer border border-slate-300"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="font-mono text-xs uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Font Family Preset
                </label>
                <select
                  value={fontPreset}
                  onChange={(e) => setFontPreset(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="outfit">Outfit (Modern Clean)</option>
                  <option value="inter">Inter (Neutral Precision)</option>
                  <option value="playfair">Playfair Display (Elegant Serif)</option>
                  <option value="montserrat">Montserrat (Bold Contemporary)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hero Cover Image URL
              </label>
              <Input
                placeholder="https://images.unsplash.com/..."
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-4">
            <h3 className="font-bold text-base text-slate-900 font-display">
              Hero Section Content
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Headline / Hero Title
              </label>
              <Input
                placeholder="e.g. Royal Flavors, Timeless Traditions"
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supporting Subtitle
              </label>
              <Input
                placeholder="e.g. Authentic slow-cooked Awadhi dum biryanis..."
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Our Story / About Us Text
              </label>
              <textarea
                rows={3}
                placeholder="Founded with generational recipes..."
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={aboutText}
                onChange={(e) => setAboutText(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-4">
            <h3 className="font-bold text-base text-slate-900 font-display">
              Contact & Location Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Public Phone for Inquiries
                </label>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Public Email
                </label>
                <Input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Physical Address
              </label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section visibility & Publish */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-4">
            <h3 className="font-bold text-base text-slate-900 font-display">
              Section Visibility
            </h3>

            <div className="space-y-2.5">
              {Object.keys(sections).map((key) => {
                const isChecked = (sections as any)[key];

                return (
                  <label
                    key={key}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    <span className="capitalize font-semibold text-slate-700">
                      {key} Section
                    </span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) =>
                        setSections({ ...sections, [key]: e.target.checked })
                      }
                      className="h-4 w-4 text-brand-600 rounded"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-elevated space-y-4">
            <h4 className="font-bold text-sm font-display">
              Publish Website Updates
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Saved updates take effect immediately on your branded restaurant URL.
            </p>
            <Button
              type="submit"
              isLoading={isSaving}
              className="w-full font-bold shadow-md"
            >
              <Save className="h-4 w-4 mr-1.5" />
              Publish Live Changes
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
