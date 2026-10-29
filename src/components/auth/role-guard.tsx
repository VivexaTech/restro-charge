// ==============================================================================
// RESTROCHARGE - Role-Based Dashboard Access Guard
// Prevents unauthorized access, avoids infinite loops, and renders clean states.
// ==============================================================================

"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { UserRole } from "@/lib/types";
import { ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  portalName?: string;
}

export function RoleGuard({
  allowedRoles,
  children,
  portalName = "Restricted Platform Console",
}: RoleGuardProps) {
  const { user, role, isLoading } = useAuth();
  const router = useRouter();

  // If loading session
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500 mb-3" />
        <p className="text-xs text-slate-400 font-medium">Verifying access permissions...</p>
      </div>
    );
  }

  // If not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-slate-200 shadow-card text-center space-y-4">
          <div className="h-12 w-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 font-display">Authentication Required</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            You must be signed in with an authorized account to access the {portalName}.
          </p>
          <div className="pt-2">
            <Link href="/login">
              <Button className="w-full">Sign In to Continue</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // If role not permitted
  const hasAccess = allowedRoles.includes(role);
  if (!hasAccess) {
    const targetRedirect =
      role === "SUPER_ADMIN" ||
      role === "SALES_MANAGER" ||
      role === "ONBOARDING_EXECUTIVE" ||
      role === "SUPPORT_EXECUTIVE"
        ? "/super-admin"
        : role === "RESTAURANT_OWNER" || role === "RESTAURANT_MANAGER"
        ? "/dashboard"
        : role === "ORDER_STAFF" || role === "KITCHEN_STAFF"
        ? "/staff"
        : "/";

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-elevated text-center space-y-4">
          <div className="h-12 w-12 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white font-display">Access Denied</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Your current account role (<strong>{role}</strong>) does not have authorization to view this portal.
          </p>
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700 text-left text-[11px] space-y-1 font-mono text-slate-400">
            <div>UID: {user.uid}</div>
            <div>Email: {user.email}</div>
            <div>Required: {allowedRoles.join(" | ")}</div>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <Link href={targetRedirect} className="flex-1">
              <Button variant="default" className="w-full text-xs">
                Go to My Dashboard
              </Button>
            </Link>
            <Link href="/login" className="flex-1">
              <Button variant="outline" className="w-full text-xs border-slate-700 text-slate-300">
                Switch Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
