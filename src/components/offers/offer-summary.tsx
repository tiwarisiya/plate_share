import React from "react";

export type OfferRow = {
  food_type: string | null;
  quantity: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  pickup_address_override: boolean;
};

// Columns to embed from donations when loading a response's offer.
export const OFFER_SELECT = "food_type, quantity, address, city, state, zip_code, pickup_address_override";

export function formatOfferAddress(offer: Pick<OfferRow, "address" | "city" | "state" | "zip_code">): string {
  if (!offer.address) return "Not provided";
  return `${offer.address}, ${offer.city || ""}, ${offer.state || ""} ${offer.zip_code || ""}`.trim();
}

export function OfferSummary({ offer }: { offer: OfferRow | null }) {
  if (!offer) return null;

  return (
    <div className="space-y-0.5 text-xs text-slate-600">
      <p>Offering: {offer.food_type || "Not specified"}{offer.quantity ? ` • ${offer.quantity} servings` : ""}</p>
      <p>
        Pickup at: {formatOfferAddress(offer)}
        {offer.pickup_address_override ? <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800">different from profile</span> : null}
      </p>
    </div>
  );
}
