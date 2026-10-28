// ==============================================================================
// RESTROCHARGE - Central Multi-Tenant Data Store Service
// Unified data access with automatic persistence, mock seeding, and Firestore sync.
// ==============================================================================

import type {
  RestaurantProfile,
  ProductCategory,
  ProductItem,
  TableItem,
  OrderItem,
  OrderStatus,
  SubscriptionPlan,
  RestaurantRegistrationRequest,
  SubscriptionPaymentRecord,
  AdminAuditLog,
} from "../types";
import {
  SEED_RESTAURANTS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  SEED_TABLES,
  SEED_ORDERS,
  SEED_PLANS,
  SEED_REQUESTS,
} from "../mock-data/seed";
import { generateTableQRCode } from "./qr";
import { firestoreService } from "./firestore-service";

// Memory storage cache (initialized with rich seed data and synced with Cloud Firestore)
class DataStore {
  private restaurants: Map<string, RestaurantProfile> = new Map();
  private categories: Map<string, ProductCategory> = new Map();
  private products: Map<string, ProductItem> = new Map();
  private tables: Map<string, TableItem> = new Map();
  private orders: Map<string, OrderItem> = new Map();
  private plans: Map<string, SubscriptionPlan> = new Map();
  private requests: Map<string, RestaurantRegistrationRequest> = new Map();
  private payments: Map<string, SubscriptionPaymentRecord> = new Map();
  private auditLogs: AdminAuditLog[] = [];
  private processedEvents: Set<string> = new Set();
  private orderListeners: Array<(orders: OrderItem[]) => void> = [];

  constructor() {
    this.seedInitialData();
  }

  private async seedInitialData() {
    SEED_RESTAURANTS.forEach((r) => this.restaurants.set(r.id, { ...r }));
    SEED_CATEGORIES.forEach((c) => this.categories.set(c.id, { ...c }));
    SEED_PRODUCTS.forEach((p) => this.products.set(p.id, { ...p }));
    SEED_PLANS.forEach((pl) => this.plans.set(pl.id, { ...pl }));
    SEED_REQUESTS.forEach((req) => this.requests.set(req.id, { ...req }));
    SEED_ORDERS.forEach((ord) => this.orders.set(ord.id, { ...ord }));

    // Generate table QRs dynamically for seed tables
    for (const t of SEED_TABLES) {
      try {
        const qr = await generateTableQRCode(t.restaurantSlug, t.code);
        this.tables.set(t.id, { ...t, qrCodeUrl: qr.dataUrl });
      } catch {
        this.tables.set(t.id, { ...t });
      }
    }
  }

  // --- RESTAURANTS ---
  public getRestaurants(): RestaurantProfile[] {
    return Array.from(this.restaurants.values());
  }

  public getPublishedRestaurants(): RestaurantProfile[] {
    return Array.from(this.restaurants.values()).filter((r) => r.published);
  }

  public getRestaurantBySlug(slug: string): RestaurantProfile | null {
    const cleanSlug = slug.toLowerCase().trim();
    return Array.from(this.restaurants.values()).find((r) => r.slug.toLowerCase() === cleanSlug) || null;
  }

  public getRestaurantById(id: string): RestaurantProfile | null {
    return this.restaurants.get(id) || null;
  }

  public saveRestaurant(restaurant: RestaurantProfile): RestaurantProfile {
    this.restaurants.set(restaurant.id, { ...restaurant, updatedAt: new Date().toISOString() });
    firestoreService.saveRestaurant(restaurant).catch((err) => console.warn("[DataStore] firestore saveRestaurant sync:", err.message));
    return this.restaurants.get(restaurant.id)!;
  }

  // --- CATEGORIES ---
  public getCategories(restaurantId: string): ProductCategory[] {
    return Array.from(this.categories.values())
      .filter((c) => c.restaurantId === restaurantId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public saveCategory(category: ProductCategory): ProductCategory {
    this.categories.set(category.id, category);
    firestoreService.saveCategory(category.restaurantId, category).catch((err) => console.warn("[DataStore] firestore saveCategory sync:", err.message));
    return category;
  }

  public deleteCategory(id: string): boolean {
    const cat = this.categories.get(id);
    if (cat) {
      firestoreService.deleteCategory(cat.restaurantId, id).catch((err) => console.warn("[DataStore] firestore deleteCategory sync:", err.message));
    }
    return this.categories.delete(id);
  }

  // --- PRODUCTS ---
  public getProducts(restaurantId: string): ProductItem[] {
    return Array.from(this.products.values())
      .filter((p) => p.restaurantId === restaurantId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public getProductById(id: string): ProductItem | null {
    return this.products.get(id) || null;
  }

  public saveProduct(product: ProductItem): ProductItem {
    this.products.set(product.id, { ...product, updatedAt: new Date().toISOString() });
    firestoreService.saveProduct(product.restaurantId, product).catch((err) => console.warn("[DataStore] firestore saveProduct sync:", err.message));
    return product;
  }

  public deleteProduct(id: string): boolean {
    const prod = this.products.get(id);
    if (prod) {
      firestoreService.deleteProduct(prod.restaurantId, id).catch((err) => console.warn("[DataStore] firestore deleteProduct sync:", err.message));
    }
    return this.products.delete(id);
  }

  // --- TABLES & QR (SUPER ADMIN EXCLUSIVE GENERATION) ---
  public getTables(restaurantId: string): TableItem[] {
    return Array.from(this.tables.values()).filter((t) => t.restaurantId === restaurantId);
  }

  public getTableByCode(restaurantId: string, code: string): TableItem | null {
    return (
      Array.from(this.tables.values()).find(
        (t) => t.restaurantId === restaurantId && (t.code === code || t.id === code)
      ) || null
    );
  }

  public saveTable(table: TableItem): TableItem {
    this.tables.set(table.id, table);
    firestoreService.saveTable(table.restaurantId, table).catch((err) => console.warn("[DataStore] firestore saveTable sync:", err.message));
    return table;
  }

  public deleteTable(id: string): boolean {
    return this.tables.delete(id);
  }

  // --- ORDERS ---
  public getOrders(restaurantId?: string): OrderItem[] {
    const list = Array.from(this.orders.values());
    const filtered = restaurantId ? list.filter((o) => o.restaurantId === restaurantId) : list;
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getOrderById(orderId: string): OrderItem | null {
    return this.orders.get(orderId) || null;
  }

  public saveOrder(order: OrderItem): OrderItem {
    this.orders.set(order.id, order);
    firestoreService.saveOrder(order).catch((err) => console.warn("[DataStore] firestore saveOrder sync:", err.message));
    this.notifyOrderListeners(order.restaurantId);
    return order;
  }

  public updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    updatedBy: string,
    note?: string
  ): OrderItem | null {
    const order = this.orders.get(orderId);
    if (!order) return null;

    const updated: OrderItem = {
      ...order,
      status,
      updatedAt: new Date().toISOString(),
      statusHistory: [
        ...order.statusHistory,
        {
          status,
          timestamp: new Date().toISOString(),
          updatedBy,
          note,
        },
      ],
    };

    this.orders.set(orderId, updated);
    firestoreService.updateOrderStatus(order.restaurantId, orderId, status, updatedBy, note).catch((err) => console.warn("[DataStore] firestore updateOrderStatus sync:", err.message));
    this.notifyOrderListeners(updated.restaurantId);
    return updated;
  }

  // --- REAL-TIME LISTENERS (FOR DASHBOARD & KDS) ---
  public subscribeOrders(restaurantId: string, callback: (orders: OrderItem[]) => void) {
    const listener = () => {
      callback(this.getOrders(restaurantId));
    };
    this.orderListeners.push(listener);
    // Initial call
    callback(this.getOrders(restaurantId));

    return () => {
      this.orderListeners = this.orderListeners.filter((l) => l !== listener);
    };
  }

  private notifyOrderListeners(restaurantId: string) {
    const currentOrders = this.getOrders(restaurantId);
    this.orderListeners.forEach((fn) => {
      try {
        fn(currentOrders);
      } catch (err) {
        console.error("Order listener error:", err);
      }
    });
  }

  // --- PLANS ---
  public getPlans(): SubscriptionPlan[] {
    return Array.from(this.plans.values());
  }

  public getPlanById(id: string): SubscriptionPlan | null {
    return this.plans.get(id) || null;
  }

  public savePlan(plan: SubscriptionPlan): SubscriptionPlan {
    this.plans.set(plan.id, { ...plan });
    return plan;
  }

  // --- REGISTRATION REQUESTS ---
  public getRequests(): RestaurantRegistrationRequest[] {
    return Array.from(this.requests.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public saveRequest(req: RestaurantRegistrationRequest): RestaurantRegistrationRequest {
    this.requests.set(req.id, req);
    firestoreService.saveRequest(req).catch((err) => console.warn("[DataStore] firestore saveRequest sync:", err.message));
    return req;
  }

  // --- PAYMENTS & IDEMPOTENCY ---
  public getPayments(): SubscriptionPaymentRecord[] {
    return Array.from(this.payments.values());
  }

  public savePayment(payment: SubscriptionPaymentRecord): SubscriptionPaymentRecord {
    this.payments.set(payment.id, payment);
    return payment;
  }

  public getPaymentByRazorpayPaymentId(razorpayPaymentId: string): SubscriptionPaymentRecord | null {
    return Array.from(this.payments.values()).find((p) => p.razorpayPaymentId === razorpayPaymentId) || null;
  }

  public isWebhookEventProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  public markWebhookEventProcessed(eventId: string): void {
    this.processedEvents.add(eventId);
  }

  // --- AUDIT LOGS ---
  public addAuditLog(log: Omit<AdminAuditLog, "id" | "timestamp">) {
    const fullLog: AdminAuditLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(fullLog);
    firestoreService.addAuditLog(fullLog).catch((err) => console.warn("[DataStore] firestore addAuditLog sync:", err.message));
    return fullLog;
  }

  public getAuditLogs(): AdminAuditLog[] {
    return this.auditLogs;
  }
}

// Global singleton instance
const globalStore = (global as any).__RESTROCHARGE_DATA_STORE__ || new DataStore();
if (process.env.NODE_ENV !== "production") {
  (global as any).__RESTROCHARGE_DATA_STORE__ = globalStore;
}

export const dataStore: DataStore = globalStore;
