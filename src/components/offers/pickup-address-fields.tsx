"use client";

import React from "react";
import { formatOfferAddress } from "@/components/offers/offer-summary";

const inputClass = "h-12 w-full rounded-xl border border-slate-300 px-4 text-sm md:h-10 md:rounded-md md:px-3";

export type PickupAddressValue = {
  useCustom: boolean;
  address: string;
  city: string;
  state: string;
  zip: string;
};

export const EMPTY_PICKUP_ADDRESS: PickupAddressValue = { useCustom: false, address: "", city: "", state: "", zip: "" };

export type AddressDefaults = {
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

// Returns an error message, or null when the override (if any) is complete.
export function validatePickupAddress(value: PickupAddressValue): string | null {
  if (value.useCustom && (!value.address || !value.city || !value.state || !value.zip)) {
    return "Fill in the full pickup address, or use your default address.";
  }
  return null;
}

// Default pickup address from the profile, with an optional per-offer
// override.
export function PickupAddressFields({
  value,
  onChange,
  defaults,
}: {
  value: PickupAddressValue;
  onChange: (next: PickupAddressValue) => void;
  defaults: AddressDefaults | null;
}) {
  const update = (patch: Partial<PickupAddressValue>) => onChange({ ...value, ...patch });

  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={value.useCustom} onChange={(e) => update({ useCustom: e.target.checked })} />
        Use a different pickup address for this offer
      </label>
      {value.useCustom ? (
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <input className={`${inputClass} md:col-span-2`} value={value.address} onChange={(e) => update({ address: e.target.value })} placeholder="Address" />
          <input className={inputClass} value={value.city} onChange={(e) => update({ city: e.target.value })} placeholder="City" />
          <div className="grid grid-cols-2 gap-2">
            <input className={inputClass} maxLength={2} value={value.state} onChange={(e) => update({ state: e.target.value })} placeholder="State" />
            <input className={inputClass} maxLength={5} value={value.zip} onChange={(e) => update({ zip: e.target.value })} placeholder="ZIP" />
          </div>
        </div>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          Pickup from your default address: {defaults?.address ? formatOfferAddress(defaults) : "not set"}
        </p>
      )}
    </div>
  );
}
