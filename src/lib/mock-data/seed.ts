// ==============================================================================
// RESTROCHARGE - Core Production Seed Data & Initial State
// Developed and operated by Vivexa Tech
// Single official demo restaurant: Vivexa Restro
// ==============================================================================

import type {
  RestaurantProfile,
  ProductCategory,
  ProductItem,
  TableItem,
  OrderItem,
  SubscriptionPlan,
  RestaurantRegistrationRequest,
  UserProfile,
} from "../types";

// ------------------------------------------------------------------------------
// Subscription Plans (Authoritative Pricing)
// ------------------------------------------------------------------------------
export const SEED_PLANS: SubscriptionPlan[] = [
  {
    id: "plan_starter",
    name: "Starter Essential",
    tagline: "Ideal for small cafes, food trucks, and quick-service diners.",
    monthlyPrice: 999,
    annualPrice: 9990,
    features: [
      "Up to 15 Restaurant Tables",
      "Digital Menu & QR Code Generation (by Vivexa Tech)",
      "Customer QR Ordering System",
      "Real-time Order Dashboard",
      "Branded Restaurant Website (subpath)",
      "Standard Email Notifications",
    ],
    limits: {
      maxTables: 15,
      maxProducts: 60,
      maxStaff: 3,
    },
    isActive: true,
  },
  {
    id: "plan_pro",
    name: "Growth & KDS Pro",
    tagline: "Designed for bustling casual dining & multi-section restaurants.",
    monthlyPrice: 2499,
    annualPrice: 24990,
    isPopular: true,
    features: [
      "Up to 50 Restaurant Tables",
      "Everything in Starter",
      "Kitchen Order Display (KDS) with sound alerts",
      "Full Website Customization & Color Themes",
      "Central Billing & GST Configuration",
      "Staff Role Permissions (Owner, Manager, Kitchen)",
      "Detailed Sales & Product Analytics",
      "Priority Vivexa Tech Support",
    ],
    limits: {
      maxTables: 50,
      maxProducts: 200,
      maxStaff: 12,
    },
    isActive: true,
  },
  {
    id: "plan_enterprise",
    name: "Enterprise Multi-Floor",
    tagline: "For fine dining establishments, resort cafes & high-volume bistros.",
    monthlyPrice: 4999,
    annualPrice: 49990,
    features: [
      "Unlimited Restaurant Tables",
      "Unlimited Menu Items & Categories",
      "Multi-Station Kitchen Routing",
      "Dedicated Onboarding Executive",
      "Custom Print Sheet & QR Placement Kits",
      "99.9% Uptime SLA & 24/7 Phone Support",
    ],
    limits: {
      maxTables: 999,
      maxProducts: 9999,
      maxStaff: 50,
    },
    isActive: true,
  },
];

// ------------------------------------------------------------------------------
// Authoritative Users: Primary Super Admin & Demo Restaurant Staff
// ------------------------------------------------------------------------------
export const SEED_USERS: UserProfile[] = [
  {
    uid: "GDF2eldrzSNR9oltgezCr9MXt0I3",
    email: "admin@vivexatech.in",
    displayName: "Vivexa Tech Operations",
    role: "SUPER_ADMIN",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    isActive: true,
  },
  {
    uid: "usr_vivexa_owner",
    email: "demo@vivexatech.in",
    displayName: "Vivexa Restro Manager",
    role: "RESTAURANT_OWNER",
    restaurantId: "rest_vivexa_01",
    createdAt: "2026-02-15T00:00:00.000Z",
    updatedAt: "2026-02-15T00:00:00.000Z",
    isActive: true,
  },
  {
    uid: "usr_vivexa_kitchen",
    email: "kitchen@vivexatech.in",
    displayName: "Vivexa Restro Head Chef",
    role: "KITCHEN_STAFF",
    restaurantId: "rest_vivexa_01",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z",
    isActive: true,
  },
];

