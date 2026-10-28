"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Utensils,
  AlertTriangle,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  MapPin,
  MapPinOff,
  Navigation,
  Check,
  CircleDot,
  Monitor,
  Smartphone,
  Wrench,
  Settings2,
  Activity,
  Info,
  RefreshCw,
} from "lucide-react";
import { useCart } from "@/context/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { calculateOrderBill } from "@/lib/services/billing";
import { verifyCustomerProximity, isDesktopCoarseLocation } from "@/lib/services/geo";
import {
  RestaurantProfile,
  ProductCategory,
  ProductItem,
  TableItem,
  DietaryClassification,
} from "@/lib/types";
import { toast } from "sonner";

interface Props {
  params: {
    restaurantSlug: string;
    tableCode: string;
  };
}

export default function CustomerQROrderingPage({ params }: Props) {
  const { restaurantSlug, tableCode } = params;
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [table, setTable] = useState<TableItem | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dietaryFilter, setDietaryFilter] = useState<"all" | DietaryClassification>("all");
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Portion Selection Modal State
  const [portionModalProduct, setPortionModalProduct] = useState<ProductItem | null>(null);
  const [selectedPortionId, setSelectedPortionId] = useState<string>("");
  const [portionQuantity, setPortionQuantity] = useState<number>(1);

  // Geolocation & Ordering Boundary State
  const [customerLocation, setCustomerLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    isSimulated?: boolean;
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    | "PROMPT"
    | "CHECKING"
    | "ALLOWED"
    | "DENIED"
    | "OUTSIDE"
    | "ACCURACY_TOO_POOR"
    | "ERROR"
    | "NOT_CONFIGURED"
    | "NOT_REQUIRED"
  >("PROMPT");
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [locationDistance, setLocationDistance] = useState<number | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationReasonCode, setLocationReasonCode] = useState<string>("");
  const [locationMessage, setLocationMessage] = useState<string>("");
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  // Development-Only Location Test Mode State
  const isDevEnvironment =
    process.env.NODE_ENV !== "production" ||
    (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"));

  const [testModeActive, setTestModeActive] = useState<boolean>(false);
  const [showSimulatorDrawer, setShowSimulatorDrawer] = useState<boolean>(false);
  const [customSimLat, setCustomSimLat] = useState<string>("");
  const [customSimLon, setCustomSimLon] = useState<string>("");
  const [customSimAcc, setCustomSimAcc] = useState<number>(10);

  const {
    items: cartItems,
    addItem,
    removeItem,
    updateQuantity,
    getItemQuantity,
    getProductTotalQuantity,
    clearCart,
    totalItemCount,
    customerNotes,
    setCustomerNotes,
  } = useCart();

  // Evaluate location coordinates against restaurant boundary
  const evaluateLocation = (
    coords: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      isSimulated?: boolean;
    },
    targetRest?: RestaurantProfile
  ) => {
    const currentRest = targetRest || restaurant;
    if (!currentRest) return;

    setCustomerLocation(coords);
    setLocationAccuracy(coords.accuracy ?? null);

    const result = verifyCustomerProximity({
      customerLat: coords.latitude,
      customerLon: coords.longitude,
      customerAccuracy: coords.accuracy,
      locationSettings: currentRest.locationSettings,
    });

    setLocationDistance(result.distanceMetres);
    setLocationReasonCode(result.reasonCode);
    setLocationMessage(result.message);

    if (result.allowed) {
      setLocationStatus("ALLOWED");
    } else if (result.reasonCode === "ACCURACY_TOO_POOR") {
      setLocationStatus("ACCURACY_TOO_POOR");
    } else if (result.reasonCode === "OUTSIDE_RADIUS") {
      setLocationStatus("OUTSIDE");
    } else {
      setLocationStatus("ERROR");
    }
  };

  // Trigger real browser GPS acquisition
  const requestLocation = (targetRest?: RestaurantProfile) => {
    const currentRest = targetRest || restaurant;
    if (!currentRest) return;

    if (!currentRest.locationSettings?.locationRestrictionEnabled) {
      setLocationStatus("NOT_REQUIRED");
      setShowLocationModal(false);
      return;
    }

    if (
      !currentRest.locationSettings.isConfigured ||
      currentRest.locationSettings.latitude === null ||
      currentRest.locationSettings.latitude === undefined ||
      currentRest.locationSettings.longitude === null ||
      currentRest.locationSettings.longitude === undefined
    ) {
      setLocationStatus("NOT_CONFIGURED");
      setLocationMessage(
        "Location-restricted ordering has not yet been configured by Vivexa Tech for this restaurant. Please contact restaurant staff."
      );
      setShowLocationModal(false);
      return;
    }

    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationStatus("ERROR");
      setLocationMessage("Geolocation is not supported by your browser.");
      setShowLocationModal(false);
      return;
    }

    setLocationStatus("CHECKING");
    setShowLocationModal(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPermissionGranted(true);
        evaluateLocation(
          {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            isSimulated: false,
          },
          currentRest
        );
      },
      (err) => {
        console.warn("[Geolocation Error]:", err);
        if (err.code === 1) {
          setPermissionGranted(false);
          setLocationStatus("DENIED");
          setLocationReasonCode("PERMISSION_DENIED");
          setLocationMessage(
            "Location permission is blocked. To order from this table, please allow location access in your browser address bar and tap Retry."
          );
        } else {
          setLocationStatus("ERROR");
          setLocationReasonCode("GEOLOCATION_ERROR");
          setLocationMessage(
            err.message || "Unable to acquire GPS location. Please check your signal and tap Retry."
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Simulator Presets (Development Only)
  const applySimulatedScenario = (scenario: "inside" | "near_edge" | "outside" | "desktop_ip" | "poor_accuracy" | "denied") => {
    if (!restaurant?.locationSettings) return;

    const restLat = restaurant.locationSettings.latitude || 26.8524;
    const restLon = restaurant.locationSettings.longitude || 75.8052;

    setTestModeActive(true);

    if (scenario === "inside") {
      // Table-side: ~10m from venue center, high precision
      evaluateLocation({
        latitude: restLat + 0.00009,
        longitude: restLon + 0.00009,
        accuracy: 5,
        isSimulated: true,
      });
      toast.success("Simulated Scenario: Inside Table (10m away, ±5m accuracy)");
    } else if (scenario === "near_edge") {
      // Near boundary: ~180m away from venue, within effective radius
      evaluateLocation({
        latitude: restLat + 0.0016,
        longitude: restLon,
        accuracy: 15,
        isSimulated: true,
      });
      toast.info("Simulated Scenario: Near Boundary (180m away, ±15m accuracy)");
    } else if (scenario === "outside") {
      // Outside radius: ~500m away
      evaluateLocation({
        latitude: restLat + 0.0045,
        longitude: restLon,
        accuracy: 10,
        isSimulated: true,
      });
      toast.warning("Simulated Scenario: Outside Radius (500m away, ±10m accuracy)");
    } else if (scenario === "desktop_ip") {
      // Coarse desktop browser on localhost (e.g. Delhi IP, ±50,000m)
      evaluateLocation({
        latitude: 28.5137,
        longitude: 77.2365,
        accuracy: 50000,
        isSimulated: true,
      });
      toast.error("Simulated Scenario: Coarse Desktop IP (Delhi, ±50,000m accuracy)");
    } else if (scenario === "poor_accuracy") {
      // Near venue, but device accuracy is coarse (e.g. ±250m)
      evaluateLocation({
        latitude: restLat + 0.001,
        longitude: restLon,
        accuracy: 250,
        isSimulated: true,
      });
      toast.warning("Simulated Scenario: Poor Device Accuracy (±250m near venue)");
    } else if (scenario === "denied") {
      setCustomerLocation(null);
      setLocationStatus("DENIED");
      setLocationReasonCode("PERMISSION_DENIED");
      setLocationMessage("Simulated: Location permission blocked by user.");
      toast.error("Simulated Scenario: Permission Denied");
    }
  };

  const applyCustomCoordinates = () => {
    const lat = parseFloat(customSimLat);
    const lon = parseFloat(customSimLon);
    const acc = Number(customSimAcc) || 10;

    if (isNaN(lat) || isNaN(lon)) {
      toast.error("Please enter valid decimal latitude and longitude.");
      return;
    }

    setTestModeActive(true);
    evaluateLocation({
      latitude: lat,
      longitude: lon,
      accuracy: acc,
      isSimulated: true,
    });
    toast.success(`Custom coordinates applied: ${lat}, ${lon} (±${acc}m)`);
  };

  const resetToRealDeviceGps = () => {
    setTestModeActive(false);
    toast.info("Reverting to real browser device GPS...");
    requestLocation();
  };

  useEffect(() => {
    async function loadQRMenu() {
      try {
        setLoading(true);
        // Fetch restaurant details
        const restRes = await fetch(`/api/restaurants`);
        const restData = await restRes.json();
        const foundRest = (restData.restaurants as RestaurantProfile[]).find(
          (r) => r.slug.toLowerCase() === restaurantSlug.toLowerCase()
        );

        if (!foundRest) {
          setErrorNotice("Restaurant not found.");
          setLoading(false);
          return;
        }

        // Check subscription & operational state
        if (!foundRest.operationalSettings?.isAcceptingOrders) {
          setErrorNotice("This restaurant is currently not accepting new orders.");
          setLoading(false);
          return;
        }

        setRestaurant(foundRest);

        // Pre-fill simulator lat/lon with restaurant coords
        if (foundRest.locationSettings?.latitude && foundRest.locationSettings?.longitude) {
          setCustomSimLat(foundRest.locationSettings.latitude.toString());
          setCustomSimLon(foundRest.locationSettings.longitude.toString());
        }

        // Geolocation initialization: Check permissions API if available
        if (foundRest.locationSettings?.locationRestrictionEnabled) {
          if (typeof navigator !== "undefined" && navigator.permissions && navigator.permissions.query) {
            navigator.permissions
              .query({ name: "geolocation" as PermissionName })
              .then((permissionStatus) => {
                if (permissionStatus.state === "granted") {
                  setPermissionGranted(true);
                  requestLocation(foundRest);
                } else if (permissionStatus.state === "denied") {
                  setPermissionGranted(false);
                  setLocationStatus("DENIED");
                  setLocationReasonCode("PERMISSION_DENIED");
                  setLocationMessage("Location permission is blocked in your browser settings.");
                } else {
                  // Prompt state -> show initial permission intro modal
                  setShowLocationModal(true);
                  setLocationStatus("PROMPT");
                }
              })
              .catch(() => {
                setShowLocationModal(true);
                setLocationStatus("PROMPT");
              });
          } else {
            setShowLocationModal(true);
            setLocationStatus("PROMPT");
          }
        } else {
          setLocationStatus("NOT_REQUIRED");
        }

        // Fetch tables for this restaurant
        const tableRes = await fetch(`/api/tables?restaurantId=${foundRest.id}`);
        const tableData = await tableRes.json();
        const foundTable = (tableData.tables as TableItem[]).find(
          (t) => t.code === tableCode || t.id === tableCode
        );

        if (!foundTable || !foundTable.isActive) {
          setErrorNotice("Invalid or deactivated table QR code. Please contact waitstaff.");
          setLoading(false);
          return;
        }

        setTable(foundTable);

        // Fetch categories & products
        const catRes = await fetch(`/api/categories?restaurantId=${foundRest.id}`);
        const catData = await catRes.json();
        setCategories(catData.categories || []);

        const prodRes = await fetch(`/api/products?restaurantId=${foundRest.id}`);
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);
      } catch (err: any) {
        setErrorNotice("Unable to load digital menu. Please check your internet connection.");
      } finally {
        setLoading(false);
      }
    }

    loadQRMenu();
  }, [restaurantSlug, tableCode]);

  // Filter products by category, search query, dietary filter
  const filteredProducts = products.filter((p) => {
    if (activeCategoryId !== "all" && p.categoryId !== activeCategoryId) return false;

    // Dietary filter
    if (dietaryFilter !== "all") {
      const itemDiet = p.dietaryType || (p.isVeg ? "veg" : "non_veg");
      if (itemDiet !== dietaryFilter) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    }
    return true;
  });

  // Backend preview bill calculation
  const billPreview = calculateOrderBill(cartItems, restaurant?.billingConfig);

  // Handle clicking "Add" on a product card
  const handleOpenAddPortion = (product: ProductItem) => {
    if (!product.isAvailable) return;

    if (product.portions && product.portions.length > 0) {
      const defaultPortion = product.portions.find((p) => p.isAvailable) || product.portions[0];
      setPortionModalProduct(product);
      setSelectedPortionId(defaultPortion.id);
      setPortionQuantity(1);
    } else {
      addItem(product, undefined, 1);
      toast.success(`Added ${product.name} to cart`);
    }
  };

  // Confirm portion selection and add to cart
  const handleConfirmPortion = () => {
    if (!portionModalProduct) return;

    const portion = portionModalProduct.portions?.find((p) => p.id === selectedPortionId);
    if (!portion || !portion.isAvailable) {
      toast.error("Please select an available portion.");
      return;
    }

    addItem(portionModalProduct, portion, portionQuantity);
    toast.success(`Added ${portionModalProduct.name} (${portion.name}) × ${portionQuantity}`);
    setPortionModalProduct(null);
  };

  // Submit Order to backend
  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      toast.error("Your cart is empty. Please select food items.");
      return;
    }

    // Geolocation enforcement gate - DO NOT loop permission modal if permission was already granted!
    if (
      locationStatus === "OUTSIDE" ||
      locationStatus === "DENIED" ||
      locationStatus === "ACCURACY_TOO_POOR" ||
      locationStatus === "NOT_CONFIGURED" ||
      locationStatus === "ERROR" ||
      locationStatus === "PROMPT"
    ) {
      if (locationStatus === "PROMPT") {
        setShowLocationModal(true);
      } else if (locationStatus === "ACCURACY_TOO_POOR") {
        toast.error("Approximate desktop location detected. High-accuracy mobile GPS presence is required to place your order.");
      } else if (locationStatus === "DENIED") {
        toast.error("Location permission is blocked. Please allow location in your browser address bar.");
      } else if (locationStatus === "OUTSIDE") {
        toast.error(locationMessage || "You are outside the authorized dining radius for this restaurant.");
      } else {
        toast.error(locationMessage || "Location verification is required to place your order.");
      }
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug,
          tableCode,
          items: cartItems.map((i) => ({
            productId: i.productId,
            name: i.name,
            portionId: i.portionId,
            portionName: i.portionName,
            quantity: i.quantity,
          })),
          customerNotes,
          customerLocation: customerLocation
            ? {
                latitude: customerLocation.latitude,
                longitude: customerLocation.longitude,
                accuracy: customerLocation.accuracy,
                isSimulated: Boolean(customerLocation.isSimulated),
              }
            : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.reasonCode) {
          setLocationReasonCode(data.reasonCode);
          if (data.reasonCode === "OUTSIDE_RADIUS") {
            setLocationStatus("OUTSIDE");
          } else if (data.reasonCode === "ACCURACY_TOO_POOR") {
            setLocationStatus("ACCURACY_TOO_POOR");
          } else if (data.reasonCode === "NOT_CONFIGURED") {
            setLocationStatus("NOT_CONFIGURED");
          } else {
            setLocationStatus("ERROR");
          }
          setLocationMessage(data.error || "Location verification failed.");
        }
        throw new Error(data.error || "Failed to submit order");
      }

      clearCart();
      setCartOpen(false);
      toast.success(`Order ${data.orderNumber} placed successfully!`);
      router.push(`/order/${restaurantSlug}/${tableCode}/order-status?orderId=${data.orderId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to place order.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Helper for dietary dot badge
  const renderDietaryBadge = (diet?: DietaryClassification, isVegFallback: boolean = true) => {
    const d = diet || (isVegFallback ? "veg" : "non_veg");
    if (d === "veg") {
      return (
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded border border-emerald-600 bg-white p-0.5 shrink-0"
          title="Vegetarian"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-600" />
        </span>
      );
    }
    if (d === "egg") {
      return (
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded border border-amber-600 bg-white p-0.5 shrink-0"
          title="Contains Egg"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded border border-rose-600 bg-white p-0.5 shrink-0"
        title="Non-Vegetarian"
      >
        <span className="w-2 h-2 rounded-full bg-rose-600" />
      </span>
    );
  };

  const isCoarseDesktop = isDesktopCoarseLocation(locationAccuracy);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-600">Loading digital menu...</p>
      </div>
    );
  }

  if (errorNotice || !restaurant || !table) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="max-w-sm bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">QR Ordering Notice</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{errorNotice}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="w-full">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center">
      {/* Mobile-first container max-w-md */}
      <div className="w-full max-w-md bg-white min-h-screen shadow-xl flex flex-col relative pb-28">
        
        {/* EXPLICIT TEST MODE RIBBON (WHEN SIMULATION IS ACTIVE IN DEV) */}
        {testModeActive && (
          <div className="bg-gradient-to-r from-amber-500 via-purple-600 to-amber-500 text-white text-[11px] font-bold py-1.5 px-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
            <div className="flex items-center space-x-1.5 truncate">
              <Wrench className="h-3.5 w-3.5 shrink-0" />
              <span className="tracking-wide uppercase truncate">
                DEV TEST MODE: Simulated Coordinates Active
              </span>
            </div>
            <button
              onClick={() => setShowSimulatorDrawer(!showSimulatorDrawer)}
              className="bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded text-[10px] font-mono shrink-0 ml-2"
            >
              {showSimulatorDrawer ? "Hide Controls" : "Controls"}
            </button>
          </div>
        )}

        {/* Sticky Mobile Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0">
              {restaurant.branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={restaurant.branding.logoUrl}
                  alt=""
                  className="w-9 h-9 rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-brand-500 text-white font-bold flex items-center justify-center text-sm">
                  {restaurant.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-slate-900 truncate font-display">
                  {restaurant.name}
                </h1>
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                  <span className="font-semibold text-brand-600">{table.displayLabel}</span>
                  <span>•</span>
                  <span>Dine-In Menu</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Development Mode Simulator Button */}
              {isDevEnvironment && (
                <button
                  onClick={() => setShowSimulatorDrawer(!showSimulatorDrawer)}
                  className={`p-2 rounded-xl text-xs font-semibold flex items-center space-x-1 transition border ${
                    testModeActive
                      ? "bg-purple-100 border-purple-300 text-purple-900 font-bold"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200"
                  }`}
                  title="Developer Location Test Simulator"
                >
                  <Wrench className="h-4 w-4" />
                </button>
              )}

              {/* Cart trigger button in header */}
              <button
                onClick={() => setCartOpen(true)}
                className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                aria-label="View Cart"
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center shadow-sm">
                    {totalItemCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-2.5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-xs bg-slate-50 rounded-lg w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 4 Dietary Filter Pills (All, Veg, Non-Veg, Egg) */}
          <div className="mt-2 flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setDietaryFilter("all")}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                dietaryFilter === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setDietaryFilter("veg")}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition border flex items-center space-x-1.5 ${
                dietaryFilter === "veg"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              <span>Veg</span>
            </button>
            <button
              onClick={() => setDietaryFilter("non_veg")}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition border flex items-center space-x-1.5 ${
                dietaryFilter === "non_veg"
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
              <span>Non-Veg</span>
            </button>
            <button
              onClick={() => setDietaryFilter("egg")}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition border flex items-center space-x-1.5 ${
                dietaryFilter === "egg"
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white" />
              <span>Egg</span>
            </button>
          </div>

          {/* Horizontally scrollable Category Tabs */}
          <div className="mt-2 flex space-x-2 overflow-x-auto no-scrollbar py-1 border-t border-slate-100 pt-2">
            <button
              onClick={() => setActiveCategoryId("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                activeCategoryId === "all"
                  ? "bg-brand-500 text-white font-bold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  activeCategoryId === cat.id
                    ? "bg-brand-500 text-white font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </header>

        {/* DEVELOPER LOCATION SIMULATOR PANEL (DEVELOPMENT ONLY) */}
        {isDevEnvironment && showSimulatorDrawer && (
          <div className="bg-slate-900 text-white p-4 border-b border-purple-500/50 space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Wrench className="h-4 w-4 text-purple-400" />
                <span className="font-bold text-purple-300 font-mono tracking-tight uppercase">
                  Developer Location Simulator
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-purple-400 text-purple-300">
                Localhost Dev Mode
              </Badge>
            </div>

            <p className="text-[11px] text-slate-400 leading-snug">
              Simulate customer coordinates to test Haversine boundary enforcement, coarse desktop IP detection, and order authorization.
            </p>

            {/* Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Quick Scenario Presets
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applySimulatedScenario("inside")}
                  className="h-7 text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-400 border-emerald-800/60 justify-start"
                >
                  <MapPin className="h-3 w-3 mr-1 text-emerald-400" />
                  Inside Table (10m, ±5m)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applySimulatedScenario("near_edge")}
                  className="h-7 text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-300 border-emerald-900/60 justify-start"
                >
                  <MapPin className="h-3 w-3 mr-1 text-emerald-300" />
                  Near Edge (180m, ±15m)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applySimulatedScenario("outside")}
                  className="h-7 text-[10px] bg-slate-800 hover:bg-slate-700 text-rose-400 border-rose-900/60 justify-start"
                >
                  <AlertTriangle className="h-3 w-3 mr-1 text-rose-400" />
                  Outside (500m, ±10m)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applySimulatedScenario("desktop_ip")}
                  className="h-7 text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-900/60 justify-start"
                >
                  <Monitor className="h-3 w-3 mr-1 text-amber-400" />
                  Coarse Desktop (±50km)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applySimulatedScenario("poor_accuracy")}
                  className="h-7 text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-900/60 justify-start"
                >
                  <Activity className="h-3 w-3 mr-1 text-amber-400" />
                  Poor Accuracy (±250m)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applySimulatedScenario("denied")}
                  className="h-7 text-[10px] bg-slate-800 hover:bg-slate-700 text-red-400 border-red-900/60 justify-start"
                >
                  <MapPinOff className="h-3 w-3 mr-1 text-red-400" />
                  Simulate Denied GPS
                </Button>
              </div>
            </div>

            {/* Custom Coordinates Stepper */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Custom Coordinates & Accuracy
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Latitude</span>
                  <Input
                    value={customSimLat}
                    onChange={(e) => setCustomSimLat(e.target.value)}
                    placeholder="26.8524"
                    className="h-7 text-[11px] bg-slate-800 border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Longitude</span>
                  <Input
                    value={customSimLon}
                    onChange={(e) => setCustomSimLon(e.target.value)}
                    placeholder="75.8052"
                    className="h-7 text-[11px] bg-slate-800 border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Accuracy (m)</span>
                  <Input
                    type="number"
                    value={customSimAcc}
                    onChange={(e) => setCustomSimAcc(Number(e.target.value))}
                    className="h-7 text-[11px] bg-slate-800 border-slate-700 text-white font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <Button
                  size="sm"
                  onClick={applyCustomCoordinates}
                  className="h-7 text-[10px] bg-purple-600 hover:bg-purple-700 font-bold"
                >
                  Apply Custom
                </Button>
                {testModeActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetToRealDeviceGps}
                    className="h-7 text-[10px] text-slate-300 border-slate-700 hover:bg-slate-800"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Revert to Real GPS
                  </Button>
                )}
              </div>
            </div>

            {/* Live Diagnostics Card */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 font-mono text-[10px]">
              <div className="flex justify-between text-slate-400">
                <span>SIMULATION STATUS:</span>
                <span className={testModeActive ? "text-amber-400 font-bold" : "text-slate-400"}>
                  {testModeActive ? "ACTIVE (SIMULATED)" : "OFF (REAL DEVICE)"}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>REPORTED COORDS:</span>
                <span className="text-white truncate max-w-[190px]">
                  {customerLocation ? `${customerLocation.latitude.toFixed(4)}, ${customerLocation.longitude.toFixed(4)}` : "None"}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>REPORTED ACCURACY:</span>
                <span className={isCoarseDesktop ? "text-amber-400 font-bold" : "text-white"}>
                  {customerLocation?.accuracy ? `±${customerLocation.accuracy}m` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>RESTAURANT TARGET:</span>
                <span className="text-white">
                  {restaurant.locationSettings?.latitude?.toFixed(4)}, {restaurant.locationSettings?.longitude?.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>CONFIGURED RADIUS:</span>
                <span className="text-white">
                  {restaurant.locationSettings?.orderingRadiusMetres}m (tolerance: +15m)
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>CALCULATED DISTANCE:</span>
                <span className="text-brand-400 font-bold">
                  {locationDistance !== null ? `${locationDistance}m` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>RESULT / REASON:</span>
                <span className="text-purple-300 font-bold truncate max-w-[190px]">
                  {locationReasonCode || locationStatus}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-1 mt-1">
                <span>PROD BACKEND GUARD:</span>
                <span className="text-emerald-400">ENFORCED (403 in prod)</span>
              </div>
            </div>
          </div>
        )}

        {/* Location Security Status Banners */}
        {restaurant.locationSettings?.locationRestrictionEnabled && (
          <div>
            {locationStatus === "CHECKING" && (
              <div className="bg-slate-900 text-white text-xs px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3.5 h-3.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-[11px] font-medium">Verifying location proximity at {restaurant.name}...</span>
                </div>
              </div>
            )}

            {locationStatus === "ALLOWED" && (
              <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center space-x-1.5 min-w-0">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="font-semibold truncate">
                    {testModeActive ? "Location verified (Simulated Test Mode)." : "You're physically at the restaurant."}
                  </span>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ml-2">
                  {testModeActive ? "Test Verified" : "Verified"}
                </span>
              </div>
            )}

            {/* DEDICATED APPROXIMATE DESKTOP LOCATION EXPLANATION CARD (REQUIREMENT 2 & 3) */}
            {(locationStatus === "ACCURACY_TOO_POOR" || (locationStatus === "OUTSIDE" && isCoarseDesktop)) && (
              <div className="bg-amber-50 border-b border-amber-300 p-4 text-xs text-amber-900 space-y-2.5">
                <div className="flex items-start space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                    <Monitor className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold block text-slate-900 text-xs">
                      Approximate Desktop Location Detected
                    </span>
                    <span className="text-[11px] text-amber-800 block mt-0.5 leading-relaxed">
                      Location permission is <strong>granted</strong>, but your browser returned an approximate network IP location (accuracy: <strong>±{locationAccuracy ? Math.round(locationAccuracy > 1000 ? locationAccuracy / 1000 : locationAccuracy) + (locationAccuracy > 1000 ? "km" : "m") : "50km"}</strong>) rather than high-precision GPS.
                    </span>
                  </div>
                </div>

                <div className="bg-amber-100/70 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <Smartphone className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                    <span>How dining table ordering works:</span>
                  </div>
                  <p className="text-amber-800 leading-snug">
                    Table ordering requires high-accuracy satellite GPS within {restaurant.locationSettings?.orderingRadiusMetres}m to confirm you are seated at this table. Desktop PCs without GPS chips cannot provide this level of accuracy.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => requestLocation()}
                    className="h-7 text-[11px] border-amber-300 hover:bg-amber-100 text-amber-900"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry Device GPS
                  </Button>

                  {isDevEnvironment && !testModeActive && (
                    <Button
                      size="sm"
                      onClick={() => applySimulatedScenario("inside")}
                      className="h-7 text-[11px] bg-purple-600 hover:bg-purple-700 text-white font-bold"
                    >
                      <Wrench className="h-3 w-3 mr-1" />
                      Enable Test Mode
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Standard Outside Radius (when accuracy is normal GPS but user is physically elsewhere) */}
            {locationStatus === "OUTSIDE" && !isCoarseDesktop && (
              <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex items-start justify-between text-xs text-rose-900">
                <div className="flex items-start space-x-2 min-w-0">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Outside Permitted Ordering Area</span>
                    <span className="text-[11px] text-rose-700 leading-tight block mt-0.5">
                      {locationMessage || `You are ${locationDistance}m away from the restaurant (allowed within ${restaurant.locationSettings?.orderingRadiusMetres}m).`}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => requestLocation()}
                  className="h-7 text-[11px] shrink-0 ml-2 border-rose-300 hover:bg-rose-100"
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Permission Denied Notice */}
            {locationStatus === "DENIED" && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-start justify-between text-xs text-amber-900">
                <div className="flex items-start space-x-2 min-w-0">
                  <MapPinOff className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Location Permission Required</span>
                    <span className="text-[11px] text-amber-700 leading-tight block mt-0.5">
                      RestroCharge needs your location to ensure orders are placed inside the restaurant. Click the lock/settings icon in your browser address bar to allow location.
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => requestLocation()}
                  className="h-7 text-[11px] shrink-0 ml-2 border-amber-300 hover:bg-amber-100"
                >
                  Retry
                </Button>
              </div>
            )}

            {locationStatus === "NOT_CONFIGURED" && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center space-x-2 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-[11px] font-medium leading-tight">
                  Restaurant location is pending configuration by Vivexa Tech. Please contact staff.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Product Cards List */}
        <main className="p-4 space-y-3 flex-1">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Utensils className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium">No dishes match your filter.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDietaryFilter("all");
                  setActiveCategoryId("all");
                  setSearchQuery("");
                }}
                className="mt-3 text-xs text-brand-600"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const productTotalQty = getProductTotalQuantity(prod.id);
              const hasPortions = Boolean(prod.portions && prod.portions.length > 0);
              const minPrice = hasPortions
                ? Math.min(...prod.portions!.map((p) => p.price))
                : prod.price;

              return (
                <div
                  key={prod.id}
                  className={`p-3 rounded-xl border bg-white shadow-sm flex items-start justify-between gap-3 transition ${
                    !prod.isAvailable ? "opacity-60 bg-slate-50" : "hover:border-slate-300"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      {renderDietaryBadge(prod.dietaryType, prod.isVeg)}
                      <h3 className="font-semibold text-xs text-slate-900 truncate">
                        {prod.name}
                      </h3>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-2">
                      {prod.description}
                    </p>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-extrabold text-slate-900">
                        {hasPortions && prod.portions!.length > 1
                          ? `From ${formatCurrency(minPrice)}`
                          : formatCurrency(prod.price)}
                      </span>
                      {hasPortions && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-1.5 py-0.5 rounded">
                          {prod.portions!.map((p) => p.name).join("/")}
                        </span>
                      )}
                      {!prod.isAvailable && (
                        <span className="text-[10px] text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded">
                          Sold Out
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: Image & Action CTA */}
                  <div className="flex flex-col items-end shrink-0 space-y-2">
                    {prod.imageUrl && (
                      <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {prod.isAvailable && (
                      <div>
                        {productTotalQty > 0 && !hasPortions ? (
                          <div className="inline-flex items-center border border-brand-500 rounded-lg bg-brand-50 text-brand-700 h-8 px-1 shadow-sm">
                            <button
                              onClick={() => updateQuantity(prod.id, undefined, productTotalQty - 1)}
                              className="p-1 hover:bg-brand-100 rounded text-brand-700"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold">
                              {productTotalQty}
                            </span>
                            <button
                              onClick={() => updateQuantity(prod.id, undefined, productTotalQty + 1)}
                              className="p-1 hover:bg-brand-100 rounded text-brand-700"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenAddPortion(prod)}
                            className="h-8 px-3 rounded-lg bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 text-xs font-bold flex items-center space-x-1 shadow-sm transition"
                          >
                            <Plus className="h-3 w-3" />
                            <span>{productTotalQty > 0 ? `ADD (${productTotalQty})` : "ADD"}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </main>

        {/* Floating Bottom Cart Bar */}
        {totalItemCount > 0 && (
          <div className="fixed bottom-0 max-w-md w-full bg-white border-t border-slate-200 p-3 shadow-2xl z-20 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 block">
                {totalItemCount} {totalItemCount === 1 ? "item" : "items"} selected
              </span>
              <span className="text-base font-extrabold text-slate-900">
                {formatCurrency(billPreview.finalTotal)}
              </span>
            </div>

            <Button
              onClick={() => setCartOpen(true)}
              className="font-bold px-6 shadow-md"
            >
              <span>View Cart</span>
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        )}

        {/* Portion Selection Bottom Sheet Modal */}
        {portionModalProduct && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-end p-0">
            <div className="bg-white w-full max-w-md rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-100 flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  {renderDietaryBadge(portionModalProduct.dietaryType, portionModalProduct.isVeg)}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 font-display">
                      {portionModalProduct.name}
                    </h3>
                    <p className="text-xs text-slate-500">Select portion & quantity</p>
                  </div>
                </div>
                <button
                  onClick={() => setPortionModalProduct(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Portions Radio Options */}
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                <span className="text-xs font-semibold text-slate-700 block uppercase tracking-wider">
                  Portion Size
                </span>

                <div className="space-y-2">
                  {portionModalProduct.portions?.map((portion) => {
                    const isSelected = selectedPortionId === portion.id;
                    return (
                      <label
                        key={portion.id}
                        onClick={() => portion.isAvailable && setSelectedPortionId(portion.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                          !portion.isAvailable
                            ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200"
                            : isSelected
                            ? "border-brand-500 bg-brand-50/50 shadow-sm"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? "border-brand-500 bg-brand-500"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              {portion.name}
                            </span>
                            {portion.description && (
                              <span className="text-[11px] text-slate-500 block">
                                {portion.description}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-extrabold text-slate-900">
                            {formatCurrency(portion.price)}
                          </span>
                          {!portion.isAvailable && (
                            <span className="text-[10px] text-red-600 block font-semibold">
                              Sold Out
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Quantity Stepper */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Quantity</span>
                  <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50 h-8 px-1">
                    <button
                      onClick={() => setPortionQuantity((q) => Math.max(1, q - 1))}
                      className="p-1 hover:bg-slate-200 rounded text-slate-600"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-slate-900">
                      {portionQuantity}
                    </span>
                    <button
                      onClick={() => setPortionQuantity((q) => Math.min(20, q + 1))}
                      className="p-1 hover:bg-slate-200 rounded text-slate-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="p-4 border-t border-slate-100 bg-white">
                {(() => {
                  const currentPortion = portionModalProduct.portions?.find(
                    (p) => p.id === selectedPortionId
                  );
                  const subtotal = currentPortion
                    ? currentPortion.price * portionQuantity
                    : portionModalProduct.price * portionQuantity;

                  return (
                    <Button
                      onClick={handleConfirmPortion}
                      disabled={!currentPortion || !currentPortion.isAvailable}
                      className="w-full font-bold shadow-md"
                      size="lg"
                    >
                      <span>Add to Cart</span>
                      <span className="ml-2">• {formatCurrency(subtotal)}</span>
                    </Button>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Immediate Location Permission Modal (First Time Opening Only) */}
        {showLocationModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto">
                <MapPin className="h-6 w-6" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Enable Location to Order
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  To ensure you&apos;re ordering from the correct table at{" "}
                  <strong>{restaurant.name}</strong>, RestroCharge requires access to your current location.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  onClick={() => requestLocation()}
                  className="w-full font-bold shadow-sm"
                >
                  <Navigation className="h-4 w-4 mr-1.5" />
                  Enable Location
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLocationModal(false)}
                  className="w-full text-xs text-slate-500 hover:text-slate-800"
                >
                  Browse Menu Only
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Cart Bottom Sheet / Slide-over Modal */}
        {cartOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-display">
                    Review Your Order
                  </h2>
                  <p className="text-xs text-slate-500">{table.displayLabel}</p>
                </div>
                <button
                  onClick={() => setCartOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Items List */}
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {cartItems.map((item) => (
                  <div
                    key={`${item.productId}_${item.portionId || "def"}`}
                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                  >
                    <div className="flex-1 pr-3">
                      <div className="flex items-center space-x-1.5">
                        {renderDietaryBadge(item.dietaryType, item.isVeg)}
                        <h4 className="text-xs font-semibold text-slate-900">
                          {item.name}
                        </h4>
                      </div>
                      <span className="text-xs font-bold text-slate-700 mt-1 block">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>

                    <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50 h-7 px-1">
                      <button
                        onClick={() => updateQuantity(item.productId, item.portionId, item.quantity - 1)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-bold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.portionId, item.quantity + 1)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Special Instructions */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Special Kitchen Instructions (Optional)
                  </label>
                  <Input
                    placeholder="e.g. Less spicy, no coriander, extra napkins"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    className="text-xs"
                    maxLength={200}
                  />
                </div>

                {/* Bill Breakdown */}
                <div className="bg-slate-50 rounded-xl p-3.5 space-y-1.5 text-xs text-slate-600 border border-slate-200/80 mt-4">
                  <div className="flex justify-between">
                    <span>Item Subtotal</span>
                    <span>{formatCurrency(billPreview.subtotal)}</span>
                  </div>

                  {billPreview.serviceChargeEnabled && (
                    <div className="flex justify-between">
                      <span>Service Charge ({billPreview.serviceChargeRate}%)</span>
                      <span>{formatCurrency(billPreview.serviceChargeAmount)}</span>
                    </div>
                  )}

                  {billPreview.gstEnabled && (
                    <div className="flex justify-between">
                      <span>GST / Taxes ({billPreview.gstRate}%)</span>
                      <span>{formatCurrency(billPreview.gstAmount)}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-2 flex justify-between font-extrabold text-slate-900 text-sm">
                    <span>Total Payable</span>
                    <span className="text-brand-600 font-display">
                      {formatCurrency(billPreview.finalTotal)}
                    </span>
                  </div>
                </div>

                {/* Geolocation Warning in Cart if not allowed */}
                {restaurant.locationSettings?.locationRestrictionEnabled &&
                  locationStatus !== "ALLOWED" &&
                  locationStatus !== "NOT_REQUIRED" && (
                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-800 space-y-2">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block">Physical Presence Required</strong>
                          <span className="text-[11px] text-rose-700 block mt-0.5 leading-snug">
                            {locationStatus === "ACCURACY_TOO_POOR"
                              ? "Approximate desktop location detected. Please open on a mobile phone with GPS enabled to confirm dining room presence."
                              : locationStatus === "OUTSIDE"
                              ? `You are outside the restaurant's ordering boundary (${locationDistance}m away, permitted within ${restaurant.locationSettings?.orderingRadiusMetres}m).`
                              : locationStatus === "DENIED"
                              ? "Location access is blocked in your browser. Please allow location permissions to submit."
                              : locationMessage || "GPS proximity verification is required before placing your order."}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => requestLocation()}
                          className="w-full text-xs h-7 border-rose-300"
                        >
                          <Navigation className="h-3 w-3 mr-1" />
                          Recheck GPS
                        </Button>
                        {isDevEnvironment && !testModeActive && (
                          <Button
                            size="sm"
                            onClick={() => applySimulatedScenario("inside")}
                            className="w-full text-xs h-7 bg-purple-600 text-white font-bold"
                          >
                            <Wrench className="h-3 w-3 mr-1" />
                            Use Dev Simulator
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                {/* Direct Dining Settlement Notice */}
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-[11px] text-amber-900 leading-snug">
                  <strong>Direct Dining Settlement:</strong> RestroCharge calculates your food bill only. Please pay the restaurant directly at the counter or to your table waiter. No online transaction required.
                </div>
              </div>

              {/* Submit CTA */}
              <div className="p-4 border-t border-slate-100 bg-white space-y-2">
                {testModeActive && (
                  <div className="text-center">
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-mono font-bold px-2 py-0.5 rounded">
                      DEV TEST MODE: Simulated Coordinates Active
                    </span>
                  </div>
                )}
                <Button
                  onClick={handlePlaceOrder}
                  disabled={
                    restaurant.locationSettings?.locationRestrictionEnabled &&
                    locationStatus !== "ALLOWED" &&
                    locationStatus !== "NOT_REQUIRED"
                  }
                  isLoading={isSubmittingOrder}
                  size="lg"
                  className="w-full font-bold shadow-md"
                >
                  {restaurant.locationSettings?.locationRestrictionEnabled &&
                  locationStatus !== "ALLOWED" &&
                  locationStatus !== "NOT_REQUIRED"
                    ? locationStatus === "ACCURACY_TOO_POOR"
                      ? "Precise Mobile GPS Required"
                      : locationStatus === "OUTSIDE"
                      ? "Outside Ordering Area"
                      : locationStatus === "DENIED"
                      ? "Location Permission Blocked"
                      : "Verifying Proximity..."
                    : `Place Order (${formatCurrency(billPreview.finalTotal)})`}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
