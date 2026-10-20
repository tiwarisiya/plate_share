import React from "react";
import { allergenLabels, storageLabel } from "@/lib/food-safety";

export type OfferRow = {
  food_type: string | null;
  quantity: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  pickup_address_override: boolean;
  prepared_at: string | null;
  use_by: string | null;
  storage_type: string | null;
  allergens: string[] | null;
  allergen_notes: string | null;
  estimated_weight_lbs: number | null;
  pickup_method: "self" | "courier";
};

// Columns to embed from donations when loading a response's offer.
export const OFFER_SELECT =
  "food_type, quantity, address, city, state, zip_code, pickup_address_override, prepared_at, use_by, storage_type, allergens, allergen_notes, estimated_weight_lbs, pickup_method";

const formatTime = (at: string) => new Date(at).toLocaleString([], { dateStyle: "short", timeStyle: "short" });

export function formatOfferAddress(offer: Pick<OfferRow, "address" | "city" | "state" | "zip_code">): string {
  if (!offer.address) return "Not provided";
  return `${offer.address}, ${offer.city || ""}, ${offer.state || ""} ${offer.zip_code || ""}`.trim();
}

export function OfferSummary({ offer }: { offer: OfferRow | null }) {
  if (!offer) return null;

  return (
    <div className="space-y-0.5 text-xs text-slate-600">
      <p>
        Offering: {offer.food_type || "Not specified"}
        {offer.quantity ? ` • ${offer.quantity} servings` : ""}
        {offer.estimated_weight_lbs ? ` • ~${offer.estimated_weight_lbs} lbs` : ""}
      </p>
      {offer.prepared_at || offer.use_by || offer.storage_type ? (
        <p>
          {offer.prepared_at ? `Prepared ${formatTime(offer.prepared_at)}` : ""}
          {offer.use_by ? ` • Use by ${formatTime(offer.use_by)}` : ""}
          {offer.storage_type ? ` • ${storageLabel(offer.storage_type)}` : ""}
        </p>
      ) : null}
      <p>
        Allergens: {allergenLabels(offer.allergens)}
        {offer.allergen_notes ? ` (${offer.allergen_notes})` : ""}
      </p>
      <p>
        Pickup at: {formatOfferAddress(offer)}
        {offer.pickup_method === "courier" ? <span className="ml-1 rounded bg-sky-100 px-1 text-[10px] font-medium text-sky-800">courier delivery</span> : null}
        {offer.pickup_address_override ? <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800">different from profile</span> : null}
      </p>
    </div>
  );
}
