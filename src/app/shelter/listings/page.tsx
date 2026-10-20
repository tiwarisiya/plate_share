"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { ProfileLocation, distanceMiles, ensureProfileLocation, formatDistance, sortByDistance } from "@/lib/geo";
import { LISTING_SELECT, ListingRow, listingPhotoUrl } from "@/lib/listings";
import { RoleShell, useRoleGuard } from "@/components/ui/role-shell";
import { Button } from "@/components/ui/button";
import { OfferSummary } from "@/components/offers/offer-summary";

export default function ShelterListingsPage() {
  const router = useRouter();
  const userId = useRoleGuard("shelter");
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<ProfileLocation | null>(null);
  const [withinRadiusOnly, setWithinRadiusOnly] = useState(true);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const supabase = getSupabaseClient();
      setMyLocation(await ensureProfileLocation(userId));
      const { data, error } = await supabase
        .from("donations")
        .select(LISTING_SELECT)
        .eq("kind", "listing")
        .eq("status", "posted")
        .order("pickup_by", { ascending: true });

      if (error) setMsg(`Failed to load listings: ${error.message}`);
      setListings((data || []) as ListingRow[]);
      setLoading(false);
    };

    void load();
  }, [userId, reloadKey]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("shelter-listings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, () => {
        reload();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Nearest first; with the filter on, hide listings beyond the pickup
  // radius (listings without coordinates always show).
  const visibleListings = useMemo(() => {
    const sorted = sortByDistance(listings, (row) => distanceMiles(myLocation, row));
    if (!withinRadiusOnly || !myLocation || myLocation.latitude === null) return sorted;
    return sorted.filter((row) => {
      const miles = distanceMiles(myLocation, row);
      return miles === null || miles <= myLocation.service_radius_miles;
    });
  }, [listings, myLocation, withinRadiusOnly]);

  const claim = async (listing: ListingRow) => {
    setClaimingId(listing.id);
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("claim_listing", { p_donation_id: listing.id });
    setClaimingId(null);

    if (error) {
      setMsg(`Failed to claim: ${error.message}`);
      reload();
      return;
    }

    router.push("/shelter/home");
  };

  return (
    <RoleShell role="shelter" activeId="listings">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-900 md:text-2xl">Available Food</h1>
          <p className="text-xs text-slate-600 md:text-sm">Surplus food restaurants have posted. Claim it and it appears in your matched requests for pickup.</p>
        </div>

        {myLocation && myLocation.latitude !== null ? (
          <label className="mb-4 flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={withinRadiusOnly} onChange={(e) => setWithinRadiusOnly(e.target.checked)} />
            Only within my {myLocation.service_radius_miles} mi pickup radius
            {withinRadiusOnly && listings.length > visibleListings.length ? (
              <span className="text-slate-400">({listings.length - visibleListings.length} farther away hidden)</span>
            ) : null}
          </label>
        ) : null}

        {msg ? <p className="mb-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">{msg}</p> : null}

        {loading ? (
          <p className="text-sm text-slate-600">Loading listings...</p>
        ) : visibleListings.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">No food is available right now. New listings appear here as restaurants post them.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleListings.map((listing) => {
              const photoUrl = listingPhotoUrl(listing.photo_path);
              return (
                <div key={listing.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt={listing.food_type || "Listing photo"} className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-emerald-50 text-4xl">🥡</div>
                  )}
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <p className="font-semibold text-slate-900">{listing.food_type}</p>
                    <p className="text-xs text-slate-500">
                      {listing.restaurant_name || "Restaurant"} • {formatDistance(distanceMiles(myLocation, listing))}
                    </p>
                    {listing.description ? <p className="text-sm text-slate-700">{listing.description}</p> : null}
                    <p className="text-xs font-medium text-amber-800">
                      Pick up by {listing.pickup_by ? new Date(listing.pickup_by).toLocaleString() : "-"}
                      {listing.pickup_window ? ` • ${listing.pickup_window}` : ""}
                    </p>
                    <OfferSummary offer={listing} />
                    <div className="mt-auto pt-3">
                      <Button className="w-full" disabled={claimingId === listing.id} onClick={() => void claim(listing)}>
                        {claimingId === listing.id ? "Claiming..." : "Claim for pickup"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </RoleShell>
  );
}
