import React from "react";
import { RestaurantSidebar } from "@/components/dashboard/sidebar";
import { RoleGuard } from "@/components/auth/role-guard";

export const metadata = {
  title: "Restaurant Admin Dashboard | RestroCharge",
  description: "Operations, Menu & Website Customization Portal for Restaurant Owners",
};

export default function RestaurantDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard
      allowedRoles={["SUPER_ADMIN", "RESTAURANT_OWNER", "RESTAURANT_MANAGER"]}
      portalName="Restaurant Management Dashboard"
    >
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden">
        <RestaurantSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto w-full max-w-full">
          {children}
        </main>
      </div>
    </RoleGuard>
  );
}
