// ==============================================================================
// RESTROCHARGE - Customer Dining Session & Combined Billing Engine
// Maintains continuous table dining sessions for multi-round QR orders.
// Calculates authoritative combined bills while preserving individual order records.
// Enforces 300m departure radius with poor-accuracy protection (>100m).
// ==============================================================================

import crypto from "crypto";
import {
  DiningSession,
  DiningSessionOrderSummary,
  OrderItem,
  OrderItemSnapshot,
  RestaurantProfile,
  RestaurantLocationSettings,
  BillingConfig,
} from "../types";
import { dataStore } from "./data-store";
import { firestoreService } from "./firestore-service";
import { calculateOrderBill } from "./billing";
import { calculateHaversineDistanceMetres, MAX_RELIABLE_ACCURACY_METRES } from "./geo";

export const DEFAULT_CUSTOMER_SESSION_DEPARTURE_RADIUS_METRES = 300;

export function hashDiningSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateDiningSessionToken(): string {
  return `dsess_tok_${crypto.randomBytes(24).toString("hex")}`;
}

export interface ResolveSessionParams {
  restaurantId: string;
  restaurantSlug: string;
  tableId: string;
  tableCode: string;
  sessionToken?: string | null;
  customerLocation?: {
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
  } | null;
  locationSettings?: RestaurantLocationSettings | null;
  billingConfig?: BillingConfig | null;
}

export interface ResolveSessionResult {
  session: DiningSession;
  isNew: boolean;
  departureTriggered: boolean;
  message?: string;
}

