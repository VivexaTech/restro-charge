"use client";

import React, { useState, useEffect } from "react";
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Upload,
  Layers,
  Sparkles,
  Store,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useActiveRestaurant } from "@/lib/hooks/use-active-restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ProductItem, ProductCategory, ProductPortion, DietaryClassification } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth/client-auth";

export default function RestaurantMenuManagementPage() {
  const { user } = useAuth();
  const {
    restaurantId: currentRestaurantId,
    restaurant: activeRestaurant,
    allRestaurants,
    selectRestaurant,
    isSuperAdmin,
    loading: resLoading,
  } = useActiveRestaurant();

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCatId, setSelectedCatId] = useState<string>("all");

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

  // Product Form state
  const [prodName, setProdName] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [prodBasePrice, setProdBasePrice] = useState(250);
  const [prodCategoryId, setProdCategoryId] = useState("");
  const [prodDietaryType, setProdDietaryType] = useState<DietaryClassification>("veg");
  const [prodImageUrl, setProdImageUrl] = useState("");

  // Portion configuration state
  const [hasPortions, setHasPortions] = useState(true);
  const [quarterEnabled, setQuarterEnabled] = useState(false);
  const [quarterPrice, setQuarterPrice] = useState(150);
  const [halfEnabled, setHalfEnabled] = useState(true);
  const [halfPrice, setHalfPrice] = useState(180);
  const [fullEnabled, setFullEnabled] = useState(true);
  const [fullPrice, setFullPrice] = useState(320);

  // Category Form state
  const [catName, setCatName] = useState("");
  const [catDescription, setCatDescription] = useState("");

  const loadMenuData = async () => {
    if (!currentRestaurantId) {
      setCategories([]);
      setProducts([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const catRes = await fetch(`/api/categories?restaurantId=${currentRestaurantId}`);
      const catData = await catRes.json();
      setCategories(catData.categories || []);

      const prodRes = await fetch(`/api/products?restaurantId=${currentRestaurantId}`);
      const prodData = await prodRes.json();
      setProducts(prodData.products || []);

      if (catData.categories?.length > 0 && !prodCategoryId) {
        setProdCategoryId(catData.categories[0].id);
      }
    } catch {
      toast.error("Failed to load menu data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenuData();
  }, [currentRestaurantId]);

  const openNewProduct = () => {
    setEditingProduct(null);
    setProdName("");
    setProdDescription("");
    setProdBasePrice(250);
    setProdCategoryId(categories[0]?.id || "");
    setProdDietaryType("veg");
    setProdImageUrl("");

    setHasPortions(true);
    setQuarterEnabled(false);
    setQuarterPrice(150);
    setHalfEnabled(true);
    setHalfPrice(160);
    setFullEnabled(true);
    setFullPrice(290);

    setIsProductModalOpen(true);
  };

  const openEditProduct = (p: ProductItem) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdDescription(p.description);
    setProdBasePrice(p.price);
    setProdCategoryId(p.categoryId);
    setProdDietaryType(p.dietaryType || (p.isVeg ? "veg" : "non_veg"));
    setProdImageUrl(p.imageUrl || "");

    const portions = p.portions || [];
    const q = portions.find((po) => po.id === "quarter");
    const h = portions.find((po) => po.id === "half");
    const f = portions.find((po) => po.id === "full");

    setHasPortions(portions.length > 0);
    setQuarterEnabled(Boolean(q));
    setQuarterPrice(q ? q.price : 150);
    setHalfEnabled(Boolean(h));
    setHalfPrice(h ? h.price : 180);
    setFullEnabled(Boolean(f));
    setFullPrice(f ? f.price : p.price || 320);

    setIsProductModalOpen(true);
  };

  // Toggle availability (In Stock / Out of Stock)
  const handleToggleStock = async (p: ProductItem) => {
    try {
      const res = await authFetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: p.id,
          isAvailable: !p.isAvailable,
        }),
      });
      if (!res.ok) throw new Error("Update failed");

      setProducts((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, isAvailable: !p.isAvailable } : item))
      );
      toast.success(`${p.name} marked ${!p.isAvailable ? "In Stock" : "Out of Stock"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update item availability");
    }
  };

  // Save product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodCategoryId) {
      toast.error("Please fill in item name and category.");
      return;
    }

    // Build portions array if enabled
    const portions: ProductPortion[] = [];
    if (hasPortions) {
      if (quarterEnabled) {
        portions.push({ id: "quarter", name: "Quarter", price: Number(quarterPrice), isAvailable: true });
      }
      if (halfEnabled) {
        portions.push({ id: "half", name: "Half", price: Number(halfPrice), isAvailable: true });
      }
      if (fullEnabled) {
        portions.push({ id: "full", name: "Full", price: Number(fullPrice), isAvailable: true });
      }
    }

    const calculatedPrice = hasPortions && portions.length > 0
      ? portions[portions.length - 1].price // default to highest/full
      : Number(prodBasePrice);

    try {
      if (editingProduct) {
        const res = await authFetch("/api/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingProduct.id,
            name: prodName,
            description: prodDescription,
            price: calculatedPrice,
            categoryId: prodCategoryId,
            isVeg: prodDietaryType === "veg",
            dietaryType: prodDietaryType,
            portions: portions.length > 0 ? portions : undefined,
            imageUrl: prodImageUrl,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setProducts((prev) =>
          prev.map((item) => (item.id === editingProduct.id ? data.product : item))
        );
        toast.success("Dish updated successfully!");
      } else {
        const res = await authFetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId: currentRestaurantId,
            categoryId: prodCategoryId,
            name: prodName,
            description: prodDescription,
            price: calculatedPrice,
            isVeg: prodDietaryType === "veg",
            dietaryType: prodDietaryType,
            portions: portions.length > 0 ? portions : undefined,
            imageUrl: prodImageUrl,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setProducts((prev) => [...prev, data.product]);
        toast.success("New dish added to menu!");
      }

      setIsProductModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save product.");
    }
  };

  // Save category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName) {
      toast.error("Please enter a category name.");
      return;
    }

    try {
      const res = await authFetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: currentRestaurantId,
          name: catName,
          description: catDescription,
          sortOrder: categories.length + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCategories((prev) => [...prev, data.category]);
      toast.success("New category added!");
      setIsCategoryModalOpen(false);
      setCatName("");
      setCatDescription("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create category");
    }
  };

  const filteredProducts = products.filter(
    (p) => selectedCatId === "all" || p.categoryId === selectedCatId
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            Menu Catalog
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            Product & Category Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure portion options (Quarter, Half, Full), dietary labels, and stock status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => setIsCategoryModalOpen(true)} className="flex-1 sm:flex-initial text-xs">
            <Layers className="h-4 w-4 mr-1.5" />
            Add Category
          </Button>
          <Button size="sm" onClick={openNewProduct} className="flex-1 sm:flex-initial text-xs font-semibold shadow-sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Dish / Item
          </Button>
        </div>
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
                Menu categories and food items are scoped to this restaurant venue.
              </p>
            </div>
          </div>

          {allRestaurants.length > 0 && (
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <label htmlFor="menu-venue-select" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Switch Venue:
              </label>
              <select
                id="menu-venue-select"
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

      {/* Category Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedCatId("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            selectedCatId === "all"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          All Dishes ({products.length})
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCatId(c.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              selectedCatId === c.id
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-card">
          <UtensilsCrossed className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No dishes in this category</h3>
          <p className="text-xs text-slate-500 mt-1">
            Add items with portion pricing (Quarter, Half, Full) to make your menu live.
          </p>
          <Button onClick={openNewProduct} size="sm" className="mt-4 font-semibold">
            <Plus className="h-4 w-4 mr-1.5" />
            Add First Dish
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((prod) => {
            const hasPortionsList = Boolean(prod.portions && prod.portions.length > 0);
            const diet = prod.dietaryType || (prod.isVeg ? "veg" : "non_veg");

            return (
              <div
                key={prod.id}
                className={`bg-white rounded-2xl border p-5 shadow-card hover:shadow-soft transition flex flex-col justify-between ${
                  !prod.isAvailable ? "border-slate-200 bg-slate-50/70" : "border-slate-200"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          diet === "veg"
                            ? "bg-emerald-600"
                            : diet === "egg"
                            ? "bg-amber-500"
                            : "bg-rose-600"
                        }`}
                        title={diet.toUpperCase()}
                      />
                      <h3 className="font-bold text-sm text-slate-900 truncate">{prod.name}</h3>
                    </div>

                    <span className="font-bold text-sm text-slate-900 shrink-0">
                      {formatCurrency(prod.price)}
                    </span>
                  </div>

                  {/* Portions summary badges */}
                  {hasPortionsList && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {prod.portions!.map((po) => (
                        <span
                          key={po.id}
                          className="text-[11px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md"
                        >
                          {po.name}: {formatCurrency(po.price)}
                        </span>
                      ))}
                    </div>
                  )}

                  {prod.imageUrl && (
                    <div className="w-full h-32 rounded-xl bg-slate-100 overflow-hidden mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {prod.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                  {/* Availability toggle */}
                  <button
                    onClick={() => handleToggleStock(prod)}
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold transition ${
                      prod.isAvailable
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                        : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                    }`}
                  >
                    {prod.isAvailable ? "In Stock" : "Sold Out"}
                  </button>

                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditProduct(prod)}
                      className="h-8 text-xs text-slate-600"
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? "Edit Menu Dish" : "Add New Dish"}
        description="Configure dish name, dietary classification, and portion pricing."
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dish Name *
            </label>
            <Input
              placeholder="e.g. Chicken Curry"
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category *
              </label>
              <select
                value={prodCategoryId}
                onChange={(e) => setProdCategoryId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Base Price (INR)
              </label>
              <Input
                type="number"
                min={0}
                value={prodBasePrice}
                onChange={(e) => setProdBasePrice(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Dietary Classification (Veg / Non-Veg / Egg) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Dietary Classification *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label
                className={`border rounded-lg p-2 flex items-center justify-center space-x-1.5 cursor-pointer text-xs font-semibold transition ${
                  prodDietaryType === "veg"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="dietaryType"
                  className="sr-only"
                  checked={prodDietaryType === "veg"}
                  onChange={() => setProdDietaryType("veg")}
                />
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>Veg</span>
              </label>

              <label
                className={`border rounded-lg p-2 flex items-center justify-center space-x-1.5 cursor-pointer text-xs font-semibold transition ${
                  prodDietaryType === "non_veg"
                    ? "border-rose-500 bg-rose-50 text-rose-800"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="dietaryType"
                  className="sr-only"
                  checked={prodDietaryType === "non_veg"}
                  onChange={() => setProdDietaryType("non_veg")}
                />
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <span>Non-Veg</span>
              </label>

              <label
                className={`border rounded-lg p-2 flex items-center justify-center space-x-1.5 cursor-pointer text-xs font-semibold transition ${
                  prodDietaryType === "egg"
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="dietaryType"
                  className="sr-only"
                  checked={prodDietaryType === "egg"}
                  onChange={() => setProdDietaryType("egg")}
                />
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Egg</span>
              </label>
            </div>
          </div>

          {/* Portion Configuration Section */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Portion Sizes (Quarter, Half, Full)
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Enable size options and their distinct pricing.
                </span>
              </div>
              <input
                type="checkbox"
                checked={hasPortions}
                onChange={(e) => setHasPortions(e.target.checked)}
                className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
              />
            </div>

            {hasPortions && (
              <div className="space-y-2.5 pt-2 border-t border-slate-200">
                {/* Quarter */}
                <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quarterEnabled}
                      onChange={(e) => setQuarterEnabled(e.target.checked)}
                      className="rounded text-brand-600"
                    />
                    <span>Quarter Portion</span>
                  </label>
                  {quarterEnabled && (
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs text-slate-500 font-semibold">₹</span>
                      <Input
                        type="number"
                        min={0}
                        value={quarterPrice}
                        onChange={(e) => setQuarterPrice(Number(e.target.value))}
                        className="h-7 w-24 text-xs font-bold"
                      />
                    </div>
                  )}
                </div>

                {/* Half */}
                <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={halfEnabled}
                      onChange={(e) => setHalfEnabled(e.target.checked)}
                      className="rounded text-brand-600"
                    />
                    <span>Half Portion</span>
                  </label>
                  {halfEnabled && (
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs text-slate-500 font-semibold">₹</span>
                      <Input
                        type="number"
                        min={0}
                        value={halfPrice}
                        onChange={(e) => setHalfPrice(Number(e.target.value))}
                        className="h-7 w-24 text-xs font-bold"
                      />
                    </div>
                  )}
                </div>

                {/* Full */}
                <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fullEnabled}
                      onChange={(e) => setFullEnabled(e.target.checked)}
                      className="rounded text-brand-600"
                    />
                    <span>Full Portion</span>
                  </label>
                  {fullEnabled && (
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs text-slate-500 font-semibold">₹</span>
                      <Input
                        type="number"
                        min={0}
                        value={fullPrice}
                        onChange={(e) => setFullPrice(Number(e.target.value))}
                        className="h-7 w-24 text-xs font-bold"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description & Preparation
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Melt-in-mouth cottage cheese cubes grilled with aromatic spices..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={prodDescription}
              onChange={(e) => setProdDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Image URL (Cloudinary / Unsplash)
            </label>
            <Input
              placeholder="https://images.unsplash.com/..."
              value={prodImageUrl}
              onChange={(e) => setProdImageUrl(e.target.value)}
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setIsProductModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingProduct ? "Save Changes" : "Create Dish"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Add Menu Category"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
            <Input
              placeholder="e.g. Sizzlers & Grills"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Short Description</label>
            <Input
              placeholder="e.g. Freshly tossed charcoal specialties"
              value={catDescription}
              onChange={(e) => setCatDescription(e.target.value)}
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setIsCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Category</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
