import { ALLERGENS, Allergen, STORAGE_TYPES, StorageType } from "@/lib/food-safety";

// What a photo scan suggests for an offer or listing. Everything is a
// suggestion the restaurant reviews; nothing here is submitted directly.
export type FoodScanSuggestions = {
  is_food: boolean;
  food_name: string | null;
  description: string | null;
  estimated_servings: number | null;
  estimated_weight_lbs: number | null;
  allergens: Allergen[];
  storage_type: StorageType | null;
  concerns: string[];
  confidence: "low" | "medium" | "high";
};

export type FoodScanResponse = {
  scanId: string | null;
  model: string;
  suggestions: FoodScanSuggestions;
};

export interface FoodScanProvider {
  name: string;
  model: string;
  // Throws FoodScanUnavailableError when the provider is unconfigured,
  // rate-limited or out of quota, so the app falls back to the plain form.
  scan(image: { data: Uint8Array; mimeType: string }): Promise<FoodScanSuggestions>;
}

export class FoodScanUnavailableError extends Error {}

const ALLERGEN_KEYS = ALLERGENS.map(([key]) => key) as string[];
const STORAGE_KEYS = STORAGE_TYPES.map(([key]) => key) as string[];

const clampText = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

const positiveNumber = (value: unknown, max: number) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 10) / 10 : null;
};

// Keeps only values the app understands: allergens and storage types from
// the fixed lists, bounded numbers and short strings.
export function sanitizeSuggestions(raw: unknown): FoodScanSuggestions {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const allergens = Array.isArray(r.allergens)
    ? (Array.from(new Set(r.allergens.filter((a): a is string => typeof a === "string" && ALLERGEN_KEYS.includes(a)))) as Allergen[])
    : [];
  const storage = typeof r.storage_type === "string" && STORAGE_KEYS.includes(r.storage_type) ? (r.storage_type as StorageType) : null;
  const servings = positiveNumber(r.estimated_servings, 5000);

  return {
    is_food: r.is_food !== false,
    food_name: clampText(r.food_name, 120),
    description: clampText(r.description, 300),
    estimated_servings: servings === null ? null : Math.round(servings),
    estimated_weight_lbs: positiveNumber(r.estimated_weight_lbs, 2000),
    allergens,
    storage_type: storage,
    concerns: Array.isArray(r.concerns)
      ? r.concerns.map((c) => clampText(c, 200)).filter((c): c is string => Boolean(c)).slice(0, 5)
      : [],
    confidence: r.confidence === "high" || r.confidence === "medium" ? r.confidence : "low",
  };
}
