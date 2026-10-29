"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  UserPlus,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Store,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RestaurantRegistrationRequest } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth/client-auth";

export default function SuperAdminOnboardingRequestsPage() {
  const [requests, setRequests] = useState<RestaurantRegistrationRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/requests");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      toast.error("Failed to load onboarding requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleAction = async (requestId: string, action: "APPROVE" | "REJECT") => {
    setProcessingId(requestId);
    try {
      const res = await authFetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action, reviewedBy: "Vivexa Super Admin" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(
        action === "APPROVE"
          ? `Approved! Restaurant provisioned and email sent.`
          : `Request marked as rejected.`
      );

      // Reload
      loadRequests();
    } catch (err: any) {
      toast.error(err.message || "Failed to process request.");
    } finally {
      setProcessingId(null);
    }
  };

  const pendingList = requests.filter((r) => r.status === "PENDING");
  const processedList = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            Inbound Applications
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            Restaurant Onboarding Requests
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review prospective dining venues. Approving establishes tenant isolation and notifies the owner.
          </p>
        </div>

        <Badge variant="warning" className="px-3 py-1 text-xs">
          {pendingList.length} Pending Review
        </Badge>
      </div>

      {/* Pending Applications Section */}
      <div className="space-y-4">
        <h3 className="font-bold text-base text-slate-900 font-display flex items-center">
          <Clock className="h-4 w-4 text-amber-500 mr-2" />
          Pending Applications ({pendingList.length})
        </h3>

        {pendingList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
            No pending onboarding requests at this time. All caught up!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingList.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono text-slate-400">{req.id}</span>
                    <span className="text-xs text-slate-500">{formatDate(req.createdAt)}</span>
                  </div>

                  <h4 className="text-lg font-bold text-slate-900">{req.restaurantName}</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    <strong>Applicant:</strong> {req.applicantName}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Email:</span>
                      <span className="truncate block font-medium">{req.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Phone:</span>
                      <span className="font-medium">{req.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">City:</span>
                      <span className="font-medium">{req.city}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Est. Tables:</span>
                      <span className="font-medium">{req.estimatedTables} tables</span>
                    </div>
                  </div>

                  {req.message && (
                    <p className="text-xs text-slate-500 italic mt-3 bg-white p-2 rounded border border-slate-100">
                      &quot;{req.message}&quot;
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={processingId === req.id}
                    onClick={() => handleAction(req.id, "REJECT")}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={processingId === req.id}
                    isLoading={processingId === req.id}
                    onClick={() => handleAction(req.id, "APPROVE")}
                    className="font-semibold shadow-sm"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve & Onboard
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historical Processed Applications */}
      {processedList.length > 0 && (
        <div className="space-y-4 pt-6">
          <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wider font-display">
            Historical Applications
          </h3>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Restaurant</th>
                  <th className="py-2.5 px-4">Applicant</th>
                  <th className="py-2.5 px-4">City</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Decision Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedList.map((req) => (
                  <tr key={req.id}>
                    <td className="py-3 px-4 font-bold text-slate-900">{req.restaurantName}</td>
                    <td className="py-3 px-4 text-slate-600">{req.applicantName}</td>
                    <td className="py-3 px-4 text-slate-600">{req.city}</td>
                    <td className="py-3 px-4">
                      <Badge variant={req.status === "APPROVED" ? "success" : "danger"}>
                        {req.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {req.reviewedAt ? formatDate(req.reviewedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
