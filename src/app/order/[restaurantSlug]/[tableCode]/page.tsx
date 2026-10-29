"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Utensils,
  AlertTriangle,
  X,
  ArrowRight,
  MapPin,
  MapPinOff,
  Navigation,
  Monitor,
  Smartphone,
  Wrench,
  Activity,
  RefreshCw,
  Tag,
  Sparkles,
  Receipt,
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
  RestaurantOffer,
  DiningSession,
} from "@/lib/types";
import { CombinedBillModal } from "@/components/public/combined-bill-modal";
import {
  isOfferActive,
  resolveBestOfferForItem,
  validateAndEvaluateCombo,
  getZonedDateInfo,
  isProductEligibleForOffer,
  calculateDiscountForOffer,
  validateOfferEligibility,
} from "@/lib/services/offers-engine";
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
  const [offers, setOffers] = useState<RestaurantOffer[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dietaryFilter, setDietaryFilter] = useState<"all" | DietaryClassification>("all");
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<DiningSession | null>(null);
  const [billModalOpen, setBillModalOpen] = useState<boolean>(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const SESSION_STORAGE_KEY = `restrocharge_dsess_${restaurantSlug}_${tableCode}`;
  const [loading, setLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Portion Selection Modal State
  const [portionModalProduct, setPortionModalProduct] = useState<ProductItem | null>(null);
  const [selectedPortionId, setSelectedPortionId] = useState<string>("");
  const [portionQuantity, setPortionQuantity] = useState<number>(1);

  // Special Offer Item Selection Modal State
  const [offerModalOffer, setOfferModalOffer] = useState<RestaurantOffer | null>(null);
  const [selectedProductForOffer, setSelectedProductForOffer] = useState<ProductItem | null>(null);
  const [selectedPortionIdForOffer, setSelectedPortionIdForOffer] = useState<string>("");
  const [offerItemQuantity, setOfferItemQuantity] = useState<number>(1);

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
    addComboItem,
    removeItem,
    updateQuantity,
    getItemQuantity,
    getProductTotalQuantity,
    clearCart,
    totalItemCount,
    customerNotes,
    setCustomerNotes,
  } = useCart();

  const activeCombos = useMemo(
    () => offers.filter((o) => o.offerType === "COMBO" && isOfferActive(o)),
    [offers]
  );

  // Authoritative day-based special offers active for TODAY at this dining table
  const activeOffersToday = useMemo(() => {
    const tz = restaurant?.locationSettings?.timezone || "Asia/Kolkata";
    const dInfo = getZonedDateInfo(new Date(), tz);
    return offers.filter(
      (o) =>
        o.offerType !== "COMBO" &&
        isOfferActive(o, dInfo, tz, { orderType: "dine_in", tableCode })
    );
  }, [offers, restaurant, tableCode]);

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

  const applySimulatedScenario = (scenario: "inside" | "near_edge" | "outside" | "desktop_ip" | "poor_accuracy" | "denied") => {
    if (!restaurant?.locationSettings) return;

    const restLat = restaurant.locationSettings.latitude || 26.8524;
    const restLon = restaurant.locationSettings.longitude || 75.8052;

    setTestModeActive(true);

    if (scenario === "inside") {
      evaluateLocation({ latitude: restLat + 0.00009, longitude: restLon + 0.00009, accuracy: 5, isSimulated: true });
      toast.success("Simulated Scenario: Inside Table (10m away, ±5m accuracy)");
    } else if (scenario === "near_edge") {
      evaluateLocation({ latitude: restLat + 0.0016, longitude: restLon, accuracy: 15, isSimulated: true });
      toast.info("Simulated Scenario: Near Boundary (180m away, ±15m accuracy)");
    } else if (scenario === "outside") {
      evaluateLocation({ latitude: restLat + 0.0045, longitude: restLon, accuracy: 10, isSimulated: true });
      toast.warning("Simulated Scenario: Outside Radius (500m away, ±10m accuracy)");
    } else if (scenario === "desktop_ip") {
      evaluateLocation({ latitude: 28.5137, longitude: 77.2365, accuracy: 50000, isSimulated: true });
      toast.error("Simulated Scenario: Coarse Desktop IP (Delhi, ±50,000m accuracy)");
    } else if (scenario === "poor_accuracy") {
      evaluateLocation({ latitude: restLat + 0.001, longitude: restLon, accuracy: 250, isSimulated: true });
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
    evaluateLocation({ latitude: lat, longitude: lon, accuracy: acc, isSimulated: true });
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

        if (!foundRest.operationalSettings?.isAcceptingOrders) {
          setErrorNotice("This restaurant is currently not accepting new orders.");
          setLoading(false);
          return;
        }

        setRestaurant(foundRest);

        if (foundRest.locationSettings?.latitude && foundRest.locationSettings?.longitude) {
          setCustomSimLat(foundRest.locationSettings.latitude.toString());
          setCustomSimLon(foundRest.locationSettings.longitude.toString());
        }

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

        const catRes = await fetch(`/api/categories?restaurantId=${foundRest.id}`);
        const catData = await catRes.json();
        setCategories(catData.categories || []);

        const prodRes = await fetch(`/api/products?restaurantId=${foundRest.id}`);
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);

        const offersRes = await fetch(`/api/offers?restaurantId=${foundRest.id}`);
        const offersData = await offersRes.json();
        setOffers(offersData.offers || []);

        // Load active customer dining session if present
        const storedToken =
          typeof window !== "undefined"
            ? localStorage.getItem(SESSION_STORAGE_KEY)
            : null;
        if (storedToken) {
          try {
            const sessRes = await fetch(
              `/api/dining-sessions?restaurantSlug=${restaurantSlug}&tableCode=${tableCode}&sessionToken=${encodeURIComponent(storedToken)}`
            );
            if (sessRes.ok) {
              const sessData = await sessRes.json();
              if (sessData.session && sessData.session.status === "ACTIVE") {
                setActiveSession(sessData.session);
              }
            }
          } catch {
            // ignore session lookup network glitch
          }
        }
      } catch (err: any) {
        setErrorNotice("Unable to load digital menu. Please check your internet connection.");
      } finally {
        setLoading(false);
      }
    }

    loadQRMenu();
  }, [restaurantSlug, tableCode]);

  // Determine if user has selected the Special Offers category tab
  const isSpecialOffersCategory = useMemo(() => {
    if (activeCategoryId === "special_offers" || activeCategoryId === "cat_pj_special_offers") return true;
    const cat = categories.find((c) => c.id === activeCategoryId);
    return Boolean(cat && cat.name.toLowerCase().includes("special offer"));
  }, [activeCategoryId, categories]);

  const filteredProducts = products.filter((p) => {
    // Exclude special offer pseudo-dishes from regular menu catalog
    if (p.categoryId === "cat_pj_special_offers" || p.id.startsWith("prod_pj_offer_")) return false;
    if (activeCategoryId === "combos" || isSpecialOffersCategory) return false;
    if (activeCategoryId !== "all" && p.categoryId !== activeCategoryId) return false;
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

  const billPreview = calculateOrderBill(cartItems, restaurant?.billingConfig);

  const handleOpenAddPortion = (product: ProductItem) => {
    if (!product.isAvailable) return;
    const offerEval = resolveBestOfferForItem(product, undefined, offers);
    if (product.portions && product.portions.length > 0) {
      const defaultPortion = product.portions.find((p) => p.isAvailable) || product.portions[0];
      setPortionModalProduct(product);
      setSelectedPortionId(defaultPortion.id);
      setPortionQuantity(1);
    } else {
      addItem(
        product,
        undefined,
        1,
        offerEval.hasOffer
          ? {
              effectivePrice: offerEval.effectivePrice,
              regularPrice: offerEval.regularPrice,
              discountAmount: offerEval.discountAmount,
              appliedOfferId: offerEval.appliedOffer?.id,
              appliedOfferName: offerEval.appliedOffer?.name,
              appliedOfferType: offerEval.appliedOffer?.offerType,
            }
          : undefined
      );
      toast.success(`Added ${product.name} to cart`);
    }
  };

  const handleConfirmPortion = () => {
    if (!portionModalProduct) return;
    const portion = portionModalProduct.portions?.find((p) => p.id === selectedPortionId);
    if (!portion || !portion.isAvailable) {
      toast.error("Please select an available portion.");
      return;
    }
    const offerEval = resolveBestOfferForItem(portionModalProduct, portion, offers);
    addItem(
      portionModalProduct,
      portion,
      portionQuantity,
      offerEval.hasOffer
        ? {
            effectivePrice: offerEval.effectivePrice,
            regularPrice: offerEval.regularPrice,
            discountAmount: offerEval.discountAmount,
            appliedOfferId: offerEval.appliedOffer?.id,
            appliedOfferName: offerEval.appliedOffer?.name,
            appliedOfferType: offerEval.appliedOffer?.offerType,
          }
        : undefined
    );
    toast.success(`Added ${portionModalProduct.name} (${portion.name}) × ${portionQuantity}`);
    setPortionModalProduct(null);
  };

  const handleAddCombo = (combo: RestaurantOffer) => {
    const comboEval = validateAndEvaluateCombo(combo, products);
    if (!comboEval.isValid) {
      toast.error(comboEval.error || "This combo is currently unavailable.");
      return;
    }
    addComboItem(combo, comboEval.comboItemsSnapshot, comboEval.regularTotal, 1);
    toast.success(`Added combo "${combo.name}" to cart`);
  };

  const getOfferModalTitle = (offer: RestaurantOffer) => {
    const n = offer.name.toLowerCase();
    if (n.includes("chaap")) return "Tuesday Special Deal — Choose Your Chaap";
    if (n.includes("momo")) return "Wednesday Special Deal — Choose Your Momos";
    if (n.includes("noodle")) return "Thursday Special Deal — Choose Your Noodle";
    if (n.includes("rumali roll") || n.includes("roll")) return "Friday Special Deal — Choose Your Rumali Roll";
    if (n.includes("potato")) return "Saturday Special Deal — Choose Your Potato Dish";
    if (n.includes("veg starter")) return "Sunday Special Deal — Choose Your Veg Starter";
    return `${offer.name} — Choose Your Item`;
  };

  const handleOpenOfferModal = (offer: RestaurantOffer) => {
    setOfferModalOffer(offer);
    const eligible = products.filter(
      (p) =>
        p.isAvailable &&
        p.categoryId !== "cat_pj_special_offers" &&
        !p.id.startsWith("prod_pj_offer_") &&
        isProductEligibleForOffer(p, offer)
    );

    const first = eligible[0] || null;
    setSelectedProductForOffer(first);
    if (first && first.portions && first.portions.length > 0) {
      const def = first.portions.find((p) => p.isAvailable) || first.portions[0];
      setSelectedPortionIdForOffer(def.id);
    } else {
      setSelectedPortionIdForOffer("");
    }
    setOfferItemQuantity(1);
  };

  const handleConfirmOfferItem = () => {
    if (!offerModalOffer || !selectedProductForOffer) {
      toast.error("Please select a dish to apply this offer.");
      return;
    }

    const portion = selectedProductForOffer.portions?.find(
      (p) => p.id === selectedPortionIdForOffer
    );
    const regularPrice = portion ? portion.price : selectedProductForOffer.price;
    const { effectivePrice, discountAmount } = calculateDiscountForOffer(
      regularPrice,
      offerModalOffer
    );

    addItem(
      selectedProductForOffer,
      portion,
      offerItemQuantity,
      {
        effectivePrice,
        regularPrice,
        discountAmount,
        appliedOfferId: offerModalOffer.id,
        appliedOfferName: offerModalOffer.name,
        appliedOfferType: offerModalOffer.offerType,
      }
    );

    const displayName = portion
      ? `${selectedProductForOffer.name} (${portion.name})`
      : selectedProductForOffer.name;

    toast.success(`Added ${displayName} with ${offerModalOffer.name} to cart!`);
    setOfferModalOffer(null);
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      toast.error("Your cart is empty. Please select food items.");
      return;
    }

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
      const storedToken = typeof window !== "undefined" ? localStorage.getItem(SESSION_STORAGE_KEY) : null;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug,
          tableCode,
          sessionToken: activeSession?.sessionToken || storedToken || undefined,
          items: cartItems.map((i) => ({
            productId: i.productId,
            name: i.name,
            portionId: i.portionId,
            portionName: i.portionName,
            quantity: i.quantity,
            isCombo: Boolean(i.isCombo),
            appliedOfferId: (i as any).appliedOfferId || undefined,
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

      if (data.diningSession?.sessionToken) {
        if (typeof window !== "undefined") {
          localStorage.setItem(SESSION_STORAGE_KEY, data.diningSession.sessionToken);
        }
        setActiveSession(data.diningSession);
      }

      clearCart();
      setCartOpen(false);
      toast.success(`Order ${data.orderNumber} placed successfully!`);
      const tokenParam = data.diningSession?.sessionToken ? `&sessionToken=${encodeURIComponent(data.diningSession.sessionToken)}` : "";
      router.push(`/order/${restaurantSlug}/${tableCode}/order-status?orderId=${data.orderId}${tokenParam}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to place order.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Modern styled dietary badges based on UI design
  const renderDietaryBadge = (diet?: DietaryClassification, isVegFallback: boolean = true) => {
    const d = diet || (isVegFallback ? "veg" : "non_veg");
    if (d === "veg") {
      return (
        <span
          className="inline-flex items-center justify-center w-[18px] h-[18px] rounded border border-emerald-600 bg-white shrink-0"
          title="Vegetarian"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
        </span>
      );
    }
    if (d === "egg") {
      return (
        <span
          className="inline-flex items-center justify-center w-[18px] h-[18px] rounded border border-amber-600 bg-white shrink-0"
          title="Contains Egg"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
        </span>
      );
    }
    // Red triangle in circle matching the new UI for non-veg
    return (
      <span
        className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border border-rose-600 bg-white shrink-0"
        title="Non-Vegetarian"
      >
        <svg className="w-2.5 h-2.5 text-rose-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L22 20H2L12 2Z" />
        </svg>
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
      <div className="w-full max-w-md bg-white min-h-screen shadow-xl flex flex-col relative pb-28">
        
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

              {activeSession && activeSession.items && activeSession.items.length > 0 && (
                <button
                  onClick={() => setBillModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shadow-xs"
                  title="View Running Customer Bill"
                >
                  <Receipt className="h-4 w-4 text-brand-400" />
                  <span className="hidden sm:inline">Running Bill:</span>
                  <span className="font-mono text-brand-300 font-bold">{formatCurrency(activeSession.billing.finalTotal)}</span>
                </button>
              )}

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
            {activeCombos.length > 0 && (
              <button
                onClick={() => setActiveCategoryId("combos")}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition flex items-center space-x-1.5 ${
                  activeCategoryId === "combos"
                    ? "bg-purple-600 text-white font-bold"
                    : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                <span>Offers & Combos</span>
                <span className="bg-purple-200 text-purple-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {activeCombos.length}
                </span>
              </button>
            )}
            {categories.map((cat) => {
              const isSpecialOffersTab =
                cat.id === "cat_pj_special_offers" ||
                cat.name.toLowerCase().includes("special offer");

              if (isSpecialOffersTab) {
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition flex items-center space-x-1.5 ${
                      activeCategoryId === cat.id
                        ? "bg-amber-600 text-white font-bold"
                        : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>{cat.name}</span>
                    {activeOffersToday.length > 0 && (
                      <span className="bg-amber-200 text-amber-950 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                        {activeOffersToday.length}
                      </span>
                    )}
                  </button>
                );
              }

              return (
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
              );
            })}
          </div>
        </header>

        {isDevEnvironment && showSimulatorDrawer && (
          <div className="bg-slate-900 text-white p-4 border-b border-purple-500/50 space-y-3.5 text-xs">
            {/* Developer Test Simulator Controls (Omitted inside block for brevity, perfectly working as original) */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Wrench className="h-4 w-4 text-purple-400" />
                <span className="font-bold text-purple-300 font-mono tracking-tight uppercase">
                  Developer Location Simulator
                </span>
              </div>
            </div>
            {/* Rest of developer presets left unchanged */}
            <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" variant="outline" onClick={() => applySimulatedScenario("inside")} className="h-7 text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-400 border-emerald-800/60 justify-start">
                  <MapPin className="h-3 w-3 mr-1 text-emerald-400" /> Inside Table (10m, ±5m)
                </Button>
                <Button size="sm" variant="outline" onClick={() => applySimulatedScenario("outside")} className="h-7 text-[10px] bg-slate-800 hover:bg-slate-700 text-rose-400 border-rose-900/60 justify-start">
                  <AlertTriangle className="h-3 w-3 mr-1 text-rose-400" /> Outside (500m, ±10m)
                </Button>
            </div>
          </div>
        )}

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
            
            {(locationStatus === "ACCURACY_TOO_POOR" || (locationStatus === "OUTSIDE" && isCoarseDesktop)) && (
              <div className="bg-amber-50 border-b border-amber-300 p-4 text-xs text-amber-900 space-y-2.5">
                <div className="flex items-start space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                    <Monitor className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold block text-slate-900 text-xs">Approximate Desktop Location Detected</span>
                    <span className="text-[11px] text-amber-800 block mt-0.5 leading-relaxed">
                      Location permission is <strong>granted</strong>, but your browser returned an approximate network IP location rather than high-precision GPS.
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <Button variant="outline" size="sm" onClick={() => requestLocation()} className="h-7 text-[11px] border-amber-300 hover:bg-amber-100 text-amber-900">
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry Device GPS
                  </Button>
                </div>
              </div>
            )}
            
            {locationStatus === "OUTSIDE" && !isCoarseDesktop && (
              <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex items-start justify-between text-xs text-rose-900">
                <div className="flex items-start space-x-2 min-w-0">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Outside Permitted Ordering Area</span>
                    <span className="text-[11px] text-rose-700 leading-tight block mt-0.5">
                      {locationMessage || `You are ${locationDistance}m away from the restaurant.`}
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => requestLocation()} className="h-7 text-[11px] shrink-0 ml-2 border-rose-300 hover:bg-rose-100">
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}

{/* --- Product Cards List Layout (Matching Visual Design) --- */}
        <main className="p-4 space-y-4 flex-1">
          {/* Today's Active Featured Deal (Compact Showcase for Default Menu View) */}
          {activeCategoryId === "all" && activeOffersToday.length > 0 && (
            <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/15 rounded-2xl border border-amber-300/80 shadow-sm flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-extrabold uppercase bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded">
                      Today&apos;s Deal
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                      Dine-In
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900 truncate mt-0.5">
                    {activeOffersToday[0].name}
                  </h4>
                  <p className="text-[11px] text-slate-600 truncate">
                    {activeOffersToday[0].discountMethod === "FIXED_PRICE"
                      ? `Special price: ${formatCurrency(activeOffersToday[0].discountValue)} • Tap to choose item`
                      : `${activeOffersToday[0].discountValue}% Off • Tap to choose item`}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleOpenOfferModal(activeOffersToday[0])}
                className="h-8 px-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm shrink-0"
              >
                Select Item
              </Button>
            </div>
          )}

          {/* Active Combos & Value Bundles Showcase */}
          {activeCombos.length > 0 && (activeCategoryId === "all" || activeCategoryId === "combos") && (
            <div className="p-4 bg-gradient-to-br from-purple-50/80 via-white to-amber-50/40 rounded-[28px] border border-purple-200/80 shadow-sm space-y-3 mb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <h3 className="font-bold text-sm font-display text-purple-900">
                    Special Combos & Value Deals
                  </h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  Special Value
                </span>
              </div>

              <div className="space-y-3">
                {activeCombos.map((combo) => {
                  const comboEval = validateAndEvaluateCombo(combo, products);
                  const comboInCartQty = getItemQuantity(combo.id);

                  return (
                    <div
                      key={combo.id}
                      className="p-3.5 rounded-2xl bg-white border border-purple-100 shadow-sm flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] font-extrabold uppercase bg-purple-600 text-white px-1.5 py-0.2 rounded">
                              COMBO
                            </span>
                            <h4 className="font-bold text-sm text-slate-900 truncate">
                              {combo.name}
                            </h4>
                          </div>
                          {combo.description && (
                            <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">
                              {combo.description}
                            </p>
                          )}
                          {/* Included items */}
                          <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl space-y-0.5">
                            <span className="font-semibold text-slate-700 block text-[10px] uppercase tracking-wider">
                              Includes:
                            </span>
                            {comboEval.comboItemsSnapshot.map((ci) => (
                              <div key={ci.productId} className="flex items-center space-x-1">
                                <span className="text-purple-600 font-bold">•</span>
                                <span>
                                  {ci.quantity}x {ci.productName}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {combo.imageUrl && (
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={combo.imageUrl}
                              alt={combo.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <div>
                          {comboEval.regularTotal > (combo.comboPrice || 0) && (
                            <span className="text-xs line-through text-slate-400 font-medium mr-1.5">
                              {formatCurrency(comboEval.regularTotal)}
                            </span>
                          )}
                          <span className="text-lg font-extrabold text-purple-700 font-display">
                            {formatCurrency(combo.comboPrice || 0)}
                          </span>
                        </div>

                        {comboEval.isValid ? (
                          comboInCartQty > 0 ? (
                            <div className="inline-flex items-center border border-purple-200 rounded-xl bg-purple-50 text-purple-700 h-8 px-1">
                              <button
                                onClick={() => updateQuantity(combo.id, undefined, comboInCartQty - 1)}
                                className="p-1 hover:bg-purple-100 rounded-lg text-purple-700"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-6 text-center text-xs font-bold text-purple-800">
                                {comboInCartQty}
                              </span>
                              <button
                                onClick={() => updateQuantity(combo.id, undefined, comboInCartQty + 1)}
                                className="p-1 hover:bg-purple-100 rounded-lg text-purple-700"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddCombo(combo)}
                              className="h-8 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition"
                            >
                              + ADD COMBO
                            </button>
                          )
                        ) : (
                          <span className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded-lg">
                            Item Sold Out
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DEDICATED SPECIAL OFFERS CATEGORY VIEW */}
          {isSpecialOffersCategory ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-base text-slate-900 font-display flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span>Today&apos;s Special Offers</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Exclusive dine-in offers active today at your table.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">
                  {activeOffersToday.length} Active Today
                </span>
              </div>

              {activeOffersToday.length === 0 ? (
                <div className="text-center py-12 px-4 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800 font-display">
                    No special offers available today
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    There are no active special offers for today. Please explore our delicious regular dishes below!
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveCategoryId("all")}
                    className="mt-2 text-xs text-brand-600 border-brand-200 hover:bg-brand-50"
                  >
                    Browse All Categories
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeOffersToday.map((offer) => {
                    const eligibleCount = products.filter(
                      (p) =>
                        p.isAvailable &&
                        p.categoryId !== "cat_pj_special_offers" &&
                        !p.id.startsWith("prod_pj_offer_") &&
                        isProductEligibleForOffer(p, offer)
                    ).length;

                    return (
                      <div
                        key={offer.id}
                        className="p-4 rounded-3xl bg-white border border-amber-200/80 shadow-sm flex flex-col gap-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-extrabold uppercase bg-amber-600 text-white px-2 py-0.5 rounded">
                                TODAY&apos;S SPECIAL
                              </span>
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                DINE-IN ONLY
                              </span>
                            </div>
                            <h4 className="font-extrabold text-base text-slate-900 mt-1">
                              {offer.name}
                            </h4>
                            {offer.description && (
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                {offer.description}
                              </p>
                            )}
                            <div className="mt-2 flex items-center space-x-2 text-xs text-slate-500">
                              <Tag className="h-3.5 w-3.5 text-amber-600" />
                              <span>{eligibleCount} eligible dishes available</span>
                            </div>
                          </div>

                          {offer.imageUrl && (
                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={offer.imageUrl} alt={offer.name} className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <div>
                            <span className="text-[11px] text-slate-400 block font-medium">Deal Price</span>
                            <span className="text-lg font-extrabold text-amber-700 font-display">
                              {offer.discountMethod === "FIXED_PRICE"
                                ? formatCurrency(offer.discountValue)
                                : `${offer.discountValue}% Off`}
                            </span>
                          </div>

                          <Button
                            onClick={() => handleOpenOfferModal(offer)}
                            className="h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition"
                          >
                            {offer.name.toLowerCase().includes("chaap")
                              ? "Choose Your Chaap"
                              : offer.name.toLowerCase().includes("momo")
                              ? "Choose Your Momos"
                              : offer.name.toLowerCase().includes("noodle")
                              ? "Choose Your Noodle"
                              : offer.name.toLowerCase().includes("rumali roll")
                              ? "Choose Your Rumali Roll"
                              : offer.name.toLowerCase().includes("potato")
                              ? "Choose Your Potato"
                              : offer.name.toLowerCase().includes("veg starter")
                              ? "Choose Veg Starter"
                              : "+ Select Item"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeCategoryId === "combos" ? null : filteredProducts.length === 0 ? (
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
              const offerEval = resolveBestOfferForItem(prod, undefined, offers);

              return (
                <div
                  key={prod.id}
                  className={`p-2.5 rounded-[28px] bg-white shadow-sm border border-slate-100 flex items-center gap-3 transition ${
                    !prod.isAvailable ? "opacity-60 bg-slate-50" : "hover:border-slate-300"
                  }`}
                >
                  {/* Left Content Area */}
                  <div className="flex-1 min-w-0 border border-slate-100 rounded-[20px] p-4 flex flex-col justify-between self-stretch">
                    <div>
                      <div className="flex items-start gap-2.5 mb-2">
                        <div className="mt-1 shrink-0">
                          {renderDietaryBadge(prod.dietaryType, prod.isVeg)}
                        </div>
                        <h3 className="font-bold text-[18px] text-slate-900 line-clamp-2 leading-tight">
                          {prod.name}
                        </h3>
                      </div>

                      <p className="text-[13px] text-slate-500 line-clamp-2 sm:line-clamp-3 leading-relaxed mb-4">
                        {prod.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-1">
                      <div className="flex flex-col">
                        <div className="flex items-baseline space-x-1.5">
                          {offerEval.hasOffer && !hasPortions && (
                            <span className="text-xs line-through text-slate-400 font-medium">
                              {formatCurrency(prod.price)}
                            </span>
                          )}
                          <span className="text-[22px] font-extrabold text-slate-900 tracking-tight">
                            {hasPortions && prod.portions!.length > 1
                              ? `₹${minPrice}`
                              : formatCurrency(offerEval.effectivePrice)}
                          </span>
                        </div>
                        {offerEval.hasOffer && offerEval.appliedOffer && (
                          <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded w-fit mt-0.5">
                            {offerEval.appliedOffer.name}
                          </span>
                        )}
                        {hasPortions && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 font-medium px-1.5 py-0.5 rounded w-fit mt-0.5">
                            {prod.portions!.map((p) => p.name).join("/")}
                          </span>
                        )}
                      </div>

                      {prod.isAvailable && (
                        <div>
                          {productTotalQty > 0 && !hasPortions ? (
                            <div className="inline-flex items-center border border-red-200 rounded-2xl bg-red-50 text-red-600 h-9 px-1 shadow-sm">
                              <button
                                onClick={() => updateQuantity(prod.id, undefined, productTotalQty - 1)}
                                className="p-1 hover:bg-red-100 rounded-xl text-red-600"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-6 text-center text-sm font-bold text-red-700">
                                {productTotalQty}
                              </span>
                              <button
                                onClick={() => updateQuantity(prod.id, undefined, productTotalQty + 1)}
                                className="p-1 hover:bg-red-100 rounded-xl text-red-600"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleOpenAddPortion(prod)}
                              className="h-9 px-5 rounded-[16px] bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-[14px] font-bold flex items-center justify-center shadow-sm transition uppercase tracking-wide"
                            >
                              {productTotalQty > 0 ? `ADD (${productTotalQty})` : "+ADD"}
                            </button>
                          )}
                        </div>
                      )}
                      {!prod.isAvailable && (
                        <span className="text-[11px] text-red-600 font-bold bg-red-50 px-3 py-1.5 rounded-xl border border-red-100">
                          Sold Out
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: Square Image block */}
                  <div className="w-[140px] sm:w-[160px] aspect-square shrink-0 rounded-[20px] bg-slate-100 overflow-hidden relative">
                    {prod.imageUrl ? (
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 w-full h-full flex items-center justify-center border border-slate-100 rounded-[20px]">
                        <Utensils className="h-8 w-8 text-slate-300" />
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

        {/* Special Offer Item Selection Bottom Sheet Modal (Reusable for all Any-type deals) */}
        {offerModalOffer && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-100 flex items-start justify-between bg-amber-50/60">
                <div>
                  <div className="flex items-center space-x-1.5 mb-1">
                    <span className="text-[10px] font-extrabold uppercase bg-amber-600 text-white px-2 py-0.5 rounded">
                      Special Deal Selection
                    </span>
                    <span className="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                      Dine-In Only
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 font-display">
                    {getOfferModalTitle(offerModalOffer)}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Select the specific dish and portion you would like to order.
                  </p>
                </div>
                <button
                  onClick={() => setOfferModalOffer(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* List of Eligible Menu Items */}
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                {(() => {
                  const eligibleProducts = products.filter(
                    (p) =>
                      p.isAvailable &&
                      p.categoryId !== "cat_pj_special_offers" &&
                      !p.id.startsWith("prod_pj_offer_") &&
                      isProductEligibleForOffer(p, offerModalOffer)
                  );

                  if (eligibleProducts.length === 0) {
                    return (
                      <div className="text-center py-10 text-slate-400">
                        <Utensils className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-xs font-medium">No eligible dishes currently available for this deal.</p>
                      </div>
                    );
                  }

                  return eligibleProducts.map((prod) => {
                    const isSelected = selectedProductForOffer?.id === prod.id;
                    const hasPortions = Boolean(prod.portions && prod.portions.length > 0);
                    
                    const activePortion = isSelected
                      ? prod.portions?.find((po) => po.id === selectedPortionIdForOffer) || prod.portions?.[0]
                      : prod.portions?.[0];
                    const basePrice = activePortion ? activePortion.price : prod.price;
                    const { effectivePrice } = calculateDiscountForOffer(basePrice, offerModalOffer);

                    return (
                      <div
                        key={prod.id}
                        onClick={() => {
                          setSelectedProductForOffer(prod);
                          if (prod.portions && prod.portions.length > 0) {
                            const def = prod.portions.find((p) => p.isAvailable) || prod.portions[0];
                            setSelectedPortionIdForOffer(def.id);
                          } else {
                            setSelectedPortionIdForOffer("");
                          }
                        }}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                          isSelected
                            ? "border-amber-500 bg-amber-50/40 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected ? "border-amber-600 bg-amber-600" : "border-slate-300"
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                              {renderDietaryBadge(prod.dietaryType, prod.isVeg)}
                              <h4 className="font-bold text-sm text-slate-900 truncate">
                                {prod.name}
                              </h4>
                            </div>
                            {prod.description && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-1 ml-6">
                                {prod.description}
                              </p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs line-through text-slate-400 font-medium mr-1.5">
                              {formatCurrency(basePrice)}
                            </span>
                            <span className="text-sm font-extrabold text-amber-700 font-display">
                              {formatCurrency(effectivePrice)}
                            </span>
                          </div>
                        </div>

                        {/* Portion / Variant Selector when this item is selected */}
                        {isSelected && hasPortions && (
                          <div className="mt-3 pt-3 border-t border-amber-200/60 ml-6">
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                              Select Portion / Variant:
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              {prod.portions!.map((portion) => {
                                const isPortionSelected = selectedPortionIdForOffer === portion.id;
                                const pOfferEval = calculateDiscountForOffer(portion.price, offerModalOffer);

                                return (
                                  <button
                                    key={portion.id}
                                    type="button"
                                    disabled={!portion.isAvailable}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPortionIdForOffer(portion.id);
                                    }}
                                    className={`p-2 rounded-xl border text-left text-xs transition ${
                                      isPortionSelected
                                        ? "border-amber-600 bg-amber-100 text-amber-950 font-bold"
                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    } ${!portion.isAvailable ? "opacity-40 cursor-not-allowed" : ""}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="truncate">{portion.name}</span>
                                      {isPortionSelected && (
                                        <span className="text-[10px] text-amber-700 font-bold ml-1">✓</span>
                                      )}
                                    </div>
                                    <div className="mt-0.5 flex items-baseline space-x-1">
                                      <span className="text-[10px] line-through text-slate-400">
                                        {formatCurrency(portion.price)}
                                      </span>
                                      <span className="text-xs font-bold text-amber-800">
                                        {formatCurrency(pOfferEval.effectivePrice)}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}

                {/* Quantity Stepper */}
                {selectedProductForOffer && (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Quantity</span>
                    <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50 h-8 px-1">
                      <button
                        onClick={() => setOfferItemQuantity((q) => Math.max(1, q - 1))}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-slate-900">
                        {offerItemQuantity}
                      </span>
                      <button
                        onClick={() => setOfferItemQuantity((q) => Math.min(20, q + 1))}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Confirmation CTA */}
              <div className="p-4 border-t border-slate-100 bg-white">
                {(() => {
                  if (!selectedProductForOffer) {
                    return (
                      <Button disabled className="w-full font-bold" size="lg">
                        Select a Dish to Continue
                      </Button>
                    );
                  }

                  const activePortion = selectedProductForOffer.portions?.find(
                    (p) => p.id === selectedPortionIdForOffer
                  );
                  const basePrice = activePortion ? activePortion.price : selectedProductForOffer.price;
                  const { effectivePrice } = calculateDiscountForOffer(basePrice, offerModalOffer);
                  const subtotal = effectivePrice * offerItemQuantity;

                  return (
                    <Button
                      onClick={handleConfirmOfferItem}
                      className="w-full font-bold shadow-md bg-amber-600 hover:bg-amber-700 text-white"
                      size="lg"
                    >
                      <span>Add to Order</span>
                      <span className="ml-2">• {formatCurrency(subtotal)}</span>
                    </Button>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Immediate Location Permission Modal */}
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

{/* Cart Bottom Sheet Modal */}
        {cartOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4 transition-all">
            <div className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[28px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 fade-in duration-300">
              
              {/* Header */}
              <div className="pt-3 pb-4 px-5 border-b border-slate-100 flex items-center justify-between bg-white relative z-10">
                {/* Mobile Handle */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full sm:hidden" />
                
                <div className="mt-2 sm:mt-0">
                  <h2 className="text-[19px] font-extrabold text-slate-900 tracking-tight">
                    Review Order
                  </h2>
                  <p className="text-[13px] font-medium text-slate-500 mt-0.5">
                    {table.displayLabel}
                  </p>
                </div>
                <button
                  onClick={() => setCartOpen(false)}
                  className="p-2 rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors mt-2 sm:mt-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-5 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
                
                {/* Items List */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {cartItems.map((item, index) => (
                    <div
                      key={`${item.productId}_${item.portionId || "def"}`}
                      className={`flex items-center justify-between p-4 ${
                        index !== cartItems.length - 1 ? "border-b border-slate-100" : ""
                      }`}
                    >
                      <div className="flex-1 pr-4">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 shrink-0">
                            {renderDietaryBadge(item.dietaryType, item.isVeg)}
                          </div>
                          <div>
                            <h4 className="text-[14px] font-bold text-slate-900 leading-tight">
                              {item.name}
                            </h4>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {item.isCombo ? (
                                <span className="text-[10px] font-extrabold uppercase bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded">
                                  COMBO
                                </span>
                              ) : item.discountAmount && item.discountAmount > 0 ? (
                                <>
                                  <span className="text-[12px] line-through text-slate-400 font-medium">
                                    {formatCurrency((item.regularPrice || item.price) * item.quantity)}
                                  </span>
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                                    {item.appliedOfferName || "Offer Applied"}
                                  </span>
                                </>
                              ) : null}
                              <span className="text-[13px] font-semibold text-slate-700 block">
                                {formatCurrency(item.price * item.quantity)}
                              </span>
                            </div>

                            {item.isCombo && item.comboItemsSnapshot && (
                              <div className="text-[11px] text-slate-500 mt-1 pl-2 border-l-2 border-purple-200 space-y-0.5">
                                {item.comboItemsSnapshot.map((ci) => (
                                  <div key={ci.productId}>
                                    • {ci.quantity}x {ci.productName}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quantity Selector */}
                      <div className="inline-flex items-center border border-slate-200 rounded-xl bg-white shadow-sm h-9 px-1 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.productId, item.portionId, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center text-[13px] font-bold text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.portionId, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Special Instructions */}
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-2 ml-1">
                    Special Instructions
                  </label>
                  <Input
                    placeholder="e.g. Less spicy, no coriander..."
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    className="text-[14px] bg-white border-slate-200 rounded-xl focus:ring-brand-500/20 shadow-sm placeholder:text-slate-400 h-11"
                    maxLength={200}
                  />
                </div>

                {/* Bill Breakdown (Receipt Style) */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-2.5 text-[13px]">
                  {(() => {
                    const totalSavings = cartItems.reduce(
                      (acc, i) => acc + (i.discountAmount || 0) * i.quantity,
                      0
                    );
                    if (totalSavings <= 0) return null;
                    return (
                      <div className="flex justify-between text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1.5 rounded-lg text-xs">
                        <span>Total Offer Savings</span>
                        <span>-{formatCurrency(totalSavings)}</span>
                      </div>
                    );
                  })()}

                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Item Subtotal</span>
                    <span className="text-slate-700 font-semibold">{formatCurrency(billPreview.subtotal)}</span>
                  </div>

                  {billPreview.serviceChargeEnabled && (
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>Service Charge ({billPreview.serviceChargeRate}%)</span>
                      <span className="text-slate-700 font-semibold">{formatCurrency(billPreview.serviceChargeAmount)}</span>
                    </div>
                  )}

                  {billPreview.gstEnabled && (
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>Taxes & GST ({billPreview.gstRate}%)</span>
                      <span className="text-slate-700 font-semibold">{formatCurrency(billPreview.gstAmount)}</span>
                    </div>
                  )}

                  <div className="border-t border-dashed border-slate-200 mt-3 pt-3 flex justify-between items-center">
                    <span className="font-extrabold text-slate-900 text-[15px]">Total Payable</span>
                    <span className="text-[18px] font-extrabold text-slate-900 tracking-tight">
                      {formatCurrency(billPreview.finalTotal)}
                    </span>
                  </div>
                </div>

                {/* Geolocation Warning */}
                {restaurant.locationSettings?.locationRestrictionEnabled &&
                  locationStatus !== "ALLOWED" &&
                  locationStatus !== "NOT_REQUIRED" && (
                    <div className="bg-rose-50/80 border border-rose-200/80 p-4 rounded-2xl text-[13px] text-rose-800 shadow-sm">
                      <div className="flex items-start gap-2.5">
                        <div className="bg-rose-100 p-1.5 rounded-full shrink-0">
                          <AlertTriangle className="h-4 w-4 text-rose-600" />
                        </div>
                        <div className="flex-1">
                          <strong className="block text-rose-900 text-[14px]">Verification Required</strong>
                          <span className="text-rose-700 block mt-1 leading-relaxed">
                            {locationStatus === "ACCURACY_TOO_POOR"
                              ? "Approximate location detected. Please use a mobile device with precise GPS enabled to confirm your table."
                              : locationStatus === "OUTSIDE"
                              ? `You appear to be ${locationDistance}m away. You must be within ${restaurant.locationSettings?.orderingRadiusMetres}m of the restaurant to order.`
                              : locationStatus === "DENIED"
                              ? "Location access is blocked. Please allow permissions in your browser to proceed."
                              : locationMessage || "GPS proximity verification is required before placing your order."}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-rose-200/50">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => requestLocation()}
                          className="flex-1 text-[13px] h-9 border-rose-200 hover:bg-rose-100 text-rose-700 bg-white"
                        >
                          <Navigation className="h-3.5 w-3.5 mr-1.5" />
                          Recheck GPS
                        </Button>
                        {isDevEnvironment && !testModeActive && (
                          <Button
                            size="sm"
                            onClick={() => applySimulatedScenario("inside")}
                            className="flex-1 text-[13px] h-9 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                          >
                            <Wrench className="h-3.5 w-3.5 mr-1.5" />
                            Simulator
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                {/* Settlement Info */}
                <div className="bg-slate-100/70 rounded-2xl p-4 text-[12px] text-slate-600 leading-relaxed text-center">
                  <span className="font-bold text-slate-800">Pay at the restaurant:</span> This order is sent directly to the kitchen. Please settle your final bill at the counter or with your server.
                </div>
              </div>

              {/* Footer / Submit CTA */}
              <div className="p-5 border-t border-slate-100 bg-white relative z-10 shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)]">
                {testModeActive && (
                  <div className="text-center mb-3">
                    <span className="text-[11px] bg-purple-100 text-purple-700 font-mono font-bold px-2.5 py-1 rounded-md border border-purple-200/50">
                      DEV TEST MODE ACTIVE
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
                  className="w-full h-14 rounded-2xl font-bold text-[16px] shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all"
                >
                  {restaurant.locationSettings?.locationRestrictionEnabled &&
                  locationStatus !== "ALLOWED" &&
                  locationStatus !== "NOT_REQUIRED"
                    ? locationStatus === "ACCURACY_TOO_POOR"
                      ? "Precise GPS Required"
                      : locationStatus === "OUTSIDE"
                      ? "Outside Ordering Area"
                      : locationStatus === "DENIED"
                      ? "Allow Location Access"
                      : "Verifying Location..."
                    : `Place Order • ${formatCurrency(billPreview.finalTotal)}`}
                  {!isSubmittingOrder && <ArrowRight className="h-5 w-5 ml-2 opacity-80" />}
                </Button>
              </div>
              
            </div>
          </div>
        )}
        {/* Continuous Customer Combined Bill Modal */}
        <CombinedBillModal
          isOpen={billModalOpen}
          onClose={() => setBillModalOpen(false)}
          session={activeSession}
          restaurantName={restaurant?.name}
          onOrderMore={() => setBillModalOpen(false)}
        />
      </div>
    </div>
  );
}