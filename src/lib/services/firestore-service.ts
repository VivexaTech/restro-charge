// ==============================================================================
// RESTROCHARGE - Cloud Firestore Service Layer
// Production database operations, document serialization, and real-time listeners.
// ==============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

async function getAdminDb() {
  if (typeof window === "undefined") {
    try {
      const { adminDb, isFirebaseAdminReady } = await import("@/lib/firebase/admin");
      if (isFirebaseAdminReady()) {
        return adminDb;
      }
    } catch {
      return null;
    }
  }
  return null;
}
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
  UserProfile,
} from "@/lib/types";

// Helper to convert Firestore Timestamps to ISO strings
function sanitizeFirestoreData<T>(data: any): T {
  if (!data) return data;
  const sanitized: any = { ...data };
  for (const key of Object.keys(sanitized)) {
    if (sanitized[key] instanceof Timestamp) {
      sanitized[key] = sanitized[key].toDate().toISOString();
    } else if (sanitized[key] && typeof sanitized[key] === "object" && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeFirestoreData(sanitized[key]);
    }
  }
  return sanitized as T;
}

// Helper to strip undefined values so Firestore does not reject writes
function cleanUndefined(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  if (typeof obj === "object" && !(obj instanceof Date) && !(obj instanceof Timestamp)) {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        res[key] = cleanUndefined(obj[key]);
      }
    }
    return res;
  }
  return obj;
}

function canWriteFirestore(): boolean {
  return typeof window !== "undefined";
}

export class FirestoreService {
  // --- RESTAURANTS ---
  public async getRestaurants(): Promise<RestaurantProfile[]> {
    try {
      const snap = await getDocs(collection(db, "restaurants"));
      return snap.docs.map((d) => sanitizeFirestoreData<RestaurantProfile>({ id: d.id, ...d.data() }));
    } catch (err: any) {
      console.warn("[FirestoreService] getRestaurants fallback:", err.message);
      return [];
    }
  }

  public async getRestaurantById(id: string): Promise<RestaurantProfile | null> {
    try {
      const snap = await getDoc(doc(db, "restaurants", id));
      if (!snap.exists()) return null;
      return sanitizeFirestoreData<RestaurantProfile>({ id: snap.id, ...snap.data() });
    } catch (err: any) {
      console.warn("[FirestoreService] getRestaurantById fallback:", err.message);
      return null;
    }
  }

