// ==============================================================================
// RESTROCHARGE - Active Restaurant Context Hook for Dashboards
// Seamlessly resolves the active restaurant for both Restaurant Owners & Super Admins.
// Developed by Vivexa Tech.
// ==============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { RestaurantProfile } from "@/lib/types";

export function useActiveRestaurant() {
  const { user, isLoading: authLoading } = useAuth();
  const [restaurantId, setRestaurantId] = useState<string>(user?.restaurantId || "");
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [allRestaurants, setAllRestaurants] = useState<RestaurantProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const isSuperAdmin =
    user?.role === "SUPER_ADMIN" ||
    Boolean((user as any)?.isSuperAdmin) ||
    user?.email === "admin@vivexatech.in";

  const refreshRestaurants = useCallback(async () => {
    try {
      setLoading(true);

      // 1. If Super Admin: Fetch all restaurants so they have full multi-tenant switcher access
      if (isSuperAdmin) {
        const res = await fetch("/api/restaurants");
        if (res.ok) {
          const data = await res.json();
          const list: RestaurantProfile[] = data.restaurants || [];
          setAllRestaurants(list);

          if (list.length > 0) {
            let targetId: string | null = null;
            if (typeof window !== "undefined") {
              const params = new URLSearchParams(window.location.search);
              targetId = params.get("restaurantId");
              if (!targetId) {
                targetId = localStorage.getItem("restrocharge_active_restaurant_id");
              }
            }

            const target =
              list.find((r) => r.id === targetId) ||
              (user?.restaurantId && list.find((r) => r.id === user.restaurantId)) ||
              list[0];

            setRestaurantId(target.id);
            setRestaurant(target);
            if (typeof window !== "undefined") {
              localStorage.setItem("restrocharge_active_restaurant_id", target.id);
            }
          }
        }
        return;
      }

      // 2. Regular Restaurant Owner / Manager / Staff
      if (user?.restaurantId) {
        setRestaurantId(user.restaurantId);
        const res = await fetch(`/api/restaurants/${user.restaurantId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.restaurant) {
            setRestaurant(data.restaurant);
            setAllRestaurants([data.restaurant]);
          }
        }
        return;
      }

      // 3. User has no restaurant assigned yet:
      // STRICT TENANT ISOLATION: NEVER fall back to demo restaurant (list[0])!
      setRestaurantId("");
      setRestaurant(null);
      setAllRestaurants([]);
    } catch (err) {
      console.warn("[useActiveRestaurant] Error resolving restaurant:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.restaurantId, user?.email, isSuperAdmin]);

  useEffect(() => {
    if (!authLoading) {
      refreshRestaurants();
    }
  }, [authLoading, refreshRestaurants]);

  // Allow switching restaurant (especially for Super Admin)
  const selectRestaurant = (newId: string) => {
    const target = allRestaurants.find((r) => r.id === newId);
    if (target) {
      setRestaurantId(target.id);
      setRestaurant(target);
      if (typeof window !== "undefined") {
        localStorage.setItem("restrocharge_active_restaurant_id", target.id);
        window.dispatchEvent(
          new CustomEvent("restrocharge_restaurant_changed", { detail: target.id })
        );
      }
    }
  };

  // Listen for cross-component restaurant changes
  useEffect(() => {
    const handleChanged = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail && customEvent.detail !== restaurantId) {
        const target = allRestaurants.find((r) => r.id === customEvent.detail);
        if (target) {
          setRestaurantId(target.id);
          setRestaurant(target);
        }
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("restrocharge_restaurant_changed", handleChanged);
      return () => {
        window.removeEventListener("restrocharge_restaurant_changed", handleChanged);
      };
    }
  }, [allRestaurants, restaurantId]);

  return {
    restaurantId,
    restaurant,
    allRestaurants,
    selectRestaurant,
    isSuperAdmin,
    loading: loading || authLoading,
    refreshRestaurants,
  };
}
