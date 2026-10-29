"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Store,
  ExternalLink,
  ShieldAlert,
  Power,
  Edit3,
  Eye,
  CheckCircle2,
  XCircle,
  Search,
  MapPin,
  Compass,
  Navigation,
  AlertTriangle,
  X,
  Save,
  ShieldCheck,
  Plus,
  Upload,
  Loader2,
  Calendar,
  Globe,
  QrCode,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { RestaurantProfile } from "@/lib/types";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth/client-auth";

export default function SuperAdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<RestaurantProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  // Add Restaurant Modal State
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [isSubmittingRest, setIsSubmittingRest] = useState<boolean>(false);
  const [provisioningRestId, setProvisioningRestId] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState<boolean>(false);
  const slugCheckTimer = useRef<NodeJS.Timeout | null>(null);

  // Add Restaurant Form Fields
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    adminEmail: "",
    contactNumber: "",
    status: "ACTIVE",
    planId: "plan_starter",
    description: "",
    logoUrl: "",
    coverImageUrl: "",
    address: "",
    city: "Jaipur",
    state: "Rajasthan",
    postalCode: "302001",
    country: "India",
    email: "",
    websiteUrl: "",
    openingHours: "11:00 AM - 11:00 PM",
    instagram: "",
    facebook: "",
    twitter: "",
    latitude: "",
    longitude: "",
    orderingRadiusMetres: 200,
    locationRestrictionEnabled: false,
    subscriptionStatus: "ACTIVE",
    trialDurationDays: 14,
    published: true,
    qrOrderingEnabled: true,
  });

  // Location & Security Modal State (Existing)
  const [locModalOpen, setLocModalOpen] = useState<boolean>(false);
  const [selectedRest, setSelectedRest] = useState<RestaurantProfile | null>(null);
  const [locEnabled, setLocEnabled] = useState<boolean>(false);
  const [locLat, setLocLat] = useState<string>("");
  const [locLon, setLocLon] = useState<string>("");
  const [locRadius, setLocRadius] = useState<number>(100);
  const [locAddress, setLocAddress] = useState<string>("");
  const [isSavingLoc, setIsSavingLoc] = useState<boolean>(false);

  const openLocationModal = (r: RestaurantProfile) => {
    setSelectedRest(r);
    const s = r.locationSettings;
    setLocEnabled(s?.locationRestrictionEnabled ?? false);
    setLocLat(s?.latitude !== null && s?.latitude !== undefined ? s.latitude.toString() : "");
    setLocLon(s?.longitude !== null && s?.longitude !== undefined ? s.longitude.toString() : "");
    setLocRadius(s?.orderingRadiusMetres ?? 100);
    setLocAddress(s?.addressSnapshot || `${r.address}, ${r.city}`);
    setLocModalOpen(true);
  };

  const handleDetectBrowserLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    toast.info("Acquiring current GPS coordinates...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocLat(pos.coords.latitude.toFixed(6));
        setLocLon(pos.coords.longitude.toFixed(6));
        toast.success("Coordinates updated from browser GPS!");
      },
      (err) => {
        toast.error(`GPS Error: ${err.message}`);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSaveLocation = async () => {
    if (!selectedRest) return;

    const radius = Number(locRadius);
    if (isNaN(radius) || radius < 10 || radius > 50000) {
      toast.error("Ordering radius must be between 10 and 50,000 metres.");
      return;
    }

    let parsedLat: number | null = null;
    let parsedLon: number | null = null;

    if (locLat.trim() && locLon.trim()) {
      parsedLat = parseFloat(locLat.trim());
      parsedLon = parseFloat(locLon.trim());
      if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        toast.error("Latitude must be between -90 and 90.");
        return;
      }
      if (isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180) {
        toast.error("Longitude must be between -180 and 180.");
        return;
      }
    } else if (locEnabled) {
      toast.error("Latitude and Longitude are required when location restriction is enabled.");
      return;
    }

    setIsSavingLoc(true);
    try {
      const res = await authFetch(`/api/restaurants/${selectedRest.id}/location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: parsedLat,
          longitude: parsedLon,
          orderingRadiusMetres: radius,
          locationRestrictionEnabled: locEnabled,
          addressSnapshot: locAddress.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || "Failed to save location");

      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === selectedRest.id ? { ...r, locationSettings: data.locationSettings } : r
        )
      );

      toast.success("Location & Ordering Security settings updated!");
      setLocModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update location settings");
    } finally {
      setIsSavingLoc(false);
    }
  };

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/restaurants");
      const data = await res.json();
      setRestaurants(data.restaurants || []);
    } catch {
      toast.error("Failed to load restaurants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRestaurants();
  }, []);

  // Slug auto-generation & uniqueness check
  const handleNameChange = (val: string) => {
    setFormData((prev) => {
      const next = { ...prev, name: val };
      if (!slugManuallyEdited) {
        const autoSlug = val
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
        next.slug = autoSlug;
        triggerSlugCheck(autoSlug);
      }
      return next;
    });
  };

  const handleSlugChange = (val: string) => {
    setSlugManuallyEdited(true);
    const clean = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");
    setFormData((prev) => ({ ...prev, slug: clean }));
    triggerSlugCheck(clean);
  };

  const triggerSlugCheck = (slugToCheck: string) => {
    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
    if (!slugToCheck || slugToCheck.length < 2) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    slugCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/restaurants/check-slug?slug=${encodeURIComponent(slugToCheck)}`);
        const data = await res.json();
        if (data.available) {
          setSlugStatus("available");
        } else {
          setSlugStatus("taken");
        }
      } catch {
        setSlugStatus("idle");
      }
    }, 400);
  };

  const handleFileUpload = async (file: File, field: "logoUrl" | "coverImageUrl") => {
    const uploadToast = toast.loading("Uploading image to Cloudinary...");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("folder", "restaurants");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Upload failed");

      setFormData((prev) => ({ ...prev, [field]: result.url }));
      toast.success("Image uploaded successfully!", { id: uploadToast });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image", { id: uploadToast });
    }
  };

  const resetAddForm = () => {
    setFormData({
      name: "",
      slug: "",
      adminEmail: "",
      contactNumber: "",
      status: "ACTIVE",
      planId: "plan_starter",
      description: "",
      logoUrl: "",
      coverImageUrl: "",
      address: "",
      city: "Jaipur",
      state: "Rajasthan",
      postalCode: "302001",
      country: "India",
      email: "",
      websiteUrl: "",
      openingHours: "11:00 AM - 11:00 PM",
      instagram: "",
      facebook: "",
      twitter: "",
      latitude: "",
      longitude: "",
      orderingRadiusMetres: 200,
      locationRestrictionEnabled: false,
      subscriptionStatus: "ACTIVE",
      trialDurationDays: 14,
      published: true,
      qrOrderingEnabled: true,
    });
    setSlugManuallyEdited(false);
    setSlugStatus("idle");
  };

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();

    // Required Field Validations
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      toast.error("Please enter a valid Restaurant Name (min 2 characters).");
      return;
    }
    if (!formData.slug.trim() || formData.slug.trim().length < 2) {
      toast.error("Please enter a valid Restaurant Slug.");
      return;
    }
    if (slugStatus === "taken") {
      toast.error("The specified slug is already taken. Please choose a unique slug.");
      return;
    }
    if (!formData.adminEmail.trim() || !/^\S+@\S+\.\S+$/.test(formData.adminEmail)) {
      toast.error("Please enter a valid Restaurant Admin Email.");
      return;
    }
    if (!formData.contactNumber.trim() || formData.contactNumber.trim().length < 7) {
      toast.error("Please enter a valid Contact Number (min 7 digits).");
      return;
    }

    // Latitude / Longitude bounds
    if (formData.latitude.trim()) {
      const lat = parseFloat(formData.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        toast.error("Latitude must be between -90 and 90 degrees.");
        return;
      }
    }
    if (formData.longitude.trim()) {
      const lon = parseFloat(formData.longitude);
      if (isNaN(lon) || lon < -180 || lon > 180) {
        toast.error("Longitude must be between -180 and 180 degrees.");
        return;
      }
    }

    setIsSubmittingRest(true);
    const saveToast = toast.loading("Creating restaurant in Firestore...");

    try {
      const res = await authFetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create restaurant");

      if (data.adminProvisioning?.status === "PROVISIONED") {
        toast.success(
          `Restaurant "${data.restaurant.name}" created and Admin account provisioned for ${data.restaurant.ownerEmail}!`,
          { id: saveToast, duration: 5000 }
        );
      } else {
        toast.warning(
          `Restaurant "${data.restaurant.name}" created! Admin provisioning is ${data.adminProvisioning?.status || "PENDING"}: ${data.adminProvisioning?.message || "Pending configuration"}. You can retry provisioning anytime.`,
          { id: saveToast, duration: 7000 }
        );
      }

      setAddModalOpen(false);
      resetAddForm();
      await loadRestaurants();
    } catch (err: any) {
      toast.error(err.message || "Failed to create restaurant", { id: saveToast });
    } finally {
      setIsSubmittingRest(false);
    }
  };

  const handleProvisionAdmin = async (r: RestaurantProfile) => {
    setProvisioningRestId(r.id);
    const pToast = toast.loading(`Provisioning Restaurant Admin account for ${r.ownerEmail}...`);
    try {
      const res = await authFetch(`/api/restaurants/${r.id}/provision-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail: r.ownerEmail, adminName: r.ownerName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Admin provisioning failed");
      }
      toast.success(data.adminProvisioning?.message || `Admin account provisioned for ${r.ownerEmail}!`, {
        id: pToast,
        duration: 5000,
      });
      await loadRestaurants();
    } catch (err: any) {
      toast.error(`Admin Provisioning Error: ${err.message}`, { id: pToast, duration: 7000 });
      await loadRestaurants();
    } finally {
      setProvisioningRestId(null);
    }
  };

  const handleTogglePublish = async (id: string, currentPublished: boolean) => {
    try {
      const res = await authFetch(`/api/restaurants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !currentPublished }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setRestaurants((prev) =>
        prev.map((r) => (r.id === id ? { ...r, published: !currentPublished } : r))
      );
      toast.success(`Restaurant ${!currentPublished ? "Published" : "Unpublished"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update publish state");
    }
  };

  const handleToggleOrders = async (id: string, currentAccepting: boolean) => {
    try {
      const target = restaurants.find((r) => r.id === id);
      if (!target) return;

      const res = await authFetch(`/api/restaurants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationalSettings: {
            ...target.operationalSettings,
            isAcceptingOrders: !currentAccepting,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                operationalSettings: {
                  ...r.operationalSettings,
                  isAcceptingOrders: !currentAccepting,
                },
              }
            : r
        )
      );
      toast.success(`Ordering ${!currentAccepting ? "Enabled" : "Paused"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update ordering state");
    }
  };

  const filtered = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.slug.toLowerCase().includes(search.toLowerCase()) ||
      r.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 overflow-x-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            Tenancy Fleet
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            Restaurant Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage provisioned restaurants, publication status, and operational ordering switches.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search venue or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
          <Button
            onClick={() => setAddModalOpen(true)}
            size="sm"
            className="font-semibold shadow-sm shrink-0 whitespace-nowrap bg-brand-600 hover:bg-brand-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Restaurant
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Restaurant</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Owner Contact</th>
                <th className="py-3 px-4">Plan & Status</th>
                <th className="py-3 px-4">Website Published</th>
                <th className="py-3 px-4">Accepting Orders</th>
                <th className="py-3 px-4">Ordering Geo-Fence</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const loc = r.locationSettings;
                const isGeoEnforced = loc?.locationRestrictionEnabled && loc?.isConfigured;
                const isGeoPending = loc?.locationRestrictionEnabled && !loc?.isConfigured;

                return (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2.5">
                        {r.branding.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.branding.logoUrl}
                            alt=""
                            className="h-8 w-8 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-brand-500 text-white font-bold flex items-center justify-center shrink-0">
                            {r.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-slate-900 block">{r.name}</span>
                            {r.isDemo && (
                              <span className="bg-brand-100 text-brand-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                Official Demo
                              </span>
                            )}
                          </div>
                          <span className="text-slate-400 font-mono text-[10px]">/{r.slug}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      {r.city}, {r.state}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="font-medium text-slate-800 block">{r.ownerName}</span>
                      <span className="text-slate-400 text-[11px] block">{r.ownerEmail}</span>
                      <div className="mt-1 flex items-center space-x-1.5 flex-wrap gap-y-1">
                        {r.adminProvisioningStatus === "PROVISIONED" ? (
                          <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <ShieldCheck className="h-3 w-3 mr-1 text-emerald-600" />
                            Admin Provisioned
                          </span>
                        ) : r.adminProvisioningStatus === "FAILED" ? (
                          <div className="flex items-center space-x-1.5">
                            <span
                              className="inline-flex items-center text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                              title={r.adminProvisioningError || "Provisioning failed"}
                            >
                              <ShieldAlert className="h-3 w-3 mr-1 text-rose-600" />
                              Auth Failed
                            </span>
                            <button
                              onClick={() => handleProvisionAdmin(r)}
                              disabled={provisioningRestId === r.id}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 underline disabled:opacity-50"
                              title="Retry provisioning Restaurant Admin account"
                            >
                              {provisioningRestId === r.id ? "Retrying..." : "Retry"}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5">
                            <span className="inline-flex items-center text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Admin Pending
                            </span>
                            <button
                              onClick={() => handleProvisionAdmin(r)}
                              disabled={provisioningRestId === r.id}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 underline disabled:opacity-50"
                              title="Provision Restaurant Admin account now"
                            >
                              {provisioningRestId === r.id ? "Provisioning..." : "Provision"}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">
                        {r.subscription?.planName}
                      </span>
                      <Badge
                        variant={
                          r.subscription?.status === "ACTIVE"
                            ? "success"
                            : r.subscription?.status === "GRACE_PERIOD"
                            ? "warning"
                            : "danger"
                        }
                        className="mt-1"
                      >
                        {r.subscription?.status}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleTogglePublish(r.id, r.published)}
                        className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold border transition ${
                          r.published
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-300"
                        }`}
                      >
                        {r.published ? "Published" : "Draft"}
                      </button>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() =>
                          handleToggleOrders(
                            r.id,
                            r.operationalSettings?.isAcceptingOrders ?? true
                          )
                        }
                        className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold border transition ${
                          r.operationalSettings?.isAcceptingOrders
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {r.operationalSettings?.isAcceptingOrders ? "Online" : "Paused"}
                      </button>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => openLocationModal(r)}
                        className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold border transition ${
                          isGeoEnforced
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : isGeoPending
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        {isGeoEnforced
                          ? `Enforced (${loc?.orderingRadiusMetres}m)`
                          : isGeoPending
                          ? "Pending Coords"
                          : "Disabled"}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openLocationModal(r)}
                        className="h-7 text-xs border-brand-200 text-brand-700 hover:bg-brand-50"
                        title="Configure Location & Ordering Radius"
                      >
                        <MapPin className="h-3.5 w-3.5 mr-1" />
                        Geo-Fence
                      </Button>
                      <Link href={`/${r.slug}`} target="_blank">
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Site
                        </Button>
                      </Link>
                      <Link href={`/dashboard?restaurantId=${r.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          Admin
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Location & Ordering Security Modal */}
      {locModalOpen && selectedRest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-brand-500 rounded-xl text-white">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base">
                    Location & Ordering Security
                  </h3>
                  <p className="text-xs text-slate-300">
                    Vivexa Tech Super Admin • {selectedRest.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setLocModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Status Banner */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border bg-slate-50">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="h-5 w-5 text-brand-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Location Restriction Status
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Customers must be physically inside this radius to place QR orders.
                    </span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={locEnabled}
                    onChange={(e) => setLocEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Coordinates Inputs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Authorized Restaurant Coordinates
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDetectBrowserLocation}
                    className="h-7 text-xs border-brand-300 text-brand-700 hover:bg-brand-50"
                  >
                    <Navigation className="h-3 w-3 mr-1" />
                    Detect My GPS
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 mb-1 block">
                      Latitude (-90 to +90)
                    </label>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="e.g. 26.912400"
                      value={locLat}
                      onChange={(e) => setLocLat(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-500 mb-1 block">
                      Longitude (-180 to +180)
                    </label>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="e.g. 75.787300"
                      value={locLon}
                      onChange={(e) => setLocLon(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 mb-1 block">
                    Venue Physical Address Snapshot
                  </label>
                  <Input
                    type="text"
                    placeholder="Physical address on file"
                    value={locAddress}
                    onChange={(e) => setLocAddress(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Ordering Radius */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Permitted Ordering Radius (Metres)
                </label>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-2">
                  {[50, 100, 200, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLocRadius(preset)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        locRadius === preset
                          ? "bg-brand-500 text-white border-brand-500"
                          : "bg-white text-slate-700 border-slate-200 hover:border-brand-300"
                      }`}
                    >
                      {preset} metres
                    </button>
                  ))}
                </div>

                <div className="pt-1 flex items-center space-x-2">
                  <Input
                    type="number"
                    min="10"
                    max="50000"
                    value={locRadius}
                    onChange={(e) => setLocRadius(Number(e.target.value))}
                    className="text-xs w-36 font-semibold"
                  />
                  <span className="text-xs text-slate-500">metres boundary</span>
                </div>
              </div>

              {/* Interactive Map Preview */}
              {locLat && locLon && !isNaN(parseFloat(locLat)) && !isNaN(parseFloat(locLon)) ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold flex items-center">
                      <Compass className="h-3.5 w-3.5 mr-1 text-brand-600" />
                      Map Position & Coverage Preview
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${locLat},${locLon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline flex items-center text-[11px]"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open in Google Maps
                    </a>
                  </div>

                  <div className="h-48 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative">
                    <iframe
                      title="OpenStreetMap Preview"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      marginHeight={0}
                      marginWidth={0}
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                        parseFloat(locLon) - 0.005
                      }%2C${parseFloat(locLat) - 0.005}%2C${
                        parseFloat(locLon) + 0.005
                      }%2C${parseFloat(locLat) + 0.005}&layer=mapnik&marker=${locLat}%2C${locLon}`}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-400">
                  Enter valid Latitude and Longitude to view the live geographic map preview.
                </div>
              )}

              {/* Audit Metadata */}
              {selectedRest.locationSettings?.updatedAt && (
                <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span>
                    Last updated:{" "}
                    {new Date(selectedRest.locationSettings.updatedAt).toLocaleString("en-IN")}
                  </span>
                  <span>By: {selectedRest.locationSettings.updatedByName || "Vivexa Tech Team"}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveLocation}
                isLoading={isSavingLoc}
                className="text-xs font-semibold"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save & Enforce Location
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ADD RESTAURANT MODAL (ISSUE 2 RESOLUTION)                            */}
      {/* ==================================================================== */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => !isSubmittingRest && setAddModalOpen(false)}
        title="Provision New Restaurant"
        description="Add a new tenant restaurant to RestroCharge with custom branding, geo-fenced ordering, and subscription setup."
        maxWidth="3xl"
      >
        <form onSubmit={handleCreateRestaurant} className="space-y-6 pt-2">
          {/* SECTION 1: REQUIRED BASIC INFO */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 pb-1 border-b border-slate-200">
              <Store className="h-4 w-4 text-brand-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                1. Required Information
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Restaurant Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. Royal Spice Bistro"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Restaurant Slug <span className="text-rose-500">*</span>
                  </label>
                  {slugStatus === "checking" && (
                    <span className="text-[10px] text-slate-400 flex items-center">
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Checking...
                    </span>
                  )}
                  {slugStatus === "available" && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center">
                      <CheckCircle2 className="h-3 w-3 mr-0.5" />
                      Available
                    </span>
                  )}
                  {slugStatus === "taken" && (
                    <span className="text-[10px] text-rose-600 font-bold flex items-center">
                      <AlertTriangle className="h-3 w-3 mr-0.5" />
                      Slug in use
                    </span>
                  )}
                </div>
                <Input
                  required
                  placeholder="e.g. royal-spice"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className={`text-xs font-mono ${
                    slugStatus === "taken"
                      ? "border-rose-400 focus:border-rose-500"
                      : slugStatus === "available"
                      ? "border-emerald-400 focus:border-emerald-500"
                      : ""
                  }`}
                />
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                  URL: restrocharge.vivexatech.in/{formData.slug || "your-slug"}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Restaurant Admin Email <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="email"
                  required
                  placeholder="owner@restaurant.com"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  className="text-xs"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Receives portal access and admin notifications.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Primary Contact Phone <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={formData.contactNumber}
                  onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Restaurant Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="ACTIVE">Active (Live)</option>
                  <option value="PENDING">Pending Setup</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Subscription Tier <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.planId}
                  onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                  className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="plan_starter">Starter Plan (₹1,499/mo)</option>
                  <option value="plan_pro">Growth Plan (₹2,999/mo)</option>
                  <option value="plan_enterprise">Enterprise Plan (₹5,999/mo)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: LOCATION & ORDERING GEO-FENCE */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2. Location & Geo-Fenced Ordering
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!navigator.geolocation) {
                    toast.error("Geolocation not supported by browser.");
                    return;
                  }
                  toast.info("Acquiring GPS coordinates...");
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setFormData((prev) => ({
                        ...prev,
                        latitude: pos.coords.latitude.toFixed(6),
                        longitude: pos.coords.longitude.toFixed(6),
                      }));
                      toast.success("Coordinates acquired from device GPS!");
                    },
                    (err) => toast.error(`GPS Error: ${err.message}`),
                    { enableHighAccuracy: true }
                  );
                }}
                className="h-7 text-[11px] text-slate-600"
              >
                <Navigation className="h-3 w-3 mr-1 text-emerald-600" />
                Detect Device GPS
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Latitude</label>
                <Input
                  type="text"
                  placeholder="26.8524"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Longitude</label>
                <Input
                  type="text"
                  placeholder="75.8052"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Ordering Radius (m)</label>
                <Input
                  type="number"
                  min="10"
                  max="50000"
                  value={formData.orderingRadiusMetres}
                  onChange={(e) => setFormData({ ...formData, orderingRadiusMetres: Number(e.target.value) })}
                  className="text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <input
                type="checkbox"
                id="addLocRestricted"
                checked={formData.locationRestrictionEnabled}
                onChange={(e) => setFormData({ ...formData, locationRestrictionEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="addLocRestricted" className="text-xs font-medium text-slate-700 cursor-pointer">
                <strong>Enforce Location-Restricted QR Ordering:</strong> Customers can only order when physically seated within {formData.orderingRadiusMetres}m of these coordinates.
              </label>
            </div>
          </div>

          {/* SECTION 3: PROFILE, ADDRESS & BRANDING */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2 pb-1 border-b border-slate-200">
              <Globe className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                3. Profile, Address & Branding
              </span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Brief narrative of the restaurant and cuisine specialty..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Full Street Address</label>
                <Input
                  placeholder="e.g. 102 M.I. Road, Near Panch Batti"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">City</label>
                <Input
                  placeholder="Jaipur"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">State</label>
                <Input
                  placeholder="Rajasthan"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Postal Code</label>
                <Input
                  placeholder="302001"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Country</label>
                <Input
                  placeholder="India"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Opening Hours</label>
                <Input
                  placeholder="11:00 AM - 11:00 PM"
                  value={formData.openingHours}
                  onChange={(e) => setFormData({ ...formData, openingHours: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Media Uploads */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">Restaurant Logo</span>
                <Input
                  placeholder="Logo URL or upload file"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  className="text-xs"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "logoUrl")}
                  className="text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">Cover / Hero Image</span>
                <Input
                  placeholder="Cover image URL or upload file"
                  value={formData.coverImageUrl}
                  onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
                  className="text-xs"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "coverImageUrl")}
                  className="text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: SUBSCRIPTION, TRIAL & OPERATIONAL SETTINGS */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2 pb-1 border-b border-slate-200">
              <Calendar className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                4. Subscription & Operational Switches
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Subscription Mode</label>
                <select
                  value={formData.subscriptionStatus}
                  onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value })}
                  className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="ACTIVE">Regular Active (30-day initial billing)</option>
                  <option value="TRIAL">Free Trial Period</option>
                </select>
              </div>

              {formData.subscriptionStatus === "TRIAL" && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Trial Duration (Days)</label>
                  <select
                    value={formData.trialDurationDays}
                    onChange={(e) => setFormData({ ...formData, trialDurationDays: Number(e.target.value) })}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="7">7 Days Trial</option>
                    <option value="14">14 Days Trial (Standard)</option>
                    <option value="30">30 Days Extended Trial</option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center space-x-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.published}
                  onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Enable Public Website ({formData.slug ? `/${formData.slug}` : "tenant site"})
                </span>
              </label>

              <label className="flex items-center space-x-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.qrOrderingEnabled}
                  onChange={(e) => setFormData({ ...formData, qrOrderingEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Accept Table QR Orders (Kitchen Queue Active)
                </span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingRest}
              onClick={() => setAddModalOpen(false)}
              className="w-full sm:w-auto text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmittingRest}
              disabled={isSubmittingRest || slugStatus === "taken"}
              className="w-full sm:w-auto text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create Restaurant & Provision Tenant
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
