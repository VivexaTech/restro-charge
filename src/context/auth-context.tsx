// ==============================================================================
// RESTROCHARGE - Role-Based Authentication & Session Context
// ==============================================================================

"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserProfile, UserRole } from "@/lib/types";
import { SEED_USERS } from "@/lib/mock-data/seed";
import { auth, googleProvider } from "@/lib/firebase/client";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";

export const SUPER_ADMIN_UID = "GDF2eldrzSNR9oltgezCr9MXt0I3";

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  restaurantId: string | null;
  isLoading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  logout: () => Promise<void>;
  switchUserRole: (role: UserRole, restaurantId?: string) => void;
  getIdToken: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: "CUSTOMER_GUEST",
  restaurantId: null,
  isLoading: true,
  loginWithEmail: async () => ({ success: false }),
  loginWithGoogle: async () => ({ success: false }),
  logout: async () => {},
  switchUserRole: () => {},
  getIdToken: async () => null,
  resetPassword: async () => ({ success: false }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const resolveUserSession = async (fbUser: any): Promise<UserProfile> => {
    let role: UserRole = "CUSTOMER_GUEST";
    let restaurantId: string | null = null;

    try {
      const token = await fbUser.getIdToken();
      const res = await fetch("/api/auth/resolve-membership", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        role = (data.role as UserRole) || "CUSTOMER_GUEST";
        restaurantId = data.restaurantId || null;
        if (data.requiresTokenRefresh) {
          await fbUser.getIdToken(true);
        }
      } else {
        const tokenResult = await fbUser.getIdTokenResult();
        const isSuper =
          tokenResult.claims.role === "SUPER_ADMIN" ||
          tokenResult.claims.superAdmin === true ||
          (fbUser.uid === SUPER_ADMIN_UID && fbUser.email === "admin@vivexatech.in");

        role = isSuper
          ? "SUPER_ADMIN"
          : (tokenResult.claims.role as UserRole) || "CUSTOMER_GUEST";
        restaurantId = (tokenResult.claims.restaurantId as string) || null;
      }
    } catch (e) {
      console.warn("[Auth] Membership resolution failed, falling back to claims:", e);
      try {
        const tokenResult = await fbUser.getIdTokenResult();
        const isSuper =
          tokenResult.claims.role === "SUPER_ADMIN" ||
          tokenResult.claims.superAdmin === true ||
          (fbUser.uid === SUPER_ADMIN_UID && fbUser.email === "admin@vivexatech.in");

        role = isSuper
          ? "SUPER_ADMIN"
          : (tokenResult.claims.role as UserRole) || "CUSTOMER_GUEST";
        restaurantId = (tokenResult.claims.restaurantId as string) || null;
      } catch {
        role = "CUSTOMER_GUEST";
        restaurantId = null;
      }
    }

    const profile: UserProfile = {
      uid: fbUser.uid,
      email: fbUser.email || "user@restrocharge.in",
      displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "User",
      role,
      restaurantId: restaurantId || undefined,
      createdAt: fbUser.metadata?.creationTime || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    };

    return profile;
  };

  useEffect(() => {
    // 1. Listen for real Firebase Authentication state changes
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!isMounted) return;

      if (fbUser) {
        try {
          const profile = await resolveUserSession(fbUser);
          if (isMounted) {
            setUser(profile);
            localStorage.setItem("restrocharge_session_user", JSON.stringify(profile));
          }
        } catch (err) {
          console.warn("[Auth] Token parsing error:", err);
          if (isMounted) {
            setUser(null);
            localStorage.removeItem("restrocharge_session_user");
          }
        }
      } else {
        // When not authenticated with Firebase Auth, clear session
        if (isMounted) {
          setUser(null);
          localStorage.removeItem("restrocharge_session_user");
          localStorage.removeItem("restohub_session_user");
        }
      }
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithEmail = async (email: string, pass?: string): Promise<{ success: boolean; error?: string; role?: UserRole }> => {
    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setIsLoading(false);
      return { success: false, error: "Please enter your email address." };
    }

    if (!pass || pass.length < 6) {
      setIsLoading(false);
      return { success: false, error: "Password must be at least 6 characters long." };
    }

    try {
      // 1. Attempt real Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const fbUser = userCredential.user;
      const profile = await resolveUserSession(fbUser);

      setUser(profile);
      localStorage.setItem("restrocharge_session_user", JSON.stringify(profile));
      setIsLoading(false);
      return { success: true, role: profile.role };
    } catch (fbErr: any) {
      setIsLoading(false);
      console.warn("[Auth] Firebase sign-in error:", fbErr.code, fbErr.message);

      // Friendly actionable error messages
      switch (fbErr.code) {
        case "auth/user-not-found":
          return { success: false, error: "No account found with this email address. Please contact your administrator." };
        case "auth/wrong-password":
          return { success: false, error: "Incorrect password. Please verify and try again." };
        case "auth/invalid-credential":
          return { success: false, error: "Invalid credentials. Please verify your email and password." };
        case "auth/too-many-requests":
          return { success: false, error: "Access temporarily disabled due to multiple failed login attempts. Please reset your password or try again later." };
        case "auth/user-disabled":
          return { success: false, error: "This account has been disabled. Please contact Vivexa Tech support." };
        case "auth/network-request-failed":
          return { success: false, error: "Network connection error. Please check your internet connection." };
        default:
          return { success: false, error: fbErr.message || "Authentication failed. Please verify your credentials." };
      }
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string; role?: UserRole }> => {
    setIsLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const fbUser = cred.user;
      const profile = await resolveUserSession(fbUser);

      setUser(profile);
      localStorage.setItem("restrocharge_session_user", JSON.stringify(profile));
      setIsLoading(false);
      return { success: true, role: profile.role };
    } catch (err: any) {
      setIsLoading(false);
      console.warn("[Auth] Google Sign-in popup cancelled or error:", err.message);
      return { success: false, error: err.message || "Google sign-in was cancelled or failed." };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {}
    setUser(null);
    localStorage.removeItem("restrocharge_session_user");
    localStorage.removeItem("restohub_session_user");
  };

  const getIdToken = async (): Promise<string | null> => {
    if (auth.currentUser) {
      try {
        return await auth.currentUser.getIdToken();
      } catch {
        return null;
      }
    }
    return null;
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (err: any) {
      console.warn("[Auth] Reset password error:", err.message);
      return { success: false, error: err.message };
    }
  };

  const switchUserRole = (role: UserRole, restaurantId?: string) => {
    // In production, arbitrary client role switching is strictly forbidden
    if (process.env.NODE_ENV === "production") {
      console.warn("[Auth] Client-side role switching is forbidden in production.");
      return;
    }
    const isSuper = role === "SUPER_ADMIN" && (user?.email === "admin@vivexatech.in" || user?.uid === SUPER_ADMIN_UID);
    const updated: UserProfile = {
      uid: isSuper ? SUPER_ADMIN_UID : (user?.uid || `usr_${Date.now()}`),
      email: isSuper ? "admin@vivexatech.in" : (user?.email || "user@restrocharge.in"),
      displayName: role.replace("_", " "),
      role: role === "SUPER_ADMIN" && !isSuper ? "CUSTOMER_GUEST" : role,
      restaurantId: restaurantId || user?.restaurantId || undefined,
      createdAt: user?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    };
    setUser(updated);
    localStorage.setItem("restrocharge_session_user", JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || "CUSTOMER_GUEST",
        restaurantId: user?.restaurantId || null,
        isLoading,
        loginWithEmail,
        loginWithGoogle,
        logout,
        switchUserRole,
        getIdToken,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

