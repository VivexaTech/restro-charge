"use client";

import React from "react";
import {
  Receipt,
  Clock,
  CheckCircle2,
  X,
  Plus,
  Utensils,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  ChefHat,
  BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiningSession, OrderStatus } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface CombinedBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: DiningSession | null;
  restaurantName?: string;
  onOrderMore?: () => void;
}

export function CombinedBillModal({
  isOpen,
  onClose,
  session,
  restaurantName,
  onOrderMore,
}: CombinedBillModalProps) {
  if (!isOpen || !session) return null;

  const billing = session.billing;
  const ordersSummary = session.ordersSummary || [];
  const totalItemCount = session.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
  const totalDiscount = session.items?.reduce((sum, item) => sum + (item.discountAmount ? item.discountAmount * item.quantity : 0), 0) || 0;

  // Group items by order if possible, or display itemized breakdown
  const orderCount = session.orderIds?.length || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-slate-900 font-display">
                  Ongoing Customer Bill
                </h3>
                <Badge variant={session.status === "ACTIVE" ? "success" : "default"} className="text-[10px]">
                  {session.status === "ACTIVE" ? "Running Session" : "Closed"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Table {session.tableCode?.toUpperCase() || session.tableId} · {restaurantName || "Restaurant"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Bill Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 divide-y divide-slate-100 text-sm">
          {/* Session Metadata Banner */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/60 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                Bill / Session ID
              </span>
              <span className="font-mono font-bold text-slate-700">
                {session.id.slice(0, 16)}...
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                Total Orders Placed
              </span>
              <span className="font-bold text-brand-600">
                {orderCount} {orderCount === 1 ? "order" : "rounds"}
              </span>
            </div>
          </div>

          {/* Sequential Orders Breakdown */}
          <div className="pt-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Order History & Items
            </h4>

            {ordersSummary.length > 0 ? (
              ordersSummary.map((summary, idx) => (
                <div
                  key={summary.orderId || idx}
                  className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="h-5 w-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-slate-900 text-xs">
                        Order #{summary.orderNumber}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center">
                        <Clock className="h-3 w-3 mr-1 inline" />
                        {summary.placedAt ? new Date(summary.placedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {summary.status || "CONFIRMED"}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">
                      {summary.itemCount} items ordered
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(summary.subtotal || 0)}
                    </span>
                  </div>
                </div>
              ))
            ) : null}

            {/* Complete Itemized List */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Itemized Dishes ({totalItemCount} total):
              </span>
              <div className="space-y-1.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                {session.items?.map((item, idx) => (
                  <div key={`${item.productId}-${idx}`} className="flex justify-between items-center text-xs">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${item.isVeg ? "bg-emerald-500" : "bg-rose-500"}`} />
                      <span className="font-medium text-slate-800">
                        {item.name}
                        {item.portionName && item.portionName !== "Regular" && (
                          <span className="text-[10px] text-slate-400 ml-1">({item.portionName})</span>
                        )}
                        <span className="text-slate-400 ml-1">× {item.quantity}</span>
                      </span>
                    </div>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(item.lineTotal || (item.price * item.quantity))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cumulative Financial Summary */}
          <div className="pt-4 space-y-2 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Bill Breakdown
            </h4>

            <div className="flex justify-between text-slate-600">
              <span>Combined Items Subtotal</span>
              <span className="font-medium text-slate-900">{formatCurrency(billing?.subtotal || 0)}</span>
            </div>

            {totalDiscount > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Special Offers & Deals Discount</span>
                <span>-{formatCurrency(totalDiscount)}</span>
              </div>
            )}

            {billing && billing.serviceChargeAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Service Charge ({billing.serviceChargeRate}%)</span>
                <span>{formatCurrency(billing.serviceChargeAmount)}</span>
              </div>
            )}

            {billing && billing.gstAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>GST / Taxes ({billing.gstRate}%)</span>
                <span>{formatCurrency(billing.gstAmount)}</span>
              </div>
            )}

            <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
              <div>
                <span className="text-base font-bold text-slate-900 block font-display">
                  Total Payable
                </span>
                <span className="text-[10px] text-slate-400">
                  Includes all taxes & applicable service fees
                </span>
              </div>
              <span className="text-xl font-extrabold text-brand-600 font-display">
                {formatCurrency(billing?.finalTotal || 0)}
              </span>
            </div>
          </div>

          {/* Payment Notice */}
          <div className="pt-3">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-amber-900 text-xs flex items-start space-x-2.5">
              <CreditCard className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold">Direct Restaurant Settlement</p>
                <p className="text-[11px] text-amber-700/90 mt-0.5">
                  Payment is collected directly by restaurant staff at your table or counter. Subsequent orders will automatically append to this running bill.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          {onOrderMore && session.status === "ACTIVE" && (
            <Button
              onClick={() => {
                onClose();
                onOrderMore();
              }}
              className="flex-1 text-xs font-semibold py-2.5 shadow-sm"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Order More Items
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 text-xs py-2.5"
          >
            Close Bill
          </Button>
        </div>
      </div>
    </div>
  );
}
