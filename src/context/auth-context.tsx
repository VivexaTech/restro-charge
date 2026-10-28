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
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
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

  useEffect(() => {
    // 1. Listen for real Firebase Authentication state changes
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!isMounted) return;

      if (fbUser) {
        try {
          const tokenResult = await fbUser.getIdTokenResult();
          const isSuper =
            fbUser.uid === SUPER_ADMIN_UID ||
            tokenResult.claims.role === "SUPER_ADMIN" ||
            tokenResult.claims.superAdmin === true ||
            Boolean(fbUser.email?.endsWith("@vivexatech.in"));

          const role: UserRole = isSuper
            ? "SUPER_ADMIN"
            : (tokenResult.claims.role as UserRole) || "RESTAURANT_OWNER";

          const profile: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email || "user@restrocharge.in",
            displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "User",
            role,
            restaurantId: (tokenResult.claims.restaurantId as string) || "rest_vivexa_01",
            createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: true,
          };

          setUser(profile);
          localStorage.setItem("restrocharge_session_user", JSON.stringify(profile));
        } catch (err) {
          console.warn("[Auth] Token parsing error:", err);
        }
      } else {
        // Fallback to stored session in local storage for development/persona switcher
        try {
          const savedUser =
            localStorage.getItem("restrocharge_session_user") ||
            localStorage.getItem("restohub_session_user");
          if (savedUser) {
            setUser(JSON.parse(savedUser));
          } else {
            // Default to Vivexa Tech Super Admin for seamless testing if no session
            setUser(SEED_USERS[0]);
          }
        } catch {
          setUser(SEED_USERS[0]);
        }
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithEmail = async (email: string, pass?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      // 1. If password provided, attempt real Firebase Authentication
      if (pass && pass.length >= 6) {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, pass);
          const fbUser = userCredential.user;
          const isSuper = fbUser.uid === SUPER_ADMIN_UID || Boolean(email.endsWith("@vivexatech.in"));
          const role: UserRole = isSuper ? "SUPER_ADMIN" : "RESTAURANT_OWNER";

          const profile: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email || email,
            displayName: fbUser.displayName || email.split("@")[0],
            role,
            restaurantId: "rest_vivexa_01",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: true,
          };
          setUser(profile);
          localStorage.setItem("restrocharge_session_user", JSON.stringify(profile));
          setIsLoading(false);
          return { success: true };
        } catch (fbErr: any) {
          if (fbErr.code === "auth/wrong-password") {
            setIsLoading(false);
            return { success: false, error: "Incorrect password. Please try again." };
          }
        }
      }

      // 2. Find matching seed user or create restaurant owner profile
      const found = SEED_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (found) {
        setUser(found);
        localStorage.setItem("restrocharge_session_user", JSON.stringify(found));
        setIsLoading(false);
        return { success: true };
      }

      // 3. If logging in with Vivexa email domain
      if (email.endsWith("@vivexatech.in")) {
        const adminProfile: UserProfile = {
          uid: SUPER_ADMIN_UID,
          email,
          displayName: email.split("@")[0],
          role: "SUPER_ADMIN",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true,
        };
        setUser(adminProfile);
        localStorage.setItem("restrocharge_session_user", JSON.stringify(adminProfile));
        setIsLoading(false);
        return { success: true };
      }

      // 4. Default restaurant owner account for any other email
      const newOwner: UserProfile = {
        uid: `usr_${Date.now()}`,
        email,
        displayName: email.split("@")[0],
        role: "RESTAURANT_OWNER",
        restaurantId: "rest_vivexa_01",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      };
      setUser(newOwner);
      localStorage.setItem("restrocharge_session_user", JSON.stringify(newOwner));
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.message || "Login failed" };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const fbUser = cred.user;
      const isSuper = fbUser.uid === SUPER_ADMIN_UID || Boolean(fbUser.email?.endsWith("@vivexatech.in"));
      const role: UserRole = isSuper ? "SUPER_ADMIN" : "RESTAURANT_OWNER";

      const profile: UserProfile = {
        uid: fbUser.uid,
        email: fbUser.email || "admin@vivexatech.in",
        displayName: fbUser.displayName || "Google User",
        role,
        restaurantId: "rest_vivexa_01",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      };
      setUser(profile);
      localStorage.setItem("restrocharge_session_user", JSON.stringify(profile));
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      console.warn("[Auth] Google Sign-in popup cancelled or error:", err.message);
      // Dev fallback if popup blocked
      return loginWithEmail("admin@vivexatech.in", "");
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
    const isSuper = role === "SUPER_ADMIN";
    const updated: UserProfile = {
      uid: isSuper ? SUPER_ADMIN_UID : (user?.uid || `usr_${Date.now()}`),
      email: isSuper ? "admin@vivexatech.in" : (user?.email || "user@restrocharge.in"),
      displayName: role.replace("_", " "),
      role,
      restaurantId: restaurantId || user?.restaurantId || "rest_vivexa_01",
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

