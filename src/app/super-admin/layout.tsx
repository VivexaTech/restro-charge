import React from "react";
import { SuperAdminNav } from "@/components/super-admin/admin-nav";
import { RoleGuard } from "@/components/auth/role-guard";

export const metadata = {
  title: "Super Admin Platform | Vivexa Tech RestroCharge",
  description: "Vivexa Tech Multi-Tenant Management & Central Control Console",
};

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "SALES_MANAGER", "ONBOARDING_EXECUTIVE", "SUPPORT_EXECUTIVE"]} portalName="Vivexa Super Admin Panel">
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden">
        <SuperAdminNav />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto w-full max-w-full">
          {children}
        </main>
      </div>
    </RoleGuard>
  );
}