export class DiningSessionService {
  /**
   * Resolves an existing active dining session for the customer/table,
   * evaluates the 300m departure radius, or creates a new session.
   */
  public async getOrCreateSession(params: ResolveSessionParams): Promise<ResolveSessionResult> {
    const {
      restaurantId,
      restaurantSlug,
      tableId,
      tableCode,
      sessionToken,
      customerLocation,
      locationSettings,
      billingConfig,
    } = params;

    const nowIso = new Date().toISOString();
    let existingSession: DiningSession | null = null;

    // 1. If client provided a session token, locate the session
    if (sessionToken && sessionToken.trim()) {
      const cleanToken = sessionToken.trim();
      const tokenHash = hashDiningSessionToken(cleanToken);

      // Check local cache
      existingSession = dataStore.getDiningSessionByTokenHash(tokenHash);

      // If not in local cache, check Cloud Firestore
      if (!existingSession) {
        try {
          const fromDb = await firestoreService.getDiningSession(restaurantId, cleanToken);
          if (fromDb) {
            existingSession = fromDb;
            dataStore.saveDiningSessionLocally(fromDb);
          }
        } catch (err: any) {
          console.warn("[DiningSession] Firestore read warning:", err.message);
        }
      }

      // Verify session belongs strictly to the requesting restaurant and table
      if (
        existingSession &&
        (existingSession.restaurantId !== restaurantId || existingSession.tableId !== tableId)
      ) {
        existingSession = null;
      }
    }

    // 2. Multi-customer table isolation:
    // If no session token was supplied or token is invalid/closed, do NOT merge
    // into another customer's active session. Always spawn an independent session.

    // 3. If an existing ACTIVE session is found, evaluate the departure radius
    if (existingSession && existingSession.status === "ACTIVE") {
      const departureRadius =
        locationSettings?.customerSessionRadiusMeters ||
        DEFAULT_CUSTOMER_SESSION_DEPARTURE_RADIUS_METRES;

      let departureExceeded = false;
      let calculatedDistance: number | null = null;

      // Departure verification only if restaurant has coordinates and customer provided valid coordinates
      if (
        locationSettings?.latitude !== undefined &&
        locationSettings?.latitude !== null &&
        locationSettings?.longitude !== undefined &&
        locationSettings?.longitude !== null &&
        customerLocation?.latitude !== undefined &&
        customerLocation?.latitude !== null &&
        customerLocation?.longitude !== undefined &&
        customerLocation?.longitude !== null
      ) {
        const accuracy = customerLocation.accuracy ?? 10;

        // Poor Accuracy Protection Rule:
        // If accuracy is worse than MAX_RELIABLE_ACCURACY_METRES (100m, e.g. 50,000m desktop approximation),
        // DO NOT falsely trigger departure closure!
        if (accuracy <= MAX_RELIABLE_ACCURACY_METRES) {
          calculatedDistance = calculateHaversineDistanceMetres(
            customerLocation.latitude,
            customerLocation.longitude,
            locationSettings.latitude,
            locationSettings.longitude
          );

          if (calculatedDistance > departureRadius) {
            departureExceeded = true;
          }
        }
      }

      if (departureExceeded) {
        // Close departing session cleanly
        existingSession.status = "CLOSED";
        existingSession.closedReason = "DEPARTURE_RADIUS_EXCEEDED";
        existingSession.closedAt = nowIso;
        existingSession.updatedAt = nowIso;
        existingSession.lastVerifiedDistanceMetres = calculatedDistance;
        existingSession.lastVerifiedLocationAt = nowIso;

        dataStore.saveDiningSessionLocally(existingSession);
        try {
          await firestoreService.saveDiningSession(restaurantId, existingSession);
        } catch (err: any) {
          console.warn("[DiningSession] Close session write warning:", err.message);
        }

        // Create fresh new dining session for the customer
        const newSession = await this.createNewSession({
          restaurantId,
          restaurantSlug,
          tableId,
          tableCode,
          billingConfig,
          customerLocation,
          distance: calculatedDistance,
        });

        return {
          session: newSession,
          isNew: true,
          departureTriggered: true,
          message: `Previous dining session closed because distance exceeded ${departureRadius}m departure radius. New session started.`,
        };
      }

      // Customer is still within authorized radius
      existingSession.lastActivityAt = nowIso;
      existingSession.updatedAt = nowIso;
      if (calculatedDistance !== null) {
        existingSession.lastVerifiedDistanceMetres = calculatedDistance;
        existingSession.lastVerifiedLatitude = customerLocation?.latitude;
        existingSession.lastVerifiedLongitude = customerLocation?.longitude;
        existingSession.lastVerifiedLocationAt = nowIso;
      }

      dataStore.saveDiningSessionLocally(existingSession);
      return {
        session: existingSession,
        isNew: false,
        departureTriggered: false,
      };
    }

    // 4. No active session found — Create brand new dining session
    const freshSession = await this.createNewSession({
      restaurantId,
      restaurantSlug,
      tableId,
      tableCode,
      billingConfig,
      customerLocation,
    });

    return {
      session: freshSession,
      isNew: true,
      departureTriggered: false,
    };
  }

