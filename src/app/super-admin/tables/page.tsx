"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  QrCode,
  Plus,
  Printer,
  Download,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { RestaurantProfile, TableItem } from "@/lib/types";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth/client-auth";

export default function SuperAdminTablesAndQRPage() {
  const [restaurants, setRestaurants] = useState<RestaurantProfile[]>([]);
  const [selectedRestId, setSelectedRestId] = useState<string>("");
  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreatingTable, setIsCreatingTable] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [printSheetOpen, setPrintSheetOpen] = useState<boolean>(false);

  // New table form
  const [newTableLabel, setNewTableLabel] = useState("");
  const [newTableCode, setNewTableCode] = useState("");

  const selectedRestaurant = restaurants.find((r) => r.id === selectedRestId);

  // Load restaurants
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch("/api/restaurants");
        const data = await res.json();
        const list = data.restaurants || [];
        setRestaurants(list);
        if (list.length > 0) {
          setSelectedRestId(list[0].id);
        }
      } catch (err) {
        toast.error("Failed to load restaurants.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Load tables when restaurant selection changes
  useEffect(() => {
    if (!selectedRestId) return;
    async function loadTables() {
      try {
        const res = await fetch(`/api/tables?restaurantId=${selectedRestId}`);
        const data = await res.json();
        setTables(data.tables || []);
      } catch (err) {
        toast.error("Failed to load tables.");
      }
    }
    loadTables();
  }, [selectedRestId]);

  // Handle table creation with QR generation
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableLabel || !selectedRestId) {
      toast.error("Please enter a table label.");
      return;
    }

    setIsCreatingTable(true);
    try {
      const res = await authFetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestId,
          displayLabel: newTableLabel,
          code: newTableCode || newTableLabel,
          callerRole: "SUPER_ADMIN", // Explicit authorized role
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create table");
      }

      setTables((prev) => [...prev, data.table]);
      toast.success(`Table "${data.table.displayLabel}" created with active QR code!`);
      setIsModalOpen(false);
      setNewTableLabel("");
      setNewTableCode("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create table.");
    } finally {
      setIsCreatingTable(false);
    }
  };

  // Re-generate QR for existing table
  const handleRegenerateQR = async (tableId: string) => {
    try {
      toast.loading("Regenerating QR code...", { id: "regen" });
      const res = await authFetch("/api/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestId,
          tableId,
          callerRole: "SUPER_ADMIN",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regeneration failed");

      setTables((prev) => prev.map((t) => (t.id === tableId ? data.table : t)));
      toast.success("QR code regenerated successfully!", { id: "regen" });
    } catch (err: any) {
      toast.error(err.message, { id: "regen" });
    }
  };

  // Download QR code image
  const handleDownloadQR = (qrDataUrl: string, displayLabel: string) => {
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${selectedRestaurant?.slug || "rest"}-${displayLabel.replace(/\s+/g, "-")}-QR.png`;
    a.click();
    toast.success(`Downloaded QR for ${displayLabel}`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <Badge variant="default" className="bg-brand-500 text-white font-mono text-[10px]">
              VIVEXA TECH EXCLUSIVE
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            Table & QR Code Issuance Hub
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Only authorized Vivexa Tech staff can configure tables and issue dining QR codes.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPrintSheetOpen(true)}
            disabled={tables.length === 0}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Printable Sheet ({tables.length})
          </Button>
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            disabled={!selectedRestId}
            className="font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Provision New Table
          </Button>
        </div>
      </div>

      {/* Restaurant Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
            Select Venue:
          </label>
          <select
            value={selectedRestId}
            onChange={(e) => setSelectedRestId(e.target.value)}
            className="rounded-xl border border-slate-300 p-2 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.city}) - /{r.slug}
              </option>
            ))}
          </select>
        </div>

        {selectedRestaurant && (
          <div className="text-xs text-slate-500 flex items-center space-x-4">
            <span>
              Configured Tables: <strong className="text-slate-900">{tables.length}</strong>
            </span>
            <span>•</span>
            <span>
              URL Pattern: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">/order/{selectedRestaurant.slug}/[tableCode]</code>
            </span>
          </div>
        )}
      </div>

      {/* Tables & QR Grid */}
      {tables.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <QrCode className="h-12 w-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No tables configured for this restaurant</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Provision tables and generate official Vivexa Tech QR codes to enable customer dining orders.
          </p>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create First Table
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tables.map((tbl) => {
            const destinationUrl = `/order/${selectedRestaurant?.slug}/${tbl.code}`;

            return (
              <div
                key={tbl.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card hover:shadow-soft transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-sm text-slate-900">{tbl.displayLabel}</span>
                    <Badge variant={tbl.isActive ? "success" : "neutral"} className="text-[10px]">
                      {tbl.isActive ? "ACTIVE" : "INACTIVE"}
                    </Badge>
                  </div>

                  {/* QR Image Box */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center my-2">
                    {tbl.qrCodeUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tbl.qrCodeUrl}
                        alt={`QR Code for ${tbl.displayLabel}`}
                        className="w-36 h-36 object-contain rounded-lg shadow-sm"
                      />
                    ) : (
                      <div className="w-36 h-36 flex items-center justify-center text-slate-400 text-xs">
                        No QR Generated
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono mt-2 truncate max-w-full">
                      {destinationUrl}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100 mt-2">
                  <div className="grid grid-cols-2 gap-2">
                    {tbl.qrCodeUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadQR(tbl.qrCodeUrl!, tbl.displayLabel)}
                        className="text-xs h-8"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        PNG
                      </Button>
                    )}
                    <Link href={destinationUrl} target="_blank" className="w-full">
                      <Button variant="outline" size="sm" className="w-full text-xs h-8">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Test
                      </Button>
                    </Link>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRegenerateQR(tbl.id)}
                    className="w-full text-[11px] text-slate-500 hover:text-slate-800 h-7"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reprint / Regenerate
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Provision Table Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Provision New Table with QR Code"
        description={`Restaurant: ${selectedRestaurant?.name || ""}`}
      >
        <form onSubmit={handleCreateTable} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Table Display Label *
            </label>
            <Input
              placeholder="e.g. Table 05 or Rooftop Lounge 2"
              value={newTableLabel}
              onChange={(e) => {
                setNewTableLabel(e.target.value);
                if (!newTableCode) {
                  setNewTableCode(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                }
              }}
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Visible to customer and kitchen ticket display.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              URL Slug Code
            </label>
            <Input
              placeholder="e.g. table-05"
              value={newTableCode}
              onChange={(e) => setNewTableCode(e.target.value)}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Destination URL: <code>/order/{selectedRestaurant?.slug}/[code]</code>
            </p>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
            <strong>Vivexa Tech Security Rule:</strong> High-resolution QR code will be generated on the backend and mapped permanently to internal table ID.
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreatingTable}>
              Issue Table & QR
            </Button>
          </div>
        </form>
      </Modal>

      {/* Multi-Table Printable Sheet Modal */}
      <Modal
        isOpen={printSheetOpen}
        onClose={() => setPrintSheetOpen(false)}
        title={`Printable Table QR Sheet - ${selectedRestaurant?.name}`}
        description="Print-ready table cards for dining room placement"
        maxWidth="2xl"
      >
        <div className="space-y-6">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <p className="text-xs text-slate-500">
              Each card features the Vivexa-issued table QR code and dining instructions.
            </p>
            <Button size="sm" onClick={() => window.print()} className="font-semibold">
              <Printer className="h-4 w-4 mr-1.5" />
              Print Sheet Now
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto p-2">
            {tables.map((t) => (
              <div
                key={t.id}
                className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center bg-white space-y-2 flex flex-col items-center justify-between"
              >
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">
                    {selectedRestaurant?.name}
                  </span>
                  <h4 className="text-sm font-black text-slate-900 font-display">
                    {t.displayLabel}
                  </h4>
                </div>

                {t.qrCodeUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.qrCodeUrl}
                    alt={t.displayLabel}
                    className="w-28 h-28 object-contain my-1"
                  />
                )}

                <div>
                  <p className="text-[10px] font-semibold text-brand-600">
                    SCAN TO BROWSE & ORDER
                  </p>
                  <p className="text-[8px] text-slate-400 font-mono mt-0.5">
                    restrocharge.vivexatech.in
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
