// ==============================================================================
// RESTROCHARGE - Server-Side Authentication & Role Authorization
// Secure token verification and role enforcement for Next.js Route Handlers.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, isFirebaseAdminReady } from "@/lib/firebase/admin";
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
 * Checks Firebase ID token in Authorization header, custom claims, and session/dev headers.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get("authorization");

  // 1. Verify Firebase ID token if present and Firebase Admin credentials are ready
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token && token !== "dev" && token !== "superadmin" && token !== "dev_super_admin" && isFirebaseAdminReady()) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        // Only grant Super Admin if authorized custom claims are cryptographically present,
        // or if UID matches the designated platform master and email is admin@vivexatech.in
        const isSuper =
          decoded.role === "SUPER_ADMIN" ||
          decoded.superAdmin === true ||
          (decoded.uid === SUPER_ADMIN_UID && decoded.email === "admin@vivexatech.in");

        const role: UserRole = isSuper
          ? "SUPER_ADMIN"
          : (decoded.role as UserRole) || "CUSTOMER_GUEST";

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

  // 2. Development-only mock/test token inspection (Strictly disabled in production)
  if (process.env.NODE_ENV !== "production") {
    if (authHeader === "Bearer dev_super_admin" || authHeader === "Bearer superadmin" || authHeader === "Bearer dev") {
      return {
        uid: SUPER_ADMIN_UID,
        email: "admin@vivexatech.in",
        role: "SUPER_ADMIN",
        isSuperAdmin: true,
      };
    }

    // Inspect dev session user headers (only allowed in non-production)
    const userUid = req.headers.get("x-user-uid") || req.headers.get("x-dev-uid");
    const userRole = (req.headers.get("x-user-role") || req.headers.get("x-dev-role")) as UserRole;
    const userEmail = req.headers.get("x-user-email");
    const userRestaurantId = req.headers.get("x-user-restaurant-id") || req.headers.get("x-dev-restaurant-id");

    if (userUid) {
      // Never allow an arbitrary user to elevate themselves to SUPER_ADMIN
      const isSuper =
        (userUid === SUPER_ADMIN_UID && userEmail === "admin@vivexatech.in") ||
        (userRole === "SUPER_ADMIN" && userEmail === "admin@vivexatech.in");

      const role: UserRole = isSuper
        ? "SUPER_ADMIN"
        : userRole && userRole !== "SUPER_ADMIN"
        ? userRole
        : "CUSTOMER_GUEST";

      return {
        uid: userUid,
        email: userEmail || (isSuper ? "admin@vivexatech.in" : undefined),
        role,
        restaurantId: userRestaurantId || undefined,
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
