"use client";

import React, { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { FoodSafetyValue, allergenLabels, storageLabel } from "@/lib/food-safety";
import { FoodScanResponse, FoodScanSuggestions } from "@/lib/food-scan/types";
import { Button } from "@/components/ui/button";
import { PhotoPicker } from "@/components/ui/photo-picker";

const MAX_DIMENSION = 1024;

// Shrinks the photo to at most 1024px on its longest side as a JPEG, so
// scans are fast and cheap.
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read the photo"))), "image/jpeg", 0.8)
  );
}

type PhotoScanProps = {
  // Controlled photo (e.g. the listing photo, which is also uploaded). When
  // omitted the component keeps the photo itself (response form).
  photo?: File | null;
  onPhotoChange?: (file: File | null) => void;
  onApply: (suggestions: FoodScanSuggestions, scanId: string | null) => void;
};

// Photo picker plus "Scan photo to pre-fill": sends a resized photo to
// /api/scan-food and shows the suggestions for the restaurant to apply. If
// scanning isn't set up, only the picker shows; if a scan fails it says so
// and the form carries on as normal.
export function PhotoScan({ photo, onPhotoChange, onApply }: PhotoScanProps) {
  const [configured, setConfigured] = useState(false);
  const [ownPhoto, setOwnPhoto] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<FoodScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/scan-food")
      .then((res) => res.json())
      .then((body: { configured?: boolean }) => setConfigured(Boolean(body.configured)))
      .catch(() => setConfigured(false));
  }, []);

  const file = photo === undefined ? ownPhoto : photo;
  const setFile = (next: File | null) => {
    if (photo === undefined) setOwnPhoto(next);
    onPhotoChange?.(next);
    setResult(null);
    setError(null);
  };

  const scan = async () => {
    if (!file) return;
    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const form = new FormData();
      form.append("image", await resizeImage(file), "photo.jpg");

      const res = await fetch("/api/scan-food", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: form,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn't scan this photo.");
      setResult(body as FoodScanResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't scan this photo.");
    } finally {
      setScanning(false);
    }
  };

  const s = result?.suggestions;

  // Without scanning, the response form has no use for a photo; the
  // listing form still needs its photo picker.
  if (!configured) return photo === undefined ? null : <PhotoPicker file={file} onChange={setFile} />;

  return (
    <div className="space-y-2 text-sm">
      <PhotoPicker file={file} onChange={setFile}>
        <Button type="button" size="sm" variant="secondary" disabled={scanning} onClick={() => void scan()}>
          {scanning ? "Scanning..." : "✨ Scan photo to pre-fill"}
        </Button>
      </PhotoPicker>
      {!file ? <p className="text-xs text-slate-500">Add a photo, then scan it to fill in the form for you.</p> : null}

      {error ? <p className="text-xs text-slate-600">{error}</p> : null}

      {s ? (
        !s.is_food ? (
          <p className="text-xs text-slate-600">This photo doesn&apos;t look like food. Try another photo, or fill in the form manually.</p>
        ) : (
          <div className="space-y-1 rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-xs text-slate-700">
            <p className="font-medium text-slate-900">Suggestions from the photo ({s.confidence} confidence)</p>
            {s.food_name ? <p>Food: {s.food_name}{s.description ? ` (${s.description})` : ""}</p> : null}
            {s.estimated_servings || s.estimated_weight_lbs ? (
              <p>
                About {s.estimated_servings ? `${s.estimated_servings} servings` : ""}
                {s.estimated_servings && s.estimated_weight_lbs ? ", " : ""}
                {s.estimated_weight_lbs ? `${s.estimated_weight_lbs} lbs` : ""}
              </p>
            ) : null}
            <p>Possible allergens: {allergenLabels(s.allergens)}</p>
            {s.storage_type ? <p>Storage: {storageLabel(s.storage_type)}</p> : null}
            {s.concerns.length > 0 ? <p className="text-amber-800">Check: {s.concerns.join("; ")}</p> : null}
            <p className="text-slate-500">Allergens can&apos;t be confirmed from a photo. Review every field before submitting.</p>
            <Button type="button" size="sm" className="mt-1" onClick={() => onApply(s, result?.scanId ?? null)}>
              Apply suggestions
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}

// Applies suggestions to the food-safety fields. Storage and weight are
// replaced only when the scan has a value; allergens are added to the
// restaurant's selection, never removed. The checklist is untouched.
export function applyScanToFoodSafety(value: FoodSafetyValue, s: FoodScanSuggestions): FoodSafetyValue {
  return {
    ...value,
    storageType: s.storage_type ?? value.storageType,
    estimatedWeightLbs: s.estimated_weight_lbs ? String(s.estimated_weight_lbs) : value.estimatedWeightLbs,
    allergens: Array.from(new Set([...value.allergens, ...s.allergens])),
  };
}

// Records which offer or listing a scan ended up in, so suggestions can be
// compared with what was submitted. Best effort: a failure here doesn't
// affect the submission.
export async function linkFoodScan(scanId: string | null, donationId: string | null) {
  if (!scanId || !donationId) return;
  const supabase = getSupabaseClient();
  await supabase.from("food_scans").update({ donation_id: donationId }).eq("id", scanId);
}
