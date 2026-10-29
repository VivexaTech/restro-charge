"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { loginWithEmail, loginWithGoogle } = useAuth();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }

    setIsLoading(true);
    const res = await loginWithEmail(email, password);
    setIsLoading(false);

    if (res.success) {
      toast.success("Authentication successful. Welcome back!");
      const vivexaTeamRoles = ["SUPER_ADMIN", "SALES_MANAGER", "ONBOARDING_EXECUTIVE", "SUPPORT_EXECUTIVE"];
      if (res.role && vivexaTeamRoles.includes(res.role)) {
        router.push("/super-admin");
      } else if (res.role === "KITCHEN_STAFF" || res.role === "ORDER_STAFF") {
        router.push("/staff");
      } else {
        router.push("/dashboard");
      }
    } else {
      toast.error(res.error || "Login failed.");
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const res = await loginWithGoogle();
    setIsLoading(false);

    if (res.success) {
      toast.success("Signed in with Google.");
      const vivexaTeamRoles = ["SUPER_ADMIN", "SALES_MANAGER", "ONBOARDING_EXECUTIVE", "SUPPORT_EXECUTIVE"];
      if (res.role && vivexaTeamRoles.includes(res.role)) {
        router.push("/super-admin");
      } else if (res.role === "KITCHEN_STAFF" || res.role === "ORDER_STAFF") {
        router.push("/staff");
      } else {
        router.push("/dashboard");
      }
    } else {
      toast.error(res.error || "Google sign-in failed.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center space-x-2.5">
          <div className="h-10 w-10 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold shadow-sm">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <span className="font-display font-bold text-2xl text-slate-900">
            RestroCharge
          </span>
        </Link>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 font-display">
          Sign in to your portal
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Enter your authorized credentials to access your restaurant operations
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-elevated rounded-2xl border border-slate-200">
          <form className="space-y-4" onSubmit={handleEmailLogin}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  placeholder="admin@vivexatech.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-brand-600 hover:text-brand-500"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" size="default" isLoading={isLoading} className="w-full font-semibold">
                Sign In
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </form>

          {/* Google Sign-in */}
          <div className="mt-4">
            <button
              type="button"
              disabled={isLoading}
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center px-4 py-2.5 border border-slate-300 rounded-lg shadow-sm text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition disabled:opacity-50"
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Sign in with Google
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Need a new restaurant account?{" "}
              <Link href="/restaurants/request" className="text-brand-600 font-semibold hover:underline">
                Request Onboarding
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
