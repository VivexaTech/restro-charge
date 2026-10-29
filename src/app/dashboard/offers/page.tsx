// ==============================================================================
// RESTROCHARGE - Restaurant Offers & Discounts Management Dashboard
// Full lifecycle: Day-wise, Category, Festival/Event & Combo offers with live preview.
// Developed by Vivexa Tech.
// ==============================================================================

"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Pause,
  Play,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  Layers,
  Sparkles,
  ShoppingBag,
  Percent,
  ArrowRight,
  Eye,
  Check,
  ChevronDown,
  Store,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useActiveRestaurant } from "@/lib/hooks/use-active-restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import {
  RestaurantOffer,
  ProductCategory,
  ProductItem,
  OfferType,
  DiscountMethod,
  OfferStatus,
  DayOfWeek,
  ComboItemConfig,
} from "@/lib/types";
import {
  isOfferActive,
  calculateDiscountForOffer,
  getZonedDateInfo,
} from "@/lib/services/offers-engine";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth/client-auth";

const ALL_DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
];

export default function RestaurantOffersPage() {
  const { user } = useAuth();
  const {
    restaurantId: currentRestaurantId,
    restaurant: activeRestaurant,
    allRestaurants,
    selectRestaurant,
    isSuperAdmin,
    loading: resLoading,
  } = useActiveRestaurant();

  const [offers, setOffers] = useState<RestaurantOffer[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"CONFIG" | "PREVIEW">("CONFIG");

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<OfferType>("DAY_WISE");
  const [formDiscountMethod, setFormDiscountMethod] = useState<DiscountMethod>("FIXED_PRICE");
  const [formDiscountValue, setFormDiscountValue] = useState<number>(99);
  const [formPriority, setFormPriority] = useState<number>(1);
  const [formStatus, setFormStatus] = useState<OfferStatus>("ACTIVE");
  const [formImageUrl, setFormImageUrl] = useState("");

  // Schedule fields
  const [formDays, setFormDays] = useState<DayOfWeek[]>(["tuesday"]);
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");

  // Scope selection
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [itemSearchText, setItemSearchText] = useState("");

  // Combo Builder fields
  const [comboPrice, setComboPrice] = useState<number>(99);
  const [comboItems, setComboItems] = useState<ComboItemConfig[]>([]);

  // Deletion Confirmation Modal
  const [deletingOffer, setDeletingOffer] = useState<RestaurantOffer | null>(null);

  const loadData = async () => {
    if (!currentRestaurantId) return;
    try {
      setLoading(true);
      const [offersRes, catRes, prodRes] = await Promise.all([
        fetch(`/api/offers?restaurantId=${currentRestaurantId}`),
        fetch(`/api/categories?restaurantId=${currentRestaurantId}`),
        fetch(`/api/products?restaurantId=${currentRestaurantId}`),
      ]);

      const offersData = await offersRes.json();
      const catData = await catRes.json();
      const prodData = await prodRes.json();

      setOffers(offersData.offers || []);
      setCategories(catData.categories || []);
      setProducts(prodData.products || []);
    } catch {
      toast.error("Failed to load offers and menu data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentRestaurantId]);

  // Reset form to defaults
  const resetForm = () => {
    setEditingOfferId(null);
    setFormName("");
    setFormDescription("");
    setFormType("DAY_WISE");
    setFormDiscountMethod("FIXED_PRICE");
    setFormDiscountValue(99);
    setFormPriority(1);
    setFormStatus("ACTIVE");
    setFormImageUrl("");
    setFormDays(["tuesday"]);
    setFormStartDate("");
    setFormEndDate("");
    setFormStartTime("");
    setFormEndTime("");
    setSelectedCategoryIds([]);
    setSelectedItemIds([]);
    setComboPrice(99);
    setComboItems([]);
    setActiveTab("CONFIG");
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (offer: RestaurantOffer) => {
    setEditingOfferId(offer.id);
    setFormName(offer.name);
    setFormDescription(offer.description || "");
    setFormType(offer.offerType);
    setFormDiscountMethod(offer.discountMethod);
    setFormDiscountValue(offer.discountValue);
    setFormPriority(offer.priority || 1);
    setFormStatus(offer.status);
    setFormImageUrl(offer.imageUrl || "");
    setFormDays(offer.applicableDays || []);
    setFormStartDate(offer.startDate || "");
    setFormEndDate(offer.endDate || "");
    setFormStartTime(offer.startTime || "");
    setFormEndTime(offer.endTime || "");
    setSelectedCategoryIds(offer.eligibleCategoryIds || []);
    setSelectedItemIds(offer.eligibleItemIds || []);
    setComboPrice(offer.comboPrice || 99);
    setComboItems(offer.comboItems || []);
    setActiveTab("CONFIG");
    setIsModalOpen(true);
  };

  // Duplicate an offer
  const handleDuplicate = (offer: RestaurantOffer) => {
    setEditingOfferId(null);
    setFormName(`${offer.name} (Copy)`);
    setFormDescription(offer.description || "");
    setFormType(offer.offerType);
    setFormDiscountMethod(offer.discountMethod);
    setFormDiscountValue(offer.discountValue);
    setFormPriority(offer.priority || 1);
    setFormStatus("DRAFT");
    setFormImageUrl(offer.imageUrl || "");
    setFormDays(offer.applicableDays || []);
    setFormStartDate(offer.startDate || "");
    setFormEndDate(offer.endDate || "");
    setFormStartTime(offer.startTime || "");
    setFormEndTime(offer.endTime || "");
    setSelectedCategoryIds(offer.eligibleCategoryIds || []);
    setSelectedItemIds(offer.eligibleItemIds || []);
    setComboPrice(offer.comboPrice || 99);
    setComboItems(offer.comboItems || []);
    setActiveTab("CONFIG");
    setIsModalOpen(true);
  };

  // Toggle active/paused state
  const handleToggleStatus = async (offer: RestaurantOffer) => {
    const nextStatus: OfferStatus = offer.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await authFetch(`/api/offers/${offer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, restaurantId: currentRestaurantId }),
      });
      if (res.ok) {
        toast.success(
          nextStatus === "ACTIVE" ? `Offer '${offer.name}' activated.` : `Offer '${offer.name}' paused.`
        );
        loadData();
      } else {
        toast.error("Failed to update offer status.");
      }
    } catch {
      toast.error("Network error while updating offer.");
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingOffer) return;
    try {
      const res = await authFetch(
        `/api/offers/${deletingOffer.id}?restaurantId=${currentRestaurantId}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        toast.success(`Offer '${deletingOffer.name}' removed.`);
        setDeletingOffer(null);
        loadData();
      } else {
        toast.error("Failed to delete offer.");
      }
    } catch {
      toast.error("Network error deleting offer.");
    }
  };

  // Toggle day selection
  const toggleDay = (day: DayOfWeek) => {
    setFormDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Toggle category selection
  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  // Toggle item selection
  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // Add item to combo
  const handleAddComboItem = (productId: string) => {
    setComboItems((prev) => {
      const existing = prev.find((ci) => ci.productId === productId);
      if (existing) {
        return prev.map((ci) =>
          ci.productId === productId ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  // Remove item from combo
  const handleRemoveComboItem = (productId: string) => {
    setComboItems((prev) => prev.filter((ci) => ci.productId !== productId));
  };

  // Change combo item quantity
  const handleUpdateComboQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveComboItem(productId);
      return;
    }
    setComboItems((prev) =>
      prev.map((ci) => (ci.productId === productId ? { ...ci, quantity: qty } : ci))
    );
  };

  // Compute effective list of eligible items (combining category + specific items)
  const previewEligibleProducts = useMemo(() => {
    if (formType === "COMBO") return [];
    return products.filter((prod) => {
      const inCategory = selectedCategoryIds.includes(prod.categoryId);
      const inItems = selectedItemIds.includes(prod.id);
      return inCategory || inItems;
    });
  }, [products, selectedCategoryIds, selectedItemIds, formType]);

  // Calculate Combo Regular Total
  const comboRegularTotal = useMemo(() => {
    return comboItems.reduce((sum, ci) => {
      const prod = products.find((p) => p.id === ci.productId);
      return sum + (prod ? prod.price * ci.quantity : 0);
    }, 0);
  }, [comboItems, products]);

  // Save Offer Handler
  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      toast.error("Please enter an offer name.");
      return;
    }

    if (formType === "COMBO") {
      if (comboItems.length === 0) {
        toast.error("Please add at least one menu item to the combo.");
        return;
      }
      if (comboPrice <= 0) {
        toast.error("Combo price must be greater than zero.");
        return;
      }
    } else {
      if (selectedCategoryIds.length === 0 && selectedItemIds.length === 0) {
        toast.error("Please select at least one eligible category or menu item.");
        return;
      }
      if (formDiscountValue <= 0) {
        toast.error("Please enter a valid discount amount or price.");
        return;
      }
      if (formDiscountMethod === "PERCENTAGE" && formDiscountValue > 100) {
        toast.error("Percentage discount cannot exceed 100%.");
        return;
      }
    }

    if (formType === "DAY_WISE" && formDays.length === 0) {
      toast.error("Please select at least one day for day-wise offers.");
      return;
    }

    const targetRestaurantId = currentRestaurantId || allRestaurants[0]?.id;
    if (!targetRestaurantId) {
      toast.error("Please select a restaurant venue first.");
      return;
    }

    const payload = {
      restaurantId: targetRestaurantId,
      name: formName.trim(),
      description: formDescription.trim(),
      offerType: formType,
      discountMethod: formDiscountMethod,
      discountValue: Number(formDiscountValue) || 0,
      eligibleItemIds: selectedItemIds,
      eligibleCategoryIds: selectedCategoryIds,
      comboItems: formType === "COMBO" ? comboItems : undefined,
      comboPrice: formType === "COMBO" ? Number(comboPrice) : undefined,
      applicableDays: formType === "DAY_WISE" || formDays.length > 0 ? formDays : undefined,
      startDate: formStartDate || undefined,
      endDate: formEndDate || undefined,
      startTime: formStartTime || undefined,
      endTime: formEndTime || undefined,
      priority: Number(formPriority) || 1,
      status: formStatus,
      imageUrl: formImageUrl || undefined,
    };

    try {
      let res;
      if (editingOfferId) {
        res = await authFetch(`/api/offers/${editingOfferId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        res = await authFetch("/api/offers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        toast.success(
          editingOfferId
            ? `Offer '${formName}' updated successfully.`
            : `Offer '${formName}' created successfully!`
        );
        setIsModalOpen(false);
        loadData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save offer.");
      }
    } catch {
      toast.error("An error occurred while saving the offer.");
    }
  };

  // Filtered offers list
  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      const matchesSearch =
        o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.description && o.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = typeFilter === "ALL" || o.offerType === typeFilter;
      const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [offers, searchQuery, typeFilter, statusFilter]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = offers.length;
    const active = offers.filter((o) => o.status === "ACTIVE").length;
    const paused = offers.filter((o) => o.status === "PAUSED").length;
    const draft = offers.filter((o) => o.status === "DRAFT").length;
    const combos = offers.filter((o) => o.offerType === "COMBO" && o.status === "ACTIVE").length;
    return { total, active, paused, draft, combos };
  }, [offers]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-brand-50 text-brand-600 rounded-lg">
              <Tag className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold font-display text-slate-900">
              Offers & Discounts
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure day-wise specials (e.g. Tuesday ₹99), category promotions, festive campaigns, and value combos.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center space-x-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Offer</span>
        </Button>
      </div>

      {/* Multi-tenant Venue Switcher Banner (Visible to Super Admin or Multi-restaurant Managers) */}
      {(isSuperAdmin || allRestaurants.length > 1) && (
        <div className="bg-brand-50/70 border border-brand-200/70 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-700 flex items-center justify-center shrink-0">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-900">
                  {activeRestaurant?.name || (currentRestaurantId ? `Restaurant: ${currentRestaurantId}` : "No Venue Selected")}
                </span>
                {isSuperAdmin && (
                  <Badge variant="default" className="text-[10px] py-0 px-2 font-semibold">
                    Super Admin Scope
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Offers and combos are scoped to this restaurant venue.
              </p>
            </div>
          </div>

          {allRestaurants.length > 0 && (
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <label htmlFor="offers-venue-select" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Switch Venue:
              </label>
              <select
                id="offers-venue-select"
                value={currentRestaurantId}
                onChange={(e) => selectRestaurant(e.target.value)}
                className="text-xs font-semibold bg-white border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs cursor-pointer w-full sm:w-auto"
              >
                {allRestaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.slug})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Total Offers
          </p>
          <p className="text-2xl font-bold font-display text-slate-900 mt-1">
            {stats.total}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 shadow-sm">
          <p className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">
            Live Active
          </p>
          <p className="text-2xl font-bold font-display text-emerald-700 mt-1">
            {stats.active}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-100 bg-amber-50/30 shadow-sm">
          <p className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">
            Paused
          </p>
          <p className="text-2xl font-bold font-display text-amber-700 mt-1">
            {stats.paused}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-purple-100 bg-purple-50/30 shadow-sm">
          <p className="text-[11px] font-medium text-purple-700 uppercase tracking-wider">
            Active Combos
          </p>
          <p className="text-2xl font-bold font-display text-purple-700 mt-1">
            {stats.combos}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Drafts
          </p>
          <p className="text-2xl font-bold font-display text-slate-700 mt-1">
            {stats.draft}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search offers by name or notes..."
            className="pl-9 h-10 text-xs bg-slate-50"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="DAY_WISE">Day-Wise</option>
            <option value="CATEGORY">Category</option>
            <option value="EVENT">Festival / Event</option>
            <option value="COMBO">Combo</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
      </div>

      {/* Offers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Loading offers & promotions...
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Tag className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">No Offers Configured Yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Create your first promotion to boost orders, reward loyal diners, or introduce value combos.
            </p>
            <Button
              onClick={handleOpenCreate}
              className="mt-4 bg-brand-600 hover:bg-brand-700 text-white text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create First Offer
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Offer Name & Type</th>
                  <th className="py-3 px-4">Discount / Price</th>
                  <th className="py-3 px-4">Scope & Eligibility</th>
                  <th className="py-3 px-4">Schedule / Validity</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOffers.map((offer) => {
                  const isCurrentlyActive = isOfferActive(offer);

                  return (
                    <tr key={offer.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm">
                            {offer.name}
                          </span>
                          <div className="flex items-center space-x-1.5 mt-1">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                offer.offerType === "DAY_WISE"
                                  ? "bg-amber-100 text-amber-800"
                                  : offer.offerType === "CATEGORY"
                                  ? "bg-blue-100 text-blue-800"
                                  : offer.offerType === "EVENT"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {offer.offerType === "DAY_WISE" && "Day-Wise"}
                              {offer.offerType === "CATEGORY" && "Category"}
                              {offer.offerType === "EVENT" && "Festival/Event"}
                              {offer.offerType === "COMBO" && "Combo"}
                            </span>
                            {offer.description && (
                              <span className="text-[11px] text-slate-400 truncate max-w-xs">
                                {offer.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium">
                        {offer.offerType === "COMBO" ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-purple-700 text-sm">
                              {formatCurrency(offer.comboPrice || 0)}
                            </span>
                            <span className="text-[10px] text-slate-400">Combo Total</span>
                          </div>
                        ) : offer.discountMethod === "FIXED_PRICE" ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-brand-700 text-sm">
                              {formatCurrency(offer.discountValue)}
                            </span>
                            <span className="text-[10px] text-slate-400">Per Item Target</span>
                          </div>
                        ) : offer.discountMethod === "PERCENTAGE" ? (
                          <span className="font-bold text-emerald-700 text-sm">
                            {offer.discountValue}% OFF
                          </span>
                        ) : (
                          <span className="font-bold text-slate-800 text-sm">
                            ₹{offer.discountValue} OFF
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {offer.offerType === "COMBO" ? (
                          <span className="text-slate-700">
                            {offer.comboItems?.length || 0} Bundled Items
                          </span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {offer.eligibleCategoryIds?.length > 0 && (
                              <span className="text-blue-700 font-medium">
                                {offer.eligibleCategoryIds.length} Categor{offer.eligibleCategoryIds.length === 1 ? "y" : "ies"}
                              </span>
                            )}
                            {offer.eligibleItemIds?.length > 0 && (
                              <span className="text-slate-600">
                                {offer.eligibleItemIds.length} Specific Item{offer.eligibleItemIds.length === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col text-[11px] text-slate-600">
                          {offer.applicableDays && offer.applicableDays.length > 0 ? (
                            <span className="font-medium text-amber-800">
                              Every {offer.applicableDays.map((d) => d.slice(0, 3).toUpperCase()).join(", ")}
                            </span>
                          ) : offer.startDate || offer.endDate ? (
                            <span>
                              {offer.startDate || "Any"} → {offer.endDate || "Ongoing"}
                            </span>
                          ) : (
                            <span className="text-slate-400">All Days</span>
                          )}
                          {offer.startTime && offer.endTime && (
                            <span className="text-[10px] text-slate-400">
                              {offer.startTime} - {offer.endTime}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                          P{offer.priority || 1}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              offer.status === "ACTIVE"
                                ? isCurrentlyActive
                                  ? "bg-emerald-500"
                                  : "bg-amber-400"
                                : offer.status === "PAUSED"
                                ? "bg-amber-500"
                                : "bg-slate-300"
                            }`}
                          />
                          <span
                            className={`font-semibold ${
                              offer.status === "ACTIVE"
                                ? isCurrentlyActive
                                  ? "text-emerald-700"
                                  : "text-amber-700"
                                : offer.status === "PAUSED"
                                ? "text-amber-700"
                                : "text-slate-500"
                            }`}
                          >
                            {offer.status === "ACTIVE"
                              ? isCurrentlyActive
                                ? "Active Now"
                                : "Active (Off Schedule)"
                              : offer.status}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleToggleStatus(offer)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title={offer.status === "ACTIVE" ? "Pause Offer" : "Activate Offer"}
                          >
                            {offer.status === "ACTIVE" ? (
                              <Pause className="h-4 w-4 text-amber-600" />
                            ) : (
                              <Play className="h-4 w-4 text-emerald-600" />
                            )}
                          </button>

                          <button
                            onClick={() => handleOpenEdit(offer)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title="Edit Offer"
                          >
                            <Edit2 className="h-4 w-4 text-blue-600" />
                          </button>

                          <button
                            onClick={() => handleDuplicate(offer)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title="Duplicate as Draft"
                          >
                            <Copy className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => setDeletingOffer(offer)}
                            className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                            title="Delete Offer"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Offer Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingOfferId ? `Edit Offer: ${formName || "Details"}` : "Create New Offer or Combo"}
      >
        <div className="space-y-5">
          {/* Tabs: Configuration vs Live Pricing Preview */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("CONFIG")}
              className={`pb-2.5 px-4 font-semibold text-xs border-b-2 transition ${
                activeTab === "CONFIG"
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              1. Offer Configuration
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("PREVIEW")}
              className={`pb-2.5 px-4 font-semibold text-xs border-b-2 transition flex items-center space-x-1.5 ${
                activeTab === "PREVIEW"
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>
                2. Live Price Preview (
                {formType === "COMBO" ? comboItems.length : previewEligibleProducts.length})
              </span>
            </button>
          </div>

          {activeTab === "CONFIG" ? (
            <form onSubmit={handleSaveOffer} className="space-y-5">
              {/* Basic Information */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                  General Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Offer Name *
                    </label>
                    <Input
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Tuesday Special — ₹99 Menu"
                      className="text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Offer Type *
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as OfferType)}
                      className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                    >
                      <option value="DAY_WISE">Day-Wise Special (e.g. Tuesday ₹99)</option>
                      <option value="CATEGORY">Category Promotion (e.g. 25% Off Momos)</option>
                      <option value="EVENT">Festival / Date-Range Event</option>
                      <option value="COMBO">Combo Meal Offering (Bundled Price)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Short Description (Optional)
                  </label>
                  <Input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g. Enjoy delicious momos at an unbeatable ₹99 price every Tuesday!"
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Day-Wise / Schedule Section */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                  Schedule & Timing
                </h4>

                {/* Weekday Buttons for Day-Wise */}
                {(formType === "DAY_WISE" || formType === "EVENT") && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                      Applicable Weekdays {formType === "DAY_WISE" ? "*" : "(Optional)"}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_DAYS.map((d) => {
                        const isSelected = formDays.includes(d.key);
                        return (
                          <button
                            type="button"
                            key={d.key}
                            onClick={() => toggleDay(d.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                              isSelected
                                ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {d.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Date range for Event Offers */}
                {(formType === "EVENT" || formType === "COMBO") && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Start Date
                      </label>
                      <Input
                        type="date"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        End Date
                      </label>
                      <Input
                        type="date"
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Optional Daily Hours */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Daily Start Time (Optional)
                    </label>
                    <Input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Daily End Time (Optional)
                    </label>
                    <Input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Eligibility & Discount for Regular Offers */}
              {formType !== "COMBO" ? (
                <>
                  {/* Category & Item Selector */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                        Eligible Scope (Categories & Items)
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {previewEligibleProducts.length} item(s) selected
                      </span>
                    </div>

                    {/* Category Selection Chips */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                        Select Whole Categories
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => {
                          const isCatSelected = selectedCategoryIds.includes(cat.id);
                          const catItemsCount = products.filter((p) => p.categoryId === cat.id).length;
                          return (
                            <button
                              type="button"
                              key={cat.id}
                              onClick={() => toggleCategory(cat.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 transition ${
                                isCatSelected
                                  ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              <span>{cat.name}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                  isCatSelected
                                    ? "bg-blue-800 text-blue-100"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {catItemsCount}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Specific Menu Items Selector */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                        Or Select Individual Menu Items
                      </label>
                      <div className="relative mb-2">
                        <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <Input
                          value={itemSearchText}
                          onChange={(e) => setItemSearchText(e.target.value)}
                          placeholder="Filter menu items..."
                          className="pl-8 h-8 text-xs bg-slate-50"
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50/50">
                        {products
                          .filter((p) =>
                            p.name.toLowerCase().includes(itemSearchText.toLowerCase())
                          )
                          .map((prod) => {
                            const isDirectlySelected = selectedItemIds.includes(prod.id);
                            const isViaCategory = selectedCategoryIds.includes(prod.categoryId);
                            const isEligible = isDirectlySelected || isViaCategory;

                            return (
                              <div
                                key={prod.id}
                                onClick={() => toggleItem(prod.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer border transition ${
                                  isDirectlySelected
                                    ? "bg-brand-50 border-brand-300 text-brand-900 font-medium"
                                    : isViaCategory
                                    ? "bg-blue-50/60 border-blue-200 text-blue-900"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={isEligible}
                                    onChange={() => {}}
                                    className="rounded border-slate-300 text-brand-600"
                                  />
                                  <span>{prod.name}</span>
                                  {isViaCategory && (
                                    <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 rounded">
                                      Via Category
                                    </span>
                                  )}
                                </div>
                                <span className="font-semibold text-slate-900">
                                  {formatCurrency(prod.price)}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Discount Method */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                      Discount Calculation
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Discount Method *
                        </label>
                        <select
                          value={formDiscountMethod}
                          onChange={(e) =>
                            setFormDiscountMethod(e.target.value as DiscountMethod)
                          }
                          className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                        >
                          <option value="FIXED_PRICE">Fixed Offer Price (e.g. ₹99 per item)</option>
                          <option value="PERCENTAGE">Percentage Off (e.g. 25% OFF)</option>
                          <option value="FIXED_AMOUNT">Fixed Discount (e.g. ₹30 OFF item)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          {formDiscountMethod === "FIXED_PRICE"
                            ? "Target Price (₹) *"
                            : formDiscountMethod === "PERCENTAGE"
                            ? "Discount Percentage (%) *"
                            : "Discount Amount (₹) *"}
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max={formDiscountMethod === "PERCENTAGE" ? 100 : undefined}
                          value={formDiscountValue}
                          onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                          className="text-xs"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Combo Builder UI */
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-purple-700">
                    Combo Menu Builder
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Select Dish to Add into Combo
                      </label>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddComboItem(e.target.value);
                            e.target.value = "";
                          }
                        }}
                        className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                      >
                        <option value="">-- Choose Menu Dish --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatCurrency(p.price)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Special Combo Price (₹) *
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={comboPrice}
                        onChange={(e) => setComboPrice(Number(e.target.value))}
                        className="text-xs font-bold text-purple-700"
                        required
                      />
                    </div>
                  </div>

                  {/* Combo Items List */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                      Included Dishes in this Combo ({comboItems.length})
                    </label>
                    {comboItems.length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        No dishes added to combo yet. Select a dish above.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {comboItems.map((ci) => {
                          const prod = products.find((p) => p.id === ci.productId);
                          return (
                            <div
                              key={ci.productId}
                              className="flex items-center justify-between p-2 bg-purple-50/40 rounded-lg border border-purple-100 text-xs"
                            >
                              <span className="font-semibold text-purple-900">
                                {prod?.name || "Dish"} ({formatCurrency(prod?.price || 0)})
                              </span>

                              <div className="flex items-center space-x-2">
                                <label className="text-[10px] text-slate-500">Qty:</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={ci.quantity}
                                  onChange={(e) =>
                                    handleUpdateComboQuantity(ci.productId, Number(e.target.value))
                                  }
                                  className="w-14 h-7 text-center font-bold text-xs border border-purple-200 rounded bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveComboItem(ci.productId)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Combo Savings Banner */}
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                          <div>
                            <span>Regular Item Total: </span>
                            <span className="line-through text-slate-500 font-semibold">
                              {formatCurrency(comboRegularTotal)}
                            </span>
                            <span className="ml-2 font-bold text-emerald-700">
                              Combo: {formatCurrency(comboPrice)}
                            </span>
                          </div>
                          <span className="font-extrabold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded">
                            Saves {formatCurrency(Math.max(0, comboRegularTotal - comboPrice))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Priority & Status */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Priority Level (1-100)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    className="text-xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Higher priority wins when multiple offers conflict on the same item.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as OfferStatus)}
                    className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                  >
                    <option value="ACTIVE">Active (Live in Menu)</option>
                    <option value="PAUSED">Paused</option>
                    <option value="DRAFT">Draft</option>
                  </select>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white text-xs">
                  {editingOfferId ? "Update Offer" : "Save and Publish Offer"}
                </Button>
              </div>
            </form>
          ) : (
            /* Live Price Preview Tab */
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 text-blue-900 rounded-xl border border-blue-200 text-xs">
                <strong>Live Pricing Simulator:</strong> Below is how menu items will be priced when this offer applies.
              </div>

              {formType === "COMBO" ? (
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm">{formName || "Combo Meal"}</h4>
                  <p className="text-xs text-slate-500">{formDescription}</p>

                  <div className="space-y-2">
                    {comboItems.map((ci) => {
                      const prod = products.find((p) => p.id === ci.productId);
                      return (
                        <div
                          key={ci.productId}
                          className="flex items-center justify-between text-xs text-slate-700"
                        >
                          <span>
                            {ci.quantity}x {prod?.name}
                          </span>
                          <span className="font-medium text-slate-500">
                            {formatCurrency((prod?.price || 0) * ci.quantity)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between font-bold">
                    <span>Effective Combo Price:</span>
                    <span className="text-base text-purple-700 font-display">
                      {formatCurrency(comboPrice)}
                    </span>
                  </div>
                </div>
              ) : previewEligibleProducts.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No eligible items selected yet. Select a category or item in the configuration tab.
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3">Regular Price</th>
                        <th className="py-2.5 px-3">Discount</th>
                        <th className="py-2.5 px-3">Diner Offer Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewEligibleProducts.map((prod) => {
                        const tempOffer: RestaurantOffer = {
                          id: "temp",
                          restaurantId: currentRestaurantId,
                          name: formName || "Offer",
                          offerType: formType,
                          discountMethod: formDiscountMethod,
                          discountValue: formDiscountValue,
                          eligibleItemIds: selectedItemIds,
                          eligibleCategoryIds: selectedCategoryIds,
                          priority: formPriority,
                          status: "ACTIVE",
                          createdAt: "",
                          updatedAt: "",
                        };
                        const { effectivePrice, discountAmount } = calculateDiscountForOffer(
                          prod.price,
                          tempOffer
                        );

                        return (
                          <tr key={prod.id}>
                            <td className="py-2 px-3 font-semibold text-slate-800">{prod.name}</td>
                            <td className="py-2 px-3 line-through text-slate-400">
                              {formatCurrency(prod.price)}
                            </td>
                            <td className="py-2 px-3 text-emerald-700 font-medium">
                              -{formatCurrency(discountAmount)}
                            </td>
                            <td className="py-2 px-3 font-bold text-brand-700 font-display">
                              {formatCurrency(effectivePrice)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-between pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab("CONFIG")}
                  className="text-xs"
                >
                  ← Back to Configuration
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveOffer}
                  className="bg-brand-600 hover:bg-brand-700 text-white text-xs"
                >
                  Save and Publish Offer
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deletingOffer && (
        <Modal
          isOpen={Boolean(deletingOffer)}
          onClose={() => setDeletingOffer(null)}
          title="Confirm Offer Deletion"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Are you sure you want to delete offer <strong>&quot;{deletingOffer.name}&quot;</strong>?
              Past completed orders will preserve their historical price snapshots and will not be affected.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingOffer(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white text-xs"
              >
                Delete Offer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
