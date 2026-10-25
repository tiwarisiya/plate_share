"use client";

import React from "react";
import {
  ALLERGENS,
  Allergen,
  FoodSafetyValue,
  GOOD_SAMARITAN_NOTE,
  SAFETY_CHECKLIST,
  SAFETY_CONFIRMATION,
  STORAGE_TYPES,
  StorageType,
} from "@/lib/food-safety";

const inputClass = "h-12 w-full rounded-xl border border-slate-300 px-4 text-sm md:h-10 md:rounded-md md:px-3";

type FoodSafetyFieldsProps = {
  value: FoodSafetyValue;
  onChange: (next: FoodSafetyValue) => void;
  // One checkbox covering the whole checklist instead of one per item.
  singleConfirmation?: boolean;
};

// Prepared-at / use-by, storage, allergens, weight, and the pre-submit
// checklist for an offer.
export function FoodSafetyFields({ value, onChange, singleConfirmation = false }: FoodSafetyFieldsProps) {
  const update = (patch: Partial<FoodSafetyValue>) => onChange({ ...value, ...patch });

  const toggleAllergen = (allergen: Allergen) =>
    update({
      allergens: value.allergens.includes(allergen)
        ? value.allergens.filter((a) => a !== allergen)
        : [...value.allergens, allergen],
    });

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">Food safety</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Prepared at</label>
          <input type="datetime-local" className={inputClass} value={value.preparedAt} onChange={(e) => update({ preparedAt: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Use by</label>
          <input type="datetime-local" className={inputClass} value={value.useBy} onChange={(e) => update({ useBy: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Storage</label>
          <select className={inputClass} value={value.storageType} onChange={(e) => update({ storageType: e.target.value as StorageType | "" })}>
            <option value="">Choose storage</option>
            {STORAGE_TYPES.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Estimated weight, lbs (optional)</label>
          <input className={inputClass} inputMode="decimal" value={value.estimatedWeightLbs} onChange={(e) => update({ estimatedWeightLbs: e.target.value })} placeholder="25" />
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Contains allergens</p>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map(([key, label]) => (
            <label key={key} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${value.allergens.includes(key) ? "border-amber-400 bg-amber-50 text-amber-900" : "border-slate-300 text-slate-700"}`}>
              <input type="checkbox" className="sr-only" checked={value.allergens.includes(key)} onChange={() => toggleAllergen(key)} />
              {label}
            </label>
          ))}
        </div>
        <input
          className={`${inputClass} mt-2`}
          value={value.allergenNotes}
          onChange={(e) => update({ allergenNotes: e.target.value })}
          placeholder="Allergen notes (e.g. made in a kitchen that also handles peanuts)"
        />
      </div>

      <fieldset className="space-y-2 rounded-lg bg-slate-50 p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Before you submit</legend>
        {singleConfirmation ? (
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={value.checklist.every(Boolean)}
              onChange={(e) => update({ checklist: value.checklist.map(() => e.target.checked) })}
            />
            {SAFETY_CONFIRMATION}
          </label>
        ) : (
          SAFETY_CHECKLIST.map((item, index) => (
            <label key={item} className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={value.checklist[index]}
                onChange={(e) => update({ checklist: value.checklist.map((checked, i) => (i === index ? e.target.checked : checked)) })}
              />
              {item}
            </label>
          ))
        )}
        <p className="pt-1 text-xs text-slate-500">{GOOD_SAMARITAN_NOTE}</p>
      </fieldset>
    </div>
  );
}
