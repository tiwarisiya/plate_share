"use client";

import React from "react";
import { COURIER_DELIVERY_AVAILABLE, PICKUP_METHODS, PickupMethod } from "@/lib/delivery";

export function PickupMethodField({ value, onChange }: { value: PickupMethod; onChange: (next: PickupMethod) => void }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-slate-700">Pickup method</p>
      <div className="flex flex-col gap-1 md:flex-row md:gap-4">
        {PICKUP_METHODS.map(([key, label]) => {
          const disabled = key === "courier" && !COURIER_DELIVERY_AVAILABLE;
          return (
            <label key={key} className={`flex items-center gap-2 text-sm ${disabled ? "text-slate-400" : "text-slate-700"}`}>
              <input type="radio" name="pickup-method" checked={value === key} disabled={disabled} onChange={() => onChange(key)} />
              {label}
              {disabled ? <span className="text-xs">(coming soon)</span> : null}
            </label>
          );
        })}
      </div>
    </div>
  );
}
