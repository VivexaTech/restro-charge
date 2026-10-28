"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PublicNavbar } from "@/components/public/navbar";
import { PublicFooter } from "@/components/public/footer";
import { dataStore } from "@/lib/services/data-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search, ExternalLink, Utensils } from "lucide-react";

export default function RestaurantDirectoryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const publishedRestaurants = dataStore.getPublishedRestaurants();

  const filtered = publishedRestaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.cuisineType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicNavbar />

      <main className="flex-1 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-10">
            <span className="text-brand-600 font-semibold text-xs tracking-wider uppercase">
              Partner Venues
            </span>
            <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-slate-900 mt-1">
              Public Restaurant Directory
            </h1>
            <p className="text-slate-600 text-sm mt-2">
              Browse dining destinations with verified digital menus powered by RestroCharge.
            </p>

            <div className="mt-6 relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by restaurant name, cuisine, or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <Utensils className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-700">No restaurants match your search</h3>
              <p className="text-xs text-slate-400 mt-1">Try another keyword or city name.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {filtered.map((rest) => (
                <div
                  key={rest.id}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-card hover:shadow-soft transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="h-48 w-full relative overflow-hidden bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={rest.branding.coverImageUrl}
                        alt={rest.name}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-700 shadow-sm">
                        {rest.cuisineType}
                      </div>
                      {rest.branding.logoUrl && (
                        <div className="absolute -bottom-4 left-6 h-12 w-12 rounded-xl bg-white p-1 shadow-md border border-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={rest.branding.logoUrl}
                            alt=""
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                      )}
                    </div>

                    <div className="p-6 pt-7">
                      <h3 className="text-lg font-bold text-slate-900 mb-1">{rest.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center mb-3">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 mr-1" />
                        {rest.address}, {rest.city}
                      </p>
                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        {rest.description}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 pt-0 border-t border-slate-100 mt-4 flex items-center gap-2">
                    <Link href={`/${rest.slug}`} className="flex-1">
                      <Button variant="default" size="sm" className="w-full font-semibold">
                        View Website
                        <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