// ------------------------------------------------------------------------------
// Single Official Demo Restaurant: Vivexa Restro
// ------------------------------------------------------------------------------
export const SEED_RESTAURANTS: RestaurantProfile[] = [
  {
    id: "rest_vivexa_01",
    name: "Vivexa Restro",
    slug: "vivexa-restro",
    isDemo: true,
    cuisineType: "North Indian, Tandoori & Curries",
    description: "Official demo restaurant by Vivexa Tech showcasing contactless QR ordering, kitchen display management, and portion-based culinary service.",
    ownerUid: "usr_vivexa_owner",
    ownerEmail: "demo@vivexatech.in",
    ownerName: "Vivexa Restro Manager",
    phone: "+91 98765 43210",
    address: "Vivexa Tech Hub, Sector 5, Malviya Nagar",
    city: "Jaipur",
    state: "Rajasthan",
    postalCode: "302017",
    published: true,
    operationalSettings: {
      isAcceptingOrders: true,
      currency: "INR",
      tableCount: 10,
    },
    locationSettings: {
      latitude: 26.8524,
      longitude: 75.8052,
      orderingRadiusMetres: 200,
      locationRestrictionEnabled: true,
      isConfigured: true,
      addressSnapshot: "Vivexa Tech Hub, Sector 5, Malviya Nagar, Jaipur, Rajasthan",
      updatedAt: "2026-02-15T10:00:00.000Z",
      updatedBy: "GDF2eldrzSNR9oltgezCr9MXt0I3",
      updatedByName: "Vivexa Tech Operations",
    },
    branding: {
      logoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&h=200&q=80",
      coverImageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
      primaryColor: "#ea580c",
      secondaryColor: "#9a3412",
      accentColor: "#fb923c",
      fontPreset: "outfit",
      galleryImages: [
        "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
      ],
    },
    websiteConfig: {
      heroTitle: "Authentic Flavors, Smart Dining",
      heroSubtitle: "Indulge in authentic tandoori starters, slow-cooked royal curries, and freshly baked artisanal naans.",
      heroLayout: "centered",
      menuLayout: "categorized",
      aboutText: "Vivexa Restro is an upscale culinary haven demonstrating the cutting-edge power of the RestroCharge platform by Vivexa Tech. Enjoy precision contactless ordering and royal hospitality.",
      openingHours: [
        { days: "Monday - Friday", open: "12:00 PM", close: "11:30 PM" },
        { days: "Saturday - Sunday", open: "11:30 AM", close: "12:00 AM" },
      ],
      contactPhone: "+91 98765 43210",
      contactEmail: "reservations@vivexatech.in",
      address: "Vivexa Tech Hub, Sector 5, Malviya Nagar, Jaipur",
      city: "Jaipur",
      directionsUrl: "https://maps.google.com",
      amenities: ["Air Conditioned", "Valet Parking", "Family Dining", "Live Kitchen", "Contactless QR Ordering"],
      socialLinks: {
        instagram: "https://instagram.com/vivexatech",
      },
      sectionsVisibility: {
        hero: true,
        about: true,
        menu: true,
        gallery: true,
        hours: true,
        contact: true,
        amenities: true,
      },
      seoTitle: "Vivexa Restro | Multi-Cuisine Dining & QR Menu in Jaipur",
      seoDescription: "Explore the live digital menu of Vivexa Restro. Featuring charcoal tandoori starters, slow-cooked curries, and fresh breads.",
    },
    billingConfig: {
      itemOnly: false,
      gstEnabled: true,
      gstRate: 5,
      serviceChargeEnabled: true,
      serviceChargeRate: 5,
      calculationBasis: "TAX_ON_SUBTOTAL",
    },
    subscription: {
      planId: "plan_pro",
      planName: "Growth & KDS Pro",
      status: "ACTIVE",
      billingCycle: "ANNUAL",
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      expiryDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(),
      gracePeriodEnd: new Date(Date.now() + 338 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: false,
      lastPaymentId: "pay_vivexa_demo_01",
      updatedAt: new Date().toISOString(),
    },
    createdAt: "2026-01-10T10:00:00.000Z",
    updatedAt: "2026-02-15T10:00:00.000Z",
  },
];

// ------------------------------------------------------------------------------
// Exactly 3 Categories for Vivexa Restro
// ------------------------------------------------------------------------------
export const SEED_CATEGORIES: ProductCategory[] = [
  {
    id: "cat_vr_starters",
    restaurantId: "rest_vivexa_01",
    name: "Starters",
    description: "Tandoori skewers and charcoal-grilled appetizers",
    sortOrder: 1,
    isActive: true,
    createdAt: "2026-01-10T10:00:00.000Z",
  },
  {
    id: "cat_vr_mains",
    restaurantId: "rest_vivexa_01",
    name: "Mains",
    description: "Slow-simmered rich curries, gravies, and royal biryani",
    sortOrder: 2,
    isActive: true,
    createdAt: "2026-01-10T10:00:00.000Z",
  },
  {
    id: "cat_vr_breads",
    restaurantId: "rest_vivexa_01",
    name: "Breads / Rice",
    description: "Freshly slapped clay-oven tandoor breads and fragrant rice",
    sortOrder: 3,
    isActive: true,
    createdAt: "2026-01-10T10:00:00.000Z",
  },
];

// ------------------------------------------------------------------------------
// Exactly 7 Menu Items with Portion-Based Pricing & Dietary Types
// ------------------------------------------------------------------------------
export const SEED_PRODUCTS: ProductItem[] = [
  // 1. Paneer Tikka (Veg, Half ₹160, Full ₹290)
  {
    id: "prod_vr_1",
    restaurantId: "rest_vivexa_01",
    categoryId: "cat_vr_starters",
    name: "Paneer Tikka",
    description: "Tender cottage cheese cubes marinated in spiced hung yogurt, degi mirch, and roasted mustard oil, char-grilled in a tandoor with crunchy bell peppers.",
    price: 290,
    isVeg: true,
    dietaryType: "veg",
    portions: [
      { id: "half", name: "Half", price: 160, isAvailable: true, description: "4 skewers" },
      { id: "full", name: "Full", price: 290, isAvailable: true, description: "8 skewers" },
    ],
    isAvailable: true,
    isFeatured: true,
    imageUrl: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80",
    sortOrder: 1,
    createdAt: "2026-01-10T10:00:00.000Z",
    updatedAt: "2026-01-10T10:00:00.000Z",
  },
  // 2. Dal Makhani (Veg, Half ₹140, Full ₹240)
  {
    id: "prod_vr_2",
    restaurantId: "rest_vivexa_01",
    categoryId: "cat_vr_mains",
    name: "Dal Makhani",
    description: "Black urad lentils and kidney beans slow-cooked overnight over gentle charcoal embers, enriched with churned butter and fresh malai cream.",
    price: 240,
    isVeg: true,
    dietaryType: "veg",
    portions: [
      { id: "half", name: "Half", price: 140, isAvailable: true, description: "300ml bowl" },
      { id: "full", name: "Full", price: 240, isAvailable: true, description: "600ml handi" },
    ],
    isAvailable: true,
    isFeatured: true,
    imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80",
    sortOrder: 2,
    createdAt: "2026-01-10T10:00:00.000Z",
    updatedAt: "2026-01-10T10:00:00.000Z",
  },
  // 3. Shahi Paneer (Veg, Half ₹180, Full ₹320)
  {
    id: "prod_vr_3",
    restaurantId: "rest_vivexa_01",
    categoryId: "cat_vr_mains",
    name: "Shahi Paneer",
    description: "Velvety cottage cheese cubes simmered in a royal golden gravy of ground cashews, sweet onions, tomatoes, and aromatic cardamom.",
    price: 320,
    isVeg: true,
    dietaryType: "veg",
    portions: [
      { id: "half", name: "Half", price: 180, isAvailable: true, description: "300ml portion" },
      { id: "full", name: "Full", price: 320, isAvailable: true, description: "600ml portion" },
    ],
    isAvailable: true,
    isFeatured: false,
    imageUrl: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80",
    sortOrder: 3,
    createdAt: "2026-01-10T10:00:00.000Z",
    updatedAt: "2026-01-10T10:00:00.000Z",
  },
  // 4. Chicken Curry (Non-Veg, Quarter ₹150, Half ₹280, Full ₹500)
  {
    id: "prod_vr_4",
    restaurantId: "rest_vivexa_01",
    categoryId: "cat_vr_mains",
    name: "Chicken Curry",
    description: "Homestyle succulent chicken cuts braised in a robust onion-ginger gravy with freshly ground coriander, cumin, and garam masala.",
    price: 500,
    isVeg: false,
    dietaryType: "non_veg",
    portions: [
      { id: "quarter", name: "Quarter", price: 150, isAvailable: true, description: "2 pieces" },
      { id: "half", name: "Half", price: 280, isAvailable: true, description: "4 pieces" },
      { id: "full", name: "Full", price: 500, isAvailable: true, description: "8 pieces" },
    ],
    isAvailable: true,
    isFeatured: true,
    imageUrl: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80",
    sortOrder: 4,
    createdAt: "2026-01-10T10:00:00.000Z",
    updatedAt: "2026-01-10T10:00:00.000Z",
  },
  // 5. Chicken Biryani (Non-Veg, Half ₹220, Full ₹390)
  {
    id: "prod_vr_5",
    restaurantId: "rest_vivexa_01",
    categoryId: "cat_vr_mains",
    name: "Chicken Biryani",
    description: "Aged long-grain basmati rice layered with spiced marinated tender chicken, saffron-infused milk, and mint, sealed and cooked on dum.",
    price: 390,
    isVeg: false,
    dietaryType: "non_veg",
    portions: [
      { id: "half", name: "Half", price: 220, isAvailable: true, description: "Single serving with raita" },
      { id: "full", name: "Full", price: 390, isAvailable: true, description: "Serves 2 with salan & raita" },
    ],
    isAvailable: true,
    isFeatured: true,
    imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
    sortOrder: 5,
    createdAt: "2026-01-10T10:00:00.000Z",
    updatedAt: "2026-01-10T10:00:00.000Z",
  },
  // 6. Egg Curry (Egg, Half ₹130, Full ₹230)
  {
    id: "prod_vr_6",
    restaurantId: "rest_vivexa_01",
    categoryId: "cat_vr_mains",
    name: "Egg Curry",
    description: "Hard-boiled eggs golden-fried in turmeric oil and simmered in a spiced tangy tomato-onion gravy garnished with fresh coriander.",
    price: 230,
    isVeg: false,
    dietaryType: "egg",
    portions: [
      { id: "half", name: "Half", price: 130, isAvailable: true, description: "2 eggs" },
      { id: "full", name: "Full", price: 230, isAvailable: true, description: "4 eggs" },
    ],
    isAvailable: true,
    isFeatured: false,
    imageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80",
    sortOrder: 6,
    createdAt: "2026-01-10T10:00:00.000Z",
    updatedAt: "2026-01-10T10:00:00.000Z",
  },
  // 7. Butter Naan (Veg, Full ₹40)
  {
    id: "prod_vr_7",
    restaurantId: "rest_vivexa_01",
    categoryId: "cat_vr_breads",
    name: "Butter Naan",
    description: "Refined flour flatbread slapped onto the inner clay walls of the tandoor, baked to golden crisp perfection and brushed with pure butter.",
    price: 40,
    isVeg: true,
    dietaryType: "veg",
    portions: [
      { id: "full", name: "Full", price: 40, isAvailable: true, description: "1 piece" },
    ],
    isAvailable: true,
    isFeatured: false,
    imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
    sortOrder: 7,
    createdAt: "2026-01-10T10:00:00.000Z",
    updatedAt: "2026-01-10T10:00:00.000Z",
  },
];

// ------------------------------------------------------------------------------
// Initial Demo Table for Vivexa Restro
// ------------------------------------------------------------------------------
export const SEED_TABLES: TableItem[] = [
  {
    id: "tbl_vr_01",
    restaurantId: "rest_vivexa_01",
    restaurantSlug: "vivexa-restro",
    displayLabel: "Table 01",
    code: "table-01",
    isActive: true,
    createdAt: "2026-01-12T10:00:00.000Z",
    generatedBy: "GDF2eldrzSNR9oltgezCr9MXt0I3",
  },
];

// ------------------------------------------------------------------------------
// Orders: Initialized to empty array. Real database records only.
// Zero fake orders or fabricated revenue.
// ------------------------------------------------------------------------------
export const SEED_ORDERS: OrderItem[] = [];

// ------------------------------------------------------------------------------
// Registration Requests: Initialized to empty array. Real requests only.
// ------------------------------------------------------------------------------
export const SEED_REQUESTS: RestaurantRegistrationRequest[] = [];
