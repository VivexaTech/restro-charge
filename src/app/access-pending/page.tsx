"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ShieldAlert, RefreshCw, LogOut, UtensilsCrossed, ArrowRight, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AccessPendingPage() {
  const { user, logout, getIdToken } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const router = useRouter();

  const handleRecheckMembership = async () => {
    setIsChecking(true);
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Session expired. Please sign in again.");
        router.push("/login");
        return;
      }

      const res = await fetch("/api/auth/resolve-membership", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.hasMembership) {
        toast.success(`Access confirmed for ${data.restaurantName || "your restaurant"}!`);
        if (data.targetDashboard) {
          router.push(data.targetDashboard);
        } else {
          router.push("/dashboard");
        }
      } else {
        toast.info("No restaurant assignment found yet. Please contact your restaurant administrator or Vivexa Tech.");
      }
    } catch {
      toast.error("Failed to verify membership status.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-2.5">
            <div className="h-10 w-10 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold shadow-sm">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <span className="font-display font-bold text-2xl text-slate-900">
              RestroCharge
            </span>
          </Link>
        </div>

        <div className="bg-white py-8 px-6 sm:px-10 shadow-elevated rounded-2xl border border-slate-200 text-center space-y-5">
          <div className="h-14 w-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
            <Store className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold font-display text-slate-900">
              No Restaurant Assigned
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your account has successfully authenticated, but it has not yet been linked to an active restaurant workspace.
            </p>
          </div>

          {user && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-left text-xs space-y-1 font-mono text-slate-600">
              <div className="truncate"><span className="text-slate-400">Email:</span> {user.email}</div>
              <div className="truncate"><span className="text-slate-400">UID:</span> {user.uid}</div>
              <div><span className="text-slate-400">Role:</span> {user.role}</div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <Button
              onClick={handleRecheckMembership}
              disabled={isChecking}
              className="w-full text-xs font-semibold"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
              Check Membership Status
            </Button>

            <Link href="/pricing" className="block">
              <Button variant="outline" className="w-full text-xs">
                Register a New Restaurant
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>

            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full text-xs text-slate-500 hover:text-slate-900"
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Sign Out & Switch Account
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">
          Operated by Vivexa Tech · Contact: <a href="mailto:admin@vivexatech.in" className="text-brand-600 underline">admin@vivexatech.in</a>
        </p>
      </div>
    </div>
  );
}