  /**
   * Creates a fresh DiningSession record.
   */
  private async createNewSession(params: {
    restaurantId: string;
    restaurantSlug: string;
    tableId: string;
    tableCode: string;
    billingConfig?: BillingConfig | null;
    customerLocation?: { latitude?: number | null; longitude?: number | null; accuracy?: number | null } | null;
    distance?: number | null;
  }): Promise<DiningSession> {
    const {
      restaurantId,
      restaurantSlug,
      tableId,
      tableCode,
      billingConfig,
      customerLocation,
      distance,
    } = params;

    const token = generateDiningSessionToken();
    const tokenHash = hashDiningSessionToken(token);
    const sessionId = `dsess_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const nowIso = new Date().toISOString();
    const initialBilling = calculateOrderBill([], billingConfig);

    const newSession: DiningSession = {
      id: sessionId,
      restaurantId,
      restaurantSlug,
      tableId,
      tableCode,
      sessionToken: token,
      sessionTokenHash: tokenHash,
      status: "ACTIVE",
      startedAt: nowIso,
      lastActivityAt: nowIso,
      lastVerifiedLocationAt: customerLocation?.latitude ? nowIso : undefined,
      lastVerifiedLatitude: customerLocation?.latitude ?? null,
      lastVerifiedLongitude: customerLocation?.longitude ?? null,
      lastVerifiedDistanceMetres: distance ?? null,
      departureCheckCount: 0,
      orderIds: [],
      items: [],
      billing: initialBilling,
      ordersSummary: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    dataStore.saveDiningSessionLocally(newSession);
    try {
      await firestoreService.saveDiningSession(restaurantId, newSession);
    } catch (err: any) {
      console.warn("[DiningSession] Firestore saveDiningSession warning:", err.message);
    }

    return newSession;
  }

  /**
   * Appends an order to an active dining session and atomically recalculates the combined bill.
   */
  public async appendOrderToSession(params: {
    restaurant: RestaurantProfile;
    session: DiningSession;
    order: OrderItem;
    idempotencyKey?: string;
  }): Promise<DiningSession> {
    const { restaurant, session, order, idempotencyKey } = params;
    const nowIso = new Date().toISOString();

    // Idempotency check: prevent duplicate addition of the same order
    if (session.orderIds.includes(order.id)) {
      return session;
    }
    if (idempotencyKey && session.orderIds.includes(idempotencyKey)) {
      return session;
    }

    // 1. Record order reference
    session.orderIds.push(order.id);
    if (idempotencyKey) {
      session.orderIds.push(idempotencyKey);
    }

    // 2. Accumulate order items
    session.items = [...session.items, ...order.items];

    // 3. Recalculate combined billing on backend
    session.billing = calculateOrderBill(session.items, restaurant.billingConfig);

    // 4. Update order summary
    const summary: DiningSessionOrderSummary = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      placedAt: order.createdAt,
      itemCount: order.items.reduce((acc, i) => acc + (i.quantity || 1), 0),
      subtotal: order.billing.subtotal,
      status: order.status,
    };
    session.ordersSummary.push(summary);

    // 5. Update activity timestamps
    session.lastActivityAt = nowIso;
    session.updatedAt = nowIso;

    // 6. Persist to Firestore and memory
    dataStore.saveDiningSessionLocally(session);
    try {
      await firestoreService.saveDiningSession(restaurant.id, session);
    } catch (err: any) {
      console.warn("[DiningSession] Firestore sync warning on appendOrder:", err.message);
    }

    return session;
  }

  /**
   * Retrieves a dining session by ID.
   */
  public async getSessionById(restaurantId: string, sessionId: string): Promise<DiningSession | null> {
    let session = dataStore.getDiningSessionById(sessionId);
    if (!session) {
      try {
        session = await firestoreService.getDiningSession(restaurantId, sessionId);
        if (session) {
          dataStore.saveDiningSessionLocally(session);
        }
      } catch (err: any) {
        console.warn("[DiningSession] Lookup error:", err.message);
      }
    }
    return session;
  }

  /**
   * Manually closes a dining session (e.g. staff settlement or checkout).
   */
  public async closeSession(
    restaurantId: string,
    sessionId: string,
    reason: "MANUAL_STAFF_CLOSE" | "DEPARTURE_RADIUS_EXCEEDED" | "SESSION_TIMEOUT" = "MANUAL_STAFF_CLOSE"
  ): Promise<DiningSession | null> {
    const session = await this.getSessionById(restaurantId, sessionId);
    if (!session) return null;

    const nowIso = new Date().toISOString();
    session.status = "CLOSED";
    session.closedReason = reason;
    session.closedAt = nowIso;
    session.updatedAt = nowIso;

    dataStore.saveDiningSessionLocally(session);
    try {
      await firestoreService.saveDiningSession(restaurantId, session);
    } catch (err: any) {
      console.warn("[DiningSession] Close error:", err.message);
    }

    return session;
  }
}

export const diningSessionService = new DiningSessionService();
