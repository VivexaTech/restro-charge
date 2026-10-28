"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RestaurantProfile } from "@/lib/types";
import { toast } from "sonner";

export default function SuperAdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<RestaurantProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  // Location & Security Modal State
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
      const res = await fetch(`/api/restaurants/${selectedRest.id}/location`, {
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
      if (!res.ok) throw new Error(data.error || "Failed to save location");

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

  const handleTogglePublish = async (id: string, currentPublished: boolean) => {
    try {
      const res = await fetch(`/api/restaurants/${id}`, {
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

      const res = await fetch(`/api/restaurants/${id}`, {
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
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
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

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search venue or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
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
                      <span className="text-slate-400 text-[11px]">{r.ownerEmail}</span>
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
    </div>
  );
}
