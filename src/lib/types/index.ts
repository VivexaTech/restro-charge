// ==============================================================================
// RESTROCHARGE - Core Data Types & Schemas
// Multi-Tenant Restaurant SaaS by Vivexa Tech
// ==============================================================================

export type UserRole =
  | 'SUPER_ADMIN'
  | 'SALES_MANAGER'
  | 'ONBOARDING_EXECUTIVE'
  | 'SUPPORT_EXECUTIVE'
  | 'RESTAURANT_OWNER'
  | 'RESTAURANT_MANAGER'
  | 'ORDER_STAFF'
  | 'KITCHEN_STAFF'
  | 'CUSTOMER_GUEST';

export type NotificationSoundFile = '/a1.mp3' | '/a2.mp3' | '/a3.mp3' | '/a4.mp4' | '/a5.mp3';

export interface StaffNotificationPreferences {
  orderSound: NotificationSoundFile;
  soundEnabled: boolean;
  browserPushEnabled: boolean;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  role: UserRole;
  restaurantId?: string; // Set for restaurant-specific roles
  notificationPreferences?: StaffNotificationPreferences;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'GRACE_PERIOD' // 3-day grace period after expiry
  | 'EXPIRED'      // Beyond grace period - access blocked
  | 'SUSPENDED';

export interface SubscriptionInfo {
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  startDate: string; // ISO date
  expiryDate: string; // ISO date
  gracePeriodEnd: string; // ISO date (expiry + 3 days)
  autoRenew: false; // Explicitly false: No auto-recurring payments per Vivexa business rules
  lastPaymentId?: string;
  updatedAt: string;
  trialStartDate?: string; // ISO date when free trial was granted
  trialEndDate?: string;   // ISO date when free trial concludes
  isTrial?: boolean;
  trialDays?: number;
  grantedBy?: string;      // Authorized Vivexa Tech Super Admin identifier
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  limits: {
    maxTables: number;
    maxProducts: number;
    maxStaff: number;
  };
  isPopular?: boolean;
  isActive: boolean;
  isTrialAvailable?: boolean;
}

export interface BillingConfig {
  itemOnly: boolean;
  gstEnabled: boolean;
  gstRate: number; // e.g., 5 for 5%
  serviceChargeEnabled: boolean;
  serviceChargeRate: number; // e.g., 5 for 5%
  calculationBasis: 'TAX_ON_SUBTOTAL' | 'TAX_ON_SUBTOTAL_PLUS_SERVICE';
  additionalCharges?: {
    id: string;
    label: string;
    amount: number;
    type: 'PERCENTAGE' | 'FIXED';
  }[];
}

export interface RestaurantBranding {
  logoUrl: string;
  coverImageUrl: string;
  primaryColor: string; // Hex color e.g., #f97316
  secondaryColor: string; // Hex color
  accentColor: string;
  fontPreset: 'inter' | 'playfair' | 'outfit' | 'montserrat';
  galleryImages: string[];
}

export interface RestaurantWebsiteConfig {
  heroTitle?: string;
  heroSubtitle?: string;
  heroLayout: 'centered' | 'split' | 'minimal';
  menuLayout: 'grid' | 'list' | 'categorized';
  aboutText?: string;
  openingHours: {
    days: string;
    open: string;
    close: string;
  }[];
  contactPhone: string;
  contactEmail: string;
  address: string;
  city: string;
  directionsUrl?: string;
  amenities: string[];
  socialLinks: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
  };
  sectionsVisibility: {
    hero: boolean;
    about: boolean;
    menu: boolean;
    gallery: boolean;
    hours: boolean;
    contact: boolean;
    amenities: boolean;
  };
  seoTitle?: string;
  seoDescription?: string;
}

