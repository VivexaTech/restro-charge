// ==============================================================================
// RESTROCHARGE - Cloud Firestore Service Layer
// Authoritative database operations, document serialization, and real-time listeners.
// Seamlessly delegates to Firebase Admin SDK (server) or client SDK (browser).
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
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type {
  RestaurantProfile,
  ProductCategory,
  ProductItem,
  TableItem,
  OrderItem,
  OrderStatus,
  RestaurantRegistrationRequest,
  AdminAuditLog,
  DiningSession,
  RestaurantMembership,
  RestaurantOffer,
} from "@/lib/types";

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

// Helper to convert Firestore Timestamps to ISO strings
function sanitizeFirestoreData<T>(data: any): T {
  if (!data) return data;
  const sanitized: any = { ...data };
  for (const key of Object.keys(sanitized)) {
    if (sanitized[key] instanceof Timestamp) {
      sanitized[key] = sanitized[key].toDate().toISOString();
    } else if (
      sanitized[key] &&
      typeof sanitized[key] === "object" &&
      !Array.isArray(sanitized[key]) &&
      typeof sanitized[key].toDate === "function"
    ) {
      sanitized[key] = sanitized[key].toDate().toISOString();
    } else if (
      sanitized[key] &&
      typeof sanitized[key] === "object" &&
      !Array.isArray(sanitized[key])
    ) {
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

export class FirestoreService {
  // ============================================================================
  // RESTAURANTS
  // ============================================================================
  public async getRestaurants(): Promise<RestaurantProfile[]> {
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        const snap = await adminDb.collection("restaurants").get();
        return snap.docs.map((d) =>
          sanitizeFirestoreData<RestaurantProfile>({ id: d.id, ...d.data() })
        );
      }
      const snap = await getDocs(collection(db, "restaurants"));
      return snap.docs.map((d) =>
        sanitizeFirestoreData<RestaurantProfile>({ id: d.id, ...d.data() })
      );
    } catch (err: any) {
      console.warn("[FirestoreService] getRestaurants fallback:", err.message);
      return [];
    }
  }

  public async getRestaurantById(id: string): Promise<RestaurantProfile | null> {
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        const snap = await adminDb.collection("restaurants").doc(id).get();
        if (!snap.exists) return null;
        return sanitizeFirestoreData<RestaurantProfile>({ id: snap.id, ...snap.data() });
      }
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
      const cleanSlug = slug.toLowerCase().trim();
      const adminDb = await getAdminDb();
      if (adminDb) {
        const snap = await adminDb
          .collection("restaurants")
          .where("slug", "==", cleanSlug)
          .limit(1)
          .get();
        if (snap.empty) return null;
        const d = snap.docs[0];
        return sanitizeFirestoreData<RestaurantProfile>({ id: d.id, ...d.data() });
      }
      const q = query(
        collection(db, "restaurants"),
        where("slug", "==", cleanSlug),
        limit(1)
      );
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

  // ============================================================================
  // MENU CATEGORIES
  // ============================================================================
  public async getCategories(restaurantId: string): Promise<ProductCategory[]> {
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        const snap = await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("categories")
          .get();
        const list = snap.docs.map((d) =>
          sanitizeFirestoreData<ProductCategory>({ id: d.id, ...d.data() })
        );
        return list.sort((a, b) => a.sortOrder - b.sortOrder);
      }
      const snap = await getDocs(collection(db, "restaurants", restaurantId, "categories"));
      const list = snap.docs.map((d) =>
        sanitizeFirestoreData<ProductCategory>({ id: d.id, ...d.data() })
      );
      return list.sort((a, b) => a.sortOrder - b.sortOrder);
    } catch (err: any) {
      console.warn("[FirestoreService] getCategories fallback:", err.message);
      return [];
    }
  }

  public async saveCategory(restaurantId: string, category: ProductCategory): Promise<void> {
    try {
      const payload = cleanUndefined(category);
      const adminDb = await getAdminDb();
      if (adminDb) {
        await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("categories")
          .doc(category.id)
          .set(payload, { merge: true });
      } else if (typeof window !== "undefined") {
        await setDoc(
          doc(db, "restaurants", restaurantId, "categories", category.id),
          payload,
          { merge: true }
        );
      }
    } catch (err: any) {
      console.warn("[FirestoreService] saveCategory error:", err.message);
    }
  }

  public async deleteCategory(restaurantId: string, categoryId: string): Promise<void> {
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("categories")
          .doc(categoryId)
          .delete();
      } else if (typeof window !== "undefined") {
        await deleteDoc(doc(db, "restaurants", restaurantId, "categories", categoryId));
      }
    } catch (err: any) {
      console.warn("[FirestoreService] deleteCategory error:", err.message);
    }
  }

  // ============================================================================
  // PRODUCTS
  // ============================================================================
  public async getProducts(restaurantId: string): Promise<ProductItem[]> {
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        const snap = await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("products")
          .get();
        const list = snap.docs.map((d) =>
          sanitizeFirestoreData<ProductItem>({ id: d.id, ...d.data() })
        );
        return list.sort((a, b) => a.sortOrder - b.sortOrder);
      }
      const snap = await getDocs(collection(db, "restaurants", restaurantId, "products"));
      const list = snap.docs.map((d) =>
        sanitizeFirestoreData<ProductItem>({ id: d.id, ...d.data() })
      );
      return list.sort((a, b) => a.sortOrder - b.sortOrder);
    } catch (err: any) {
      console.warn("[FirestoreService] getProducts fallback:", err.message);
      return [];
    }
  }

  public async saveProduct(restaurantId: string, product: ProductItem): Promise<void> {
    try {
      const payload = cleanUndefined(product);
      const adminDb = await getAdminDb();
      if (adminDb) {
        await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("products")
          .doc(product.id)
          .set(payload, { merge: true });
      } else if (typeof window !== "undefined") {
        await setDoc(
          doc(db, "restaurants", restaurantId, "products", product.id),
          payload,
          { merge: true }
        );
      }
    } catch (err: any) {
      console.warn("[FirestoreService] saveProduct error:", err.message);
    }
  }

  public async deleteProduct(restaurantId: string, productId: string): Promise<void> {
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("products")
          .doc(productId)
          .delete();
      } else if (typeof window !== "undefined") {
        await deleteDoc(doc(db, "restaurants", restaurantId, "products", productId));
      }
    } catch (err: any) {
      console.warn("[FirestoreService] deleteProduct error:", err.message);
    }
  }

  // ============================================================================
  // OFFERS & DISCOUNTS
  // ============================================================================
  public async getOffers(restaurantId: string): Promise<RestaurantOffer[]> {
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        const snap = await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("offers")
          .get();
        const list = snap.docs.map((d) =>
          sanitizeFirestoreData<RestaurantOffer>({ id: d.id, ...d.data() })
        );
        return list.sort((a, b) => (b.priority || 1) - (a.priority || 1));
      }
      const snap = await getDocs(collection(db, "restaurants", restaurantId, "offers"));
      const list = snap.docs.map((d) =>
        sanitizeFirestoreData<RestaurantOffer>({ id: d.id, ...d.data() })
      );
      return list.sort((a, b) => (b.priority || 1) - (a.priority || 1));
    } catch (err: any) {
      console.warn("[FirestoreService] getOffers fallback:", err.message);
      return [];
    }
  }

  public async saveOffer(restaurantId: string, offer: RestaurantOffer): Promise<void> {
    try {
      const payload = cleanUndefined(offer);
      const adminDb = await getAdminDb();
      if (adminDb) {
        await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("offers")
          .doc(offer.id)
          .set(payload, { merge: true });
      } else if (typeof window !== "undefined") {
        await setDoc(
          doc(db, "restaurants", restaurantId, "offers", offer.id),
          payload,
          { merge: true }
        );
      }
    } catch (err: any) {
      console.warn("[FirestoreService] saveOffer error:", err.message);
    }
  }

  public async deleteOffer(restaurantId: string, offerId: string): Promise<void> {
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("offers")
          .doc(offerId)
          .delete();
      } else if (typeof window !== "undefined") {
        await deleteDoc(doc(db, "restaurants", restaurantId, "offers", offerId));
      }
    } catch (err: any) {
      console.warn("[FirestoreService] deleteOffer error:", err.message);
    }
  }

  // ============================================================================
  // TABLES & QR
  // ============================================================================
  public async getTables(restaurantId: string): Promise<TableItem[]> {
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        const snap = await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("tables")
          .get();
        return snap.docs.map((d) =>
          sanitizeFirestoreData<TableItem>({ id: d.id, ...d.data() })
        );
      }
      const snap = await getDocs(collection(db, "restaurants", restaurantId, "tables"));
      return snap.docs.map((d) =>
        sanitizeFirestoreData<TableItem>({ id: d.id, ...d.data() })
      );
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
        await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("tables")
          .doc(table.id)
          .set(payload, { merge: true });
      } else if (typeof window !== "undefined") {
        await setDoc(
          doc(db, "restaurants", restaurantId, "tables", table.id),
          payload,
          { merge: true }
        );
      }
    } catch (err: any) {
      console.warn("[FirestoreService] saveTable error:", err.message);
    }
  }

  // ============================================================================
  // ORDERS
  // ============================================================================
  public async getOrders(restaurantId: string): Promise<OrderItem[]> {
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        const snap = await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("orders")
          .orderBy("createdAt", "desc")
          .limit(100)
          .get();
        return snap.docs.map((d) =>
          sanitizeFirestoreData<OrderItem>({ id: d.id, ...d.data() })
        );
      }
      const q = query(
        collection(db, "restaurants", restaurantId, "orders"),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) =>
        sanitizeFirestoreData<OrderItem>({ id: d.id, ...d.data() })
      );
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
        await setDoc(
          doc(db, "restaurants", order.restaurantId, "orders", order.id),
          payload
        );
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
    const nowIso = new Date().toISOString();
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        const orderRef = adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("orders")
          .doc(orderId);
        const snap = await orderRef.get();
        if (snap.exists) {
          const data = snap.data() || {};
          const history = data.statusHistory || [];
          const entry: any = { status, timestamp: nowIso, updatedBy };
          if (note) entry.note = note;
          history.push(entry);
          await orderRef.update({
            status,
            updatedAt: nowIso,
            statusHistory: history,
          });
        }
        return;
      }

      if (typeof window !== "undefined") {
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

  // ============================================================================
  // DINING SESSIONS & COMBINED BILLS
  // ============================================================================
  public async getDiningSession(
    restaurantId: string,
    sessionId: string
  ): Promise<DiningSession | null> {
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        const snap = await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("diningSessions")
          .doc(sessionId)
          .get();
        if (!snap.exists) return null;
        return sanitizeFirestoreData<DiningSession>({ id: snap.id, ...snap.data() });
      }
      const snap = await getDoc(
        doc(db, "restaurants", restaurantId, "diningSessions", sessionId)
      );
      if (!snap.exists()) return null;
      return sanitizeFirestoreData<DiningSession>({ id: snap.id, ...snap.data() });
    } catch (err: any) {
      console.warn("[FirestoreService] getDiningSession error:", err.message);
      return null;
    }
  }

  public async saveDiningSession(
    restaurantIdOrSession: string | DiningSession,
    maybeSession?: DiningSession
  ): Promise<void> {
    const session = typeof restaurantIdOrSession === "string" ? maybeSession! : restaurantIdOrSession;
    if (!session) return;
    try {
      const payload = cleanUndefined(session);
      const restaurantId = session.restaurantId || (typeof restaurantIdOrSession === "string" ? restaurantIdOrSession : "");
      const adminDb = await getAdminDb();
      if (adminDb) {
        await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("diningSessions")
          .doc(session.id)
          .set(payload, { merge: true });
      } else if (typeof window !== "undefined") {
        await setDoc(
          doc(db, "restaurants", restaurantId, "diningSessions", session.id),
          payload,
          { merge: true }
        );
      }
    } catch (err: any) {
      console.warn("[FirestoreService] saveDiningSession error:", err.message);
    }
  }

  public async getActiveSessionForTable(
    restaurantId: string,
    tableId: string
  ): Promise<DiningSession | null> {
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        const snap = await adminDb
          .collection("restaurants")
          .doc(restaurantId)
          .collection("diningSessions")
          .where("tableId", "==", tableId)
          .where("status", "==", "ACTIVE")
          .limit(1)
          .get();
        if (snap.empty) return null;
        const d = snap.docs[0];
        return sanitizeFirestoreData<DiningSession>({ id: d.id, ...d.data() });
      }
      const q = query(
        collection(db, "restaurants", restaurantId, "diningSessions"),
        where("tableId", "==", tableId),
        where("status", "==", "ACTIVE"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return sanitizeFirestoreData<DiningSession>({ id: d.id, ...d.data() });
    } catch (err: any) {
      console.warn("[FirestoreService] getActiveSessionForTable error:", err.message);
      return null;
    }
  }

  // ============================================================================
  // RESTAURANT MEMBERSHIPS
  // ============================================================================
  public async getMembershipsForUser(
    uid: string,
    email?: string
  ): Promise<RestaurantMembership[]> {
    const memberships: RestaurantMembership[] = [];
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        // Query by uid or userId
        const uidSnap = await adminDb
          .collection("restaurantMemberships")
          .where("uid", "==", uid)
          .get();
        uidSnap.forEach((d) =>
          memberships.push(
            sanitizeFirestoreData<RestaurantMembership>({ id: d.id, ...d.data() })
          )
        );

        const userIdSnap = await adminDb
          .collection("restaurantMemberships")
          .where("userId", "==", uid)
          .get();
        userIdSnap.forEach((d) => {
          if (!memberships.some((m) => m.id === d.id)) {
            memberships.push(
              sanitizeFirestoreData<RestaurantMembership>({ id: d.id, ...d.data() })
            );
          }
        });

        // Query by email if provided
        if (email) {
          const cleanEmail = email.toLowerCase().trim();
          const emailSnap = await adminDb
            .collection("restaurantMemberships")
            .where("email", "==", cleanEmail)
            .get();
          emailSnap.forEach((d) => {
            if (!memberships.some((m) => m.id === d.id)) {
              memberships.push(
                sanitizeFirestoreData<RestaurantMembership>({ id: d.id, ...d.data() })
              );
            }
          });

          const userEmailSnap = await adminDb
            .collection("restaurantMemberships")
            .where("userEmail", "==", cleanEmail)
            .get();
          userEmailSnap.forEach((d) => {
            if (!memberships.some((m) => m.id === d.id)) {
              memberships.push(
                sanitizeFirestoreData<RestaurantMembership>({ id: d.id, ...d.data() })
              );
            }
          });
        }
      }
    } catch (err: any) {
      console.warn("[FirestoreService] getMembershipsForUser error:", err.message);
    }
    return memberships;
  }

  public async saveMembership(membership: RestaurantMembership): Promise<void> {
    try {
      const payload = cleanUndefined(membership);
      const adminDb = await getAdminDb();
      if (adminDb) {
        await adminDb
          .collection("restaurantMemberships")
          .doc(membership.id)
          .set(payload, { merge: true });
      }
    } catch (err: any) {
      console.warn("[FirestoreService] saveMembership error:", err.message);
    }
  }

  // ============================================================================
  // REGISTRATION REQUESTS & AUDIT LOGS
  // ============================================================================
  public async getRequests(): Promise<RestaurantRegistrationRequest[]> {
    try {
      const adminDb = await getAdminDb();
      if (adminDb) {
        const snap = await adminDb
          .collection("restaurantRequests")
          .orderBy("createdAt", "desc")
          .limit(50)
          .get();
        return snap.docs.map((d) =>
          sanitizeFirestoreData<RestaurantRegistrationRequest>({ id: d.id, ...d.data() })
        );
      }
      const q = query(
        collection(db, "restaurantRequests"),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) =>
        sanitizeFirestoreData<RestaurantRegistrationRequest>({ id: d.id, ...d.data() })
      );
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
