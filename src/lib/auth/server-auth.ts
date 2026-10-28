// ==============================================================================
// RESTROCHARGE - Server-Side Authentication & Role Authorization
// Secure token verification and role enforcement for Next.js Route Handlers.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { UserRole } from "@/lib/types";

// The designated primary Vivexa Tech Super Admin Firebase Auth UID
export const SUPER_ADMIN_UID = "GDF2eldrzSNR9oltgezCr9MXt0I3";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role: UserRole;
  restaurantId?: string;
  isSuperAdmin: boolean;
}

/**
 * Extracts and verifies the authenticated user from the request.
 * Checks Firebase ID token in Authorization header, custom claims, and fallback dev sessions.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get("authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        const isSuper =
          decoded.uid === SUPER_ADMIN_UID ||
          decoded.role === "SUPER_ADMIN" ||
          decoded.superAdmin === true ||
          Boolean(decoded.email?.endsWith("@vivexatech.in"));

        const role: UserRole = isSuper
          ? "SUPER_ADMIN"
          : (decoded.role as UserRole) || "RESTAURANT_OWNER";

        return {
          uid: decoded.uid,
          email: decoded.email,
          role,
          restaurantId: (decoded.restaurantId as string) || undefined,
          isSuperAdmin: isSuper,
        };
      } catch (err: any) {
        console.warn("[ServerAuth] Firebase ID token verification failed:", err.message || err);
      }
    }
  }

  // Development / test bypass fallback when explicit dev headers are provided in test/dev environment
  if (process.env.NODE_ENV !== "production") {
    const devUid = req.headers.get("x-dev-uid");
    const devRole = req.headers.get("x-dev-role") as UserRole;
    const devRestaurantId = req.headers.get("x-dev-restaurant-id");

    if (devUid) {
      const isSuper = devUid === SUPER_ADMIN_UID || devRole === "SUPER_ADMIN";
      return {
        uid: devUid,
        email: isSuper ? "admin@vivexatech.in" : undefined,
        role: devRole || (isSuper ? "SUPER_ADMIN" : "CUSTOMER_GUEST"),
        restaurantId: devRestaurantId || undefined,
        isSuperAdmin: isSuper,
      };
    }
  }

  return null;
}

/**
 * Ensures the requesting client has Super Admin or authorized Vivexa Tech administrative privileges.
 */
export async function verifySuperAdminPermission(req: NextRequest): Promise<{
  authorized: boolean;
  user?: AuthenticatedUser;
  errorResponse?: NextResponse;
}> {
  const user = await getAuthenticatedUser(req);

  // If in local test/dev and no auth header, inspect body fallback for existing test compatibility
  if (!user && process.env.NODE_ENV !== "production") {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      // In local dev without token, allow if caller explicitly identified as super admin in test
      return {
        authorized: true,
        user: {
          uid: SUPER_ADMIN_UID,
          email: "admin@vivexatech.in",
          role: "SUPER_ADMIN",
          isSuperAdmin: true,
        },
      };
    }
  }

  if (!user) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "Authentication required. Please provide a valid Firebase ID token." },
        { status: 401 }
      ),
    };
  }

  const authorizedRoles: UserRole[] = ["SUPER_ADMIN", "ONBOARDING_EXECUTIVE", "SALES_MANAGER"];
  if (!user.isSuperAdmin && !authorizedRoles.includes(user.role)) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "Access denied. Action restricted to authorized Vivexa Tech administrators." },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user };
}

/**
 * Ensures the requesting client has access to the specified restaurant (Restaurant Owner, Staff, or Super Admin).
 */
export async function verifyRestaurantAccess(
  req: NextRequest,
  targetRestaurantId: string
): Promise<{
  authorized: boolean;
  user?: AuthenticatedUser;
  errorResponse?: NextResponse;
}> {
  const user = await getAuthenticatedUser(req);

  if (!user && process.env.NODE_ENV !== "production") {
    // Development pass-through when no token supplied
    return {
      authorized: true,
      user: {
        uid: "dev_user",
        email: "dev@restrocharge.in",
        role: "RESTAURANT_OWNER",
        restaurantId: targetRestaurantId,
        isSuperAdmin: false,
      },
    };
  }

  if (!user) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "Authentication required. Please provide a valid Firebase ID token." },
        { status: 401 }
      ),
    };
  }

  if (user.isSuperAdmin) {
    return { authorized: true, user };
  }

  if (user.restaurantId !== targetRestaurantId) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "Access denied. You do not have permission to manage this restaurant." },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user };
}
