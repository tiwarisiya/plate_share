"use client";

import React, { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { EMPTY_FOOD_SAFETY, FoodSafetyValue, foodSafetyColumns, validateFoodSafety } from "@/lib/food-safety";
import { LISTING_PHOTO_BUCKET, LISTING_SELECT, ListingRow, isListingExpired, listingPhotoUrl } from "@/lib/listings";
import { RoleShell, useRoleGuard } from "@/components/ui/role-shell";
import { Button } from "@/components/ui/button";
import { FoodSafetyFields } from "@/components/offers/food-safety-fields";
import { OfferSummary } from "@/components/offers/offer-summary";
import {
  AddressDefaults,
  EMPTY_PICKUP_ADDRESS,
  PickupAddressFields,
  PickupAddressValue,
  validatePickupAddress,
} from "@/components/offers/pickup-address-fields";

const inputClass = "h-12 w-full rounded-xl border border-slate-300 px-4 text-sm md:h-10 md:rounded-md md:px-3";

type RestaurantDefaults = AddressDefaults & { name: string | null; cuisine: string | null; default_pickup_window: string | null };

const STATUS_LABEL: Record<ListingRow["status"], string> = {
  posted: "Available",
  matched: "Claimed",
  completed: "Picked up",
  cancelled: "Withdrawn",
};

export default function RestaurantListingsPage() {
  const userId = useRoleGuard("restaurant");
  const [defaults, setDefaults] = useState<RestaurantDefaults | null>(null);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [shelterNames, setShelterNames] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [foodType, setFoodType] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pickupWindow, setPickupWindow] = useState("");
  const [pickupBy, setPickupBy] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pickupAddress, setPickupAddress] = useState<PickupAddressValue>(EMPTY_PICKUP_ADDRESS);
  const [foodSafety, setFoodSafety] = useState<FoodSafetyValue>(EMPTY_FOOD_SAFETY);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const supabase = getSupabaseClient();
      const [{ data: profileRow }, { data: rows, error }] = await Promise.all([
        supabase.from("profiles").select("name, cuisine, default_pickup_window, address, city, state, zip_code").eq("id", userId).single(),
        supabase.from("donations").select(LISTING_SELECT).eq("restaurant_id", userId).eq("kind", "listing").order("created_at", { ascending: false }),
      ]);

      if (error) {
        setMsg(`Failed to load listings: ${error.message}`);
        return;
      }

      const profile = (profileRow as RestaurantDefaults | null) || null;
      setDefaults(profile);
      setFoodType((prev) => prev || profile?.cuisine || "");
      setPickupWindow((prev) => prev || profile?.default_pickup_window || "");

      const parsed = (rows || []) as ListingRow[];
      setListings(parsed);

      const shelterIds = Array.from(new Set(parsed.map((row) => row.matched_shelter_id).filter(Boolean))) as string[];
      if (shelterIds.length > 0) {
        const { data: shelters } = await supabase.from("profiles").select("id, name").in("id", shelterIds);
        const names: Record<string, string> = {};
        (shelters || []).forEach((row: { id: string; name: string | null }) => {
          names[row.id] = row.name || "Shelter";
        });
        setShelterNames(names);
      }
    };

    void load();
  }, [userId, reloadKey]);

  const resetForm = () => {
    setDescription("");
    setQuantity("");
    setPickupBy("");
    setPhoto(null);
    setPickupAddress(EMPTY_PICKUP_ADDRESS);
    setFoodSafety(EMPTY_FOOD_SAFETY);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !defaults) return;
    setMsg(null);

    const parsedQuantity = Number.parseInt(quantity, 10);
    const error =
      (!foodType.trim() && "Describe the food you're offering.") ||
      ((Number.isNaN(parsedQuantity) || parsedQuantity <= 0) && "Servings must be a positive number.") ||
      (!pickupBy && "Set a pick-up-by time.") ||
      (pickupBy && new Date(pickupBy) <= new Date() && "Pick-up-by time has already passed.") ||
      validatePickupAddress(pickupAddress) ||
      validateFoodSafety(foodSafety);
    if (error) {
      setMsg(error);
      return;
    }

    setSubmitting(true);
    const supabase = getSupabaseClient();

    let photoPath: string | null = null;
    if (photo) {
      const ext = photo.name.split(".").pop() || "jpg";
      photoPath = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(LISTING_PHOTO_BUCKET).upload(photoPath, photo, { contentType: photo.type });
      if (uploadError) {
        setSubmitting(false);
        setMsg(`Failed to upload photo: ${uploadError.message}`);
        return;
      }
    }

    const useCustom = pickupAddress.useCustom;
    const { error: insertError } = await supabase.from("donations").insert({
      restaurant_id: userId,
      restaurant_name: defaults.name,
      kind: "listing",
      food_type: foodType.trim(),
      description: description.trim() || null,
      quantity: parsedQuantity,
      pickup_window: pickupWindow.trim() || null,
      pickup_by: new Date(pickupBy).toISOString(),
      photo_path: photoPath,
      address: useCustom ? pickupAddress.address : defaults.address,
      city: useCustom ? pickupAddress.city : defaults.city,
      state: useCustom ? pickupAddress.state : defaults.state,
      zip_code: useCustom ? pickupAddress.zip : defaults.zip_code,
      pickup_address_override: useCustom,
      ...foodSafetyColumns(foodSafety),
      safety_checklist_confirmed_at: new Date().toISOString(),
    });
    setSubmitting(false);

    if (insertError) {
      setMsg(`Failed to post listing: ${insertError.message}`);
      return;
    }

    resetForm();
    reload();
    setMsg("Listing posted. Nearby shelters can now claim it.");
  };

  const withdraw = async (listing: ListingRow) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("withdraw_listing", { p_donation_id: listing.id });
    if (error) {
      setMsg(`Failed to withdraw listing: ${error.message}`);
      return;
    }
    reload();
    setMsg("Listing withdrawn.");
  };

  return (
    <RoleShell role="restaurant" activeId="listings">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-900 md:text-2xl">Surplus Food Listings</h1>
          <p className="text-xs text-slate-600 md:text-sm">Post food you have available now. Shelters nearby can claim it for pickup.</p>
        </div>

        {msg ? <p className="mb-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">{msg}</p> : null}

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-5">
            <h2 className="mb-3 text-sm font-medium text-slate-900">Post available food</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Food</label>
                <input className={inputClass} value={foodType} onChange={(e) => setFoodType(e.target.value)} placeholder="Vegetable lasagna" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description (optional)</label>
                <textarea className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm md:rounded-md md:px-3 md:py-2" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="2 full hotel pans, packed in foil" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Servings</label>
                  <input className={inputClass} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="30" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Pick up by</label>
                  <input type="datetime-local" className={inputClass} value={pickupBy} onChange={(e) => setPickupBy(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Pickup window (optional)</label>
                <input className={inputClass} value={pickupWindow} onChange={(e) => setPickupWindow(e.target.value)} placeholder="Today 4-7pm, back door" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Photo (optional)</label>
                <input type="file" accept="image/*" className="text-sm" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
              </div>
              <PickupAddressFields value={pickupAddress} onChange={setPickupAddress} defaults={defaults} />
              <FoodSafetyFields value={foodSafety} onChange={setFoodSafety} />
              <Button type="submit" className="w-full" disabled={submitting || !defaults}>{submitting ? "Posting..." : "Post listing"}</Button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white lg:col-span-7">
            <p className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-800">Your listings</p>
            {listings.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-600">No listings yet.</p>
            ) : (
              listings.map((listing) => {
                const expired = listing.status === "posted" && isListingExpired(listing);
                const photoUrl = listingPhotoUrl(listing.photo_path);
                return (
                  <div key={listing.id} className="flex gap-3 border-t border-slate-200 px-4 py-3 first:border-t-0">
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl} alt={listing.food_type || "Listing photo"} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-2xl">🥡</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-slate-900">{listing.food_type}</p>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {expired ? "Expired" : STATUS_LABEL[listing.status]}
                        </span>
                      </div>
                      {listing.description ? <p className="text-xs text-slate-600">{listing.description}</p> : null}
                      <p className="text-xs text-slate-600">
                        Pick up by {listing.pickup_by ? new Date(listing.pickup_by).toLocaleString() : "-"}
                        {listing.matched_shelter_id ? ` • Claimed by ${shelterNames[listing.matched_shelter_id] || "a shelter"}` : ""}
                      </p>
                      <OfferSummary offer={listing} />
                      {listing.status === "posted" ? (
                        <Button size="sm" variant="secondary" className="mt-2" onClick={() => void withdraw(listing)}>Withdraw</Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </div>
    </RoleShell>
  );
}