export interface RestaurantLocationSettings {
  latitude: number | null;
  longitude: number | null;
  orderingRadiusMetres: number;
  customerSessionRadiusMeters?: number; // Configurable dining session radius (default 300m)
  locationRestrictionEnabled: boolean;
  isConfigured: boolean;
  addressSnapshot?: string;
  timezone?: string; // Venue timezone e.g. "Asia/Kolkata"
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface RestaurantProfile {
  id: string;
  name: string;
  slug: string; // e.g. 'vivexa-restro' -> restrocharge.vivexatech.in/vivexa-restro
  isDemo?: boolean; // Identifies the official Vivexa Tech single demo venue
  cuisineType: string;
  description: string;
  ownerUid: string;
  ownerEmail: string;
  ownerName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  published: boolean;
  operationalSettings: {
    isAcceptingOrders: boolean;
    currency: string; // 'INR'
    tableCount: number;
  };
  locationSettings?: RestaurantLocationSettings;
  branding: RestaurantBranding;
  websiteConfig: RestaurantWebsiteConfig;
  billingConfig: BillingConfig;
  subscription: SubscriptionInfo;
  adminProvisioningStatus?: 'PROVISIONED' | 'PENDING' | 'FAILED' | 'PARTIAL_FAILURE';
  adminProvisioningError?: string | null;
  adminProvisionedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export type DietaryClassification = 'veg' | 'non_veg' | 'egg';

export interface ProductPortion {
  id: string; // e.g. 'quarter' | 'half' | 'full' | custom
  name: string; // e.g. 'Quarter' | 'Half' | 'Full'
  price: number;
  isAvailable: boolean;
  description?: string;
}

export interface ProductItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number; // Base price or full portion reference price
  isVeg: boolean; // Retained for backward compatibility
  dietaryType: DietaryClassification;
  portions?: ProductPortion[];
  isAvailable: boolean;
  isFeatured?: boolean;
  imageUrl?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TableItem {
  id: string; // Stable internal table ID e.g., 'tbl_01'
  restaurantId: string;
  restaurantSlug: string;
  displayLabel: string; // e.g., "Table 01" or "Rooftop 5"
  code: string; // Slug code in URL: /order/vivexa-restro/table-01
  qrCodeUrl?: string; // QR image SVG/PNG data URI
  isActive: boolean;
  createdAt: string;
  generatedBy?: string; // Vivexa Tech super admin UID
}

export type OrderStatus =
  | 'NEW'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'CANCELLED';

export type OfferType = 'DAY_WISE' | 'CATEGORY' | 'EVENT' | 'COMBO';

export type DiscountMethod = 'FIXED_PRICE' | 'PERCENTAGE' | 'FIXED_AMOUNT';

export type OfferStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface ComboItemConfig {
  productId: string;
  quantity: number;
  portionId?: string;
}

export interface ComboItemSnapshot {
  productId: string;
  productName: string;
  quantity: number;
  portionId?: string;
  portionName?: string;
}

export interface RestaurantOffer {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  offerType: OfferType;
  discountMethod: DiscountMethod;
  discountValue: number; // E.g., 99 for fixed ₹99, 25 for 25%, or 30 for ₹30 off
  eligibleItemIds: string[]; // Specific product IDs
  eligibleCategoryIds: string[]; // Specific category IDs
  comboItems?: ComboItemConfig[]; // Populated when offerType === 'COMBO'
  comboPrice?: number; // Price of the entire combo
  applicableDays?: DayOfWeek[]; // E.g., ['tuesday']
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm (24-hour)
  endTime?: string; // HH:mm (24-hour)
  timezone?: string; // e.g. 'Asia/Kolkata'
  priority: number; // 1 to 100, higher number = higher priority
  status: OfferStatus;
  dineInOnly?: boolean; // When true, restricted strictly to verified dine-in sessions with valid table code
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  price: number; // Effective unit price charged
  regularPrice?: number; // Base regular price before discount
  discountAmount?: number; // Per-unit discount (regularPrice - price)
  appliedOfferId?: string;
  appliedOfferName?: string;
  appliedOfferType?: OfferType;
  isCombo?: boolean;
  comboItemsSnapshot?: ComboItemSnapshot[];
  quantity: number;
  isVeg: boolean;
  dietaryType?: DietaryClassification;
  portionId?: string; // e.g. 'quarter', 'half', 'full'
  portionName?: string; // e.g. 'Quarter', 'Half', 'Full'
  categoryName?: string;
  lineTotal?: number;
}

export interface OrderBillingBreakdown {
  subtotal: number;
  gstEnabled: boolean;
  gstRate: number;
  gstAmount: number;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
  serviceChargeAmount: number;
  additionalChargesAmount: number;
  finalTotal: number;
  appliedConfigSnapshot: BillingConfig;
}

export interface OrderItem {
  id: string;
  orderNumber: string; // e.g. #RC-1042
  restaurantId: string;
  restaurantSlug: string;
  tableId: string;
  tableLabel: string;
  diningSessionId?: string; // Connected active customer dining visit
  idempotencyKey?: string; // Client idempotency protection
  items: OrderItemSnapshot[];
  billing: OrderBillingBreakdown;
  status: OrderStatus;
  statusHistory: {
    status: OrderStatus;
    timestamp: string;
    updatedBy: string;
    note?: string;
  }[];
  customerNotes?: string;
  acceptedBy?: {
    uid: string;
    name: string;
    email: string;
    at: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PushSubscriptionRecord {
  id: string; // Token hash or unique token ID
  token: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  restaurantId: string;
  deviceType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantMembership {
  id: string;
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  uid: string;
  userId?: string;
  email: string;
  userEmail?: string;
  displayName?: string;
  role: 'RESTAURANT_OWNER' | 'RESTAURANT_MANAGER' | 'KITCHEN_STAFF' | 'ORDER_STAFF';
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

export interface DiningSessionOrderSummary {
  orderId: string;
  orderNumber: string;
  placedAt: string;
  itemCount: number;
  subtotal: number;
  status: OrderStatus;
}

export interface DiningSession {
  id: string; // e.g. "dsess_..."
  restaurantId: string;
  restaurantSlug: string;
  tableId: string;
  tableCode: string;
  sessionToken: string; // Unguessable token delivered to client
  sessionTokenHash: string; // SHA-256 hash stored on server
  status: 'ACTIVE' | 'CLOSED';
  startedAt: string;
  lastActivityAt: string;
  lastVerifiedLocationAt?: string;
  lastVerifiedLatitude?: number | null;
  lastVerifiedLongitude?: number | null;
  lastVerifiedDistanceMetres?: number | null;
  departureCheckCount?: number;
  orderIds: string[];
  items: OrderItemSnapshot[];
  billing: OrderBillingBreakdown; // Authoritative combined bill
  ordersSummary: DiningSessionOrderSummary[];
  closedAt?: string;
  closedReason?: 'DEPARTURE_RADIUS_EXCEEDED' | 'MANUAL_STAFF_CLOSE' | 'SESSION_TIMEOUT';
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantRegistrationRequest {
  id: string;
  applicantName: string;
  restaurantName: string;
  email: string;
  phone: string;
  city: string;
  cuisine: string;
  estimatedTables: number;
  message?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface SubscriptionPaymentRecord {
  id: string;
  restaurantId: string;
  restaurantName: string;
  planId: string;
  planName: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  amount: number;
  currency: string;
  paymentType: 'RAZORPAY' | 'MANUAL';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  manualReason?: string;
  authorizedBy?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
  verifiedAt?: string;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  targetType: 'RESTAURANT' | 'SUBSCRIPTION' | 'TABLE_QR' | 'BILLING' | 'STAFF' | 'USER';
  targetId: string;
  performedBy: {
    uid: string;
    email: string;
    name: string;
  };
  details: Record<string, any>;
  timestamp: string;
}
