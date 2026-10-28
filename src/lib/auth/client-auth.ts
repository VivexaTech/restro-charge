// ==============================================================================
// RESTROCHARGE - Client-Side Authentication & Request Utilities
// Attaches Firebase ID tokens and active session headers to API requests.
// ==============================================================================

import { auth } from "@/lib/firebase/client";
import { UserProfile } from "@/lib/types";

/**
 * Returns authentication headers for fetch requests based on the current
 * Firebase Auth user or active cached session.
 */
export async function getClientAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (typeof window === "undefined") {
    return headers;
  }

  // 1. Try Firebase Auth ID token if signed in
  if (auth && auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {
      // ignore
    }
  }

  // 2. Retrieve active session profile from localStorage
  try {
    const raw =
      localStorage.getItem("restrocharge_session_user") ||
      localStorage.getItem("restohub_session_user");
    if (raw) {
      const sessionUser: UserProfile = JSON.parse(raw);
      if (sessionUser) {
        headers["x-user-uid"] = sessionUser.uid;
        headers["x-user-role"] = sessionUser.role;
        headers["x-dev-uid"] = sessionUser.uid;
        headers["x-dev-role"] = sessionUser.role;
        if (sessionUser.email) headers["x-user-email"] = sessionUser.email;
        if (sessionUser.restaurantId) {
          headers["x-user-restaurant-id"] = sessionUser.restaurantId;
          headers["x-dev-restaurant-id"] = sessionUser.restaurantId;
        }
      }
    }
  } catch {
    // ignore
  }

  return headers;
}

/**
 * Wrapper for fetch that automatically injects auth headers.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const authHeaders = await getClientAuthHeaders();
  const options: RequestInit = {
    ...init,
    headers: {
      ...authHeaders,
      ...(init?.headers || {}),
    },
  };
  return fetch(input, options);
}