  public async getRestaurantBySlug(slug: string): Promise<RestaurantProfile | null> {
    try {
      const q = query(collection(db, "restaurants"), where("slug", "==", slug.toLowerCase().trim()), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return sanitizeFirestoreData<RestaurantProfile>({ id: d.id, ...d.data() });
    } catch (err: any) {
      console.warn("[FirestoreService] getRestaurantBySlug fallback:", err.message);
      return null;
    }
  }

  public async saveRestaurant(restaurant: RestaurantProfile): Promise<void> {
    try {
      const payload = cleanUndefined(restaurant);
      const adminDb = await getAdminDb();
      if (adminDb) {
        await adminDb.collection("restaurants").doc(restaurant.id).set(payload, { merge: true });
      } else if (typeof window !== "undefined") {
        await setDoc(doc(db, "restaurants", restaurant.id), payload, { merge: true });
      }
    } catch (err: any) {
      console.warn("[FirestoreService] saveRestaurant error:", err.message);
    }
  }

  // --- MENU CATEGORIES ---
  public async getCategories(restaurantId: string): Promise<ProductCategory[]> {
    try {
      const snap = await getDocs(collection(db, "restaurants", restaurantId, "categories"));
      const list = snap.docs.map((d) => sanitizeFirestoreData<ProductCategory>({ id: d.id, ...d.data() }));
      return list.sort((a, b) => a.sortOrder - b.sortOrder);
    } catch (err: any) {
      console.warn("[FirestoreService] getCategories fallback:", err.message);
      return [];
    }
  }

  public async saveCategory(restaurantId: string, category: ProductCategory): Promise<void> {
    try {
      if (typeof window !== "undefined") {
        await setDoc(doc(db, "restaurants", restaurantId, "categories", category.id), cleanUndefined(category), { merge: true });
      }
    } catch (err: any) {
      console.warn("[FirestoreService] saveCategory error:", err.message);
    }
  }

  public async deleteCategory(restaurantId: string, categoryId: string): Promise<void> {
    try {
      if (typeof window !== "undefined") {
        await deleteDoc(doc(db, "restaurants", restaurantId, "categories", categoryId));
      }
    } catch (err: any) {
      console.warn("[FirestoreService] deleteCategory error:", err.message);
    }
  }

  // --- PRODUCTS ---
  public async getProducts(restaurantId: string): Promise<ProductItem[]> {
    try {
      const snap = await getDocs(collection(db, "restaurants", restaurantId, "products"));
      const list = snap.docs.map((d) => sanitizeFirestoreData<ProductItem>({ id: d.id, ...d.data() }));
      return list.sort((a, b) => a.sortOrder - b.sortOrder);
    } catch (err: any) {
      console.warn("[FirestoreService] getProducts fallback:", err.message);
      return [];
    }
  }

  public async saveProduct(restaurantId: string, product: ProductItem): Promise<void> {
    try {
      if (typeof window !== "undefined") {
        await setDoc(doc(db, "restaurants", restaurantId, "products", product.id), cleanUndefined(product), { merge: true });
      }
    } catch (err: any) {
      console.warn("[FirestoreService] saveProduct error:", err.message);
    }
  }

  public async deleteProduct(restaurantId: string, productId: string): Promise<void> {
    try {
      if (typeof window !== "undefined") {
        await deleteDoc(doc(db, "restaurants", restaurantId, "products", productId));
      }
    } catch (err: any) {
      console.warn("[FirestoreService] deleteProduct error:", err.message);
    }
  }

  // --- TABLES & QR ---
  public async getTables(restaurantId: string): Promise<TableItem[]> {
    try {
      const snap = await getDocs(collection(db, "restaurants", restaurantId, "tables"));
      return snap.docs.map((d) => sanitizeFirestoreData<TableItem>({ id: d.id, ...d.data() }));
    } catch (err: any) {
      console.warn("[FirestoreService] getTables fallback:", err.message);
      return [];
    }
  }

  public async saveTable(restaurantId: string, table: TableItem): Promise<void> {
    try {
      const payload = cleanUndefined(table);
      const adminDb = await getAdminDb();
      if (adminDb) {
        await adminDb.collection("restaurants").doc(restaurantId).collection("tables").doc(table.id).set(payload, { merge: true });
      } else if (typeof window !== "undefined") {
        await setDoc(doc(db, "restaurants", restaurantId, "tables", table.id), payload, { merge: true });
      }
    } catch (err: any) {
      console.warn("[FirestoreService] saveTable error:", err.message);
    }
  }

  // --- ORDERS ---
  public async getOrders(restaurantId: string): Promise<OrderItem[]> {
    try {
      const q = query(
        collection(db, "restaurants", restaurantId, "orders"),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => sanitizeFirestoreData<OrderItem>({ id: d.id, ...d.data() }));
    } catch (err: any) {
      console.warn("[FirestoreService] getOrders fallback:", err.message);
      return [];
    }
  }

  public async saveOrder(order: OrderItem): Promise<void> {
    try {
      const payload = cleanUndefined(order);
      const adminDb = await getAdminDb();
      if (adminDb) {
        await adminDb
          .collection("restaurants")
          .doc(order.restaurantId)
          .collection("orders")
          .doc(order.id)
          .set(payload);
      } else if (typeof window !== "undefined") {
        await setDoc(doc(db, "restaurants", order.restaurantId, "orders", order.id), payload);
      }
    } catch (err: any) {
      console.warn("[FirestoreService] saveOrder error:", err.message);
    }
  }

  public async updateOrderStatus(
    restaurantId: string,
    orderId: string,
    status: OrderStatus,
    updatedBy: string,
    note?: string
  ): Promise<void> {
    if (typeof window === "undefined") return;
    const nowIso = new Date().toISOString();
    try {
      const orderRef = doc(db, "restaurants", restaurantId, "orders", orderId);
      const snap = await getDoc(orderRef);
      if (snap.exists()) {
        const data = snap.data();
        const history = data.statusHistory || [];
        const entry: any = { status, timestamp: nowIso, updatedBy };
        if (note) entry.note = note;
        history.push(entry);
        await updateDoc(orderRef, {
          status,
          updatedAt: nowIso,
          statusHistory: history,
        });
      }
    } catch (err: any) {
      console.warn("[FirestoreService] updateOrderStatus error:", err.message);
    }
  }

  public subscribeOrders(
    restaurantId: string,
    onOrdersUpdated: (orders: OrderItem[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, "restaurants", restaurantId, "orders"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((d) =>
          sanitizeFirestoreData<OrderItem>({ id: d.id, ...d.data() })
        );
        onOrdersUpdated(orders);
      },
      (error) => {
        console.warn("[FirestoreService] Real-time orders listener error:", error.message);
        if (onError) onError(error);
      }
    );
  }

  // --- REGISTRATION REQUESTS ---
  public async getRequests(): Promise<RestaurantRegistrationRequest[]> {
    try {
      const q = query(collection(db, "restaurantRequests"), orderBy("createdAt", "desc"), limit(50));
      const snap = await getDocs(q);
      return snap.docs.map((d) => sanitizeFirestoreData<RestaurantRegistrationRequest>({ id: d.id, ...d.data() }));
    } catch (err: any) {
      console.warn("[FirestoreService] getRequests fallback:", err.message);
      return [];
    }
  }

  public async saveRequest(req: RestaurantRegistrationRequest): Promise<void> {
    try {
      const payload = cleanUndefined(req);
      const adminDb = await getAdminDb();
      if (adminDb) {
        await adminDb.collection("restaurantRequests").doc(req.id).set(payload, { merge: true });
      } else if (typeof window !== "undefined") {
        await setDoc(doc(db, "restaurantRequests", req.id), payload, { merge: true });
      }
    } catch (err: any) {
      console.warn("[FirestoreService] saveRequest error:", err.message);
    }
  }

  // --- AUDIT LOGS ---
  public async addAuditLog(log: AdminAuditLog): Promise<void> {
    try {
      const payload = cleanUndefined(log);
      const adminDb = await getAdminDb();
      if (adminDb) {
        await adminDb.collection("adminAuditLogs").doc(log.id).set(payload);
      } else if (typeof window !== "undefined") {
        await setDoc(doc(db, "adminAuditLogs", log.id), payload);
      }
    } catch (err: any) {
      console.warn("[FirestoreService] addAuditLog error:", err.message);
    }
  }
}

export const firestoreService = new FirestoreService();
