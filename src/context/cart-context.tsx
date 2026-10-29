// ==============================================================================
// RESTROCHARGE - Customer QR Ordering Cart Context
// Supports portion-based food lines (Quarter, Half, Full), live subtotals,
// and dietary classifications. Developed by Vivexa Tech.
// ==============================================================================

"use client";

import React, { createContext, useContext, useState } from "react";
import {
  OrderItemSnapshot,
  ProductItem,
  ProductPortion,
  RestaurantOffer,
  ComboItemSnapshot,
  OfferType,
} from "@/lib/types";

export interface OfferSnapshotDetails {
  effectivePrice?: number;
  regularPrice?: number;
  discountAmount?: number;
  appliedOfferId?: string;
  appliedOfferName?: string;
  appliedOfferType?: OfferType;
}

interface CartContextType {
  items: OrderItemSnapshot[];
  customerNotes: string;
  setCustomerNotes: (notes: string) => void;
  addItem: (
    product: ProductItem,
    portion?: ProductPortion,
    quantity?: number,
    offerDetails?: OfferSnapshotDetails
  ) => void;
  addComboItem: (
    combo: RestaurantOffer,
    comboItemsSnapshot: ComboItemSnapshot[],
    regularTotal: number,
    quantity?: number
  ) => void;
  removeItem: (productId: string, portionId?: string) => void;
  updateQuantity: (productId: string, portionId: string | undefined, quantity: number) => void;
  getItemQuantity: (productId: string, portionId?: string) => number;
  getProductTotalQuantity: (productId: string) => number;
  clearCart: () => void;
  totalItemCount: number;
  subtotalPreview: number;
}

const CartContext = createContext<CartContextType>({
  items: [],
  customerNotes: "",
  setCustomerNotes: () => {},
  addItem: () => {},
  addComboItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  getItemQuantity: () => 0,
  getProductTotalQuantity: () => 0,
  clearCart: () => {},
  totalItemCount: 0,
  subtotalPreview: 0,
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<OrderItemSnapshot[]>([]);
  const [customerNotes, setCustomerNotes] = useState<string>("");

  const addItem = (
    product: ProductItem,
    portion?: ProductPortion,
    quantity: number = 1,
    offerDetails?: OfferSnapshotDetails
  ) => {
    if (!product.isAvailable) return;
    if (portion && !portion.isAvailable) return;

    const targetPortionId = portion ? portion.id : undefined;
    const targetPortionName = portion ? portion.name : undefined;
    const baseRegularPrice = portion ? portion.price : product.price;
    const effectivePrice =
      offerDetails?.effectivePrice !== undefined ? offerDetails.effectivePrice : baseRegularPrice;
    const discountAmount =
      offerDetails?.discountAmount !== undefined
        ? offerDetails.discountAmount
        : Math.max(0, baseRegularPrice - effectivePrice);

    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.productId === product.id && i.portionId === targetPortionId && !i.isCombo
      );

      if (existingIndex > -1) {
        const copy = [...prev];
        const current = copy[existingIndex];
        const newQty = current.quantity + quantity;
        copy[existingIndex] = {
          ...current,
          quantity: newQty,
          price: effectivePrice,
          regularPrice: baseRegularPrice,
          discountAmount,
          lineTotal: effectivePrice * newQty,
        };
        return copy;
      }

      const newLine: OrderItemSnapshot = {
        productId: product.id,
        name: targetPortionName ? `${product.name} (${targetPortionName})` : product.name,
        price: effectivePrice,
        regularPrice: baseRegularPrice,
        discountAmount,
        appliedOfferId: offerDetails?.appliedOfferId,
        appliedOfferName: offerDetails?.appliedOfferName,
        appliedOfferType: offerDetails?.appliedOfferType,
        quantity: Math.max(1, quantity),
        isVeg: product.isVeg,
        dietaryType: product.dietaryType,
        portionId: targetPortionId,
        portionName: targetPortionName,
        lineTotal: effectivePrice * Math.max(1, quantity),
      };

      return [...prev, newLine];
    });
  };

  const addComboItem = (
    combo: RestaurantOffer,
    comboItemsSnapshot: ComboItemSnapshot[],
    regularTotal: number,
    quantity: number = 1
  ) => {
    if (combo.status !== "ACTIVE") return;
    const comboPrice = combo.comboPrice ?? 0;
    const discountAmount = Math.max(0, regularTotal - comboPrice);

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === combo.id && i.isCombo);
      if (existingIndex > -1) {
        const copy = [...prev];
        const current = copy[existingIndex];
        const newQty = current.quantity + quantity;
        copy[existingIndex] = {
          ...current,
          quantity: newQty,
          lineTotal: comboPrice * newQty,
        };
        return copy;
      }

      const newLine: OrderItemSnapshot = {
        productId: combo.id,
        name: combo.name,
        price: comboPrice,
        regularPrice: regularTotal,
        discountAmount,
        quantity: Math.max(1, quantity),
        isVeg: true,
        dietaryType: "veg",
        isCombo: true,
        comboItemsSnapshot,
        appliedOfferId: combo.id,
        appliedOfferName: combo.name,
        appliedOfferType: "COMBO",
        lineTotal: comboPrice * Math.max(1, quantity),
      };

      return [...prev, newLine];
    });
  };

  const removeItem = (productId: string, portionId?: string) => {
    setItems((prev) =>
      prev.filter((i) => {
        if (portionId !== undefined) {
          return !(i.productId === productId && i.portionId === portionId);
        }
        return i.productId !== productId;
      })
    );
  };

  const updateQuantity = (
    productId: string,
    portionId: string | undefined,
    quantity: number
  ) => {
    if (quantity <= 0) {
      removeItem(productId, portionId);
      return;
    }

    setItems((prev) =>
      prev.map((i) => {
        const matches =
          i.productId === productId &&
          (portionId !== undefined ? i.portionId === portionId : true);
        return matches ? { ...i, quantity } : i;
      })
    );
  };

  const getItemQuantity = (productId: string, portionId?: string): number => {
    const item = items.find(
      (i) => i.productId === productId && (portionId !== undefined ? i.portionId === portionId : true)
    );
    return item ? item.quantity : 0;
  };

  const getProductTotalQuantity = (productId: string): number => {
    return items
      .filter((i) => i.productId === productId)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  const clearCart = () => {
    setItems([]);
    setCustomerNotes("");
  };

  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalPreview = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        customerNotes,
        setCustomerNotes,
        addItem,
        addComboItem,
        removeItem,
        updateQuantity,
        getItemQuantity,
        getProductTotalQuantity,
        clearCart,
        totalItemCount,
        subtotalPreview,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
