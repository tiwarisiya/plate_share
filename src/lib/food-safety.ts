// Food-safety vocabulary shared by offers (responses and listings). Values
// must match the check constraints on public.donations.

export const ALLERGENS = [
  ["milk", "Milk"],
  ["eggs", "Eggs"],
  ["fish", "Fish"],
  ["shellfish", "Shellfish"],
  ["tree_nuts", "Tree nuts"],
  ["peanuts", "Peanuts"],
  ["wheat", "Wheat"],
  ["soy", "Soy"],
  ["sesame", "Sesame"],
] as const;

export type Allergen = (typeof ALLERGENS)[number][0];

export const STORAGE_TYPES = [
  ["refrigerated", "Refrigerated (41°F / 5°C or below)"],
  ["frozen", "Frozen"],
  ["hot_held", "Hot-held (135°F / 57°C or above)"],
  ["ambient", "Shelf-stable / room temperature"],
] as const;

export type StorageType = (typeof STORAGE_TYPES)[number][0];

export const SAFETY_CHECKLIST = [
  "The food was prepared, cooled and stored following our normal food-safety practices.",
  "It has been kept at a safe temperature for its storage type and is within its use-by time.",
  "It is covered or packaged, and labeled with what it is and when it was prepared.",
  "The allergens listed are complete to the best of our knowledge.",
] as const;

// One statement covering every SAFETY_CHECKLIST item, for quick forms.
export const SAFETY_CONFIRMATION =
  "I confirm this food was prepared, cooled and stored following our normal food-safety practices, has been kept at a safe temperature and is within its use-by time, is covered or packaged and labeled, and that the allergens listed are complete to the best of our knowledge.";

export const GOOD_SAMARITAN_NOTE =
  "The Bill Emerson Good Samaritan Food Donation Act (42 U.S.C. 1791) protects donors who give apparently wholesome food in good faith to nonprofit organizations from civil and criminal liability, except in cases of gross negligence or intentional misconduct. This is general information, not legal advice.";

export type FoodSafetyValue = {
  preparedAt: string; // datetime-local value
  useBy: string; // datetime-local value
  storageType: StorageType | "";
  allergens: Allergen[];
  allergenNotes: string;
  estimatedWeightLbs: string;
  checklist: boolean[];
};

export const EMPTY_FOOD_SAFETY: FoodSafetyValue = {
  preparedAt: "",
  useBy: "",
  storageType: "",
  allergens: [],
  allergenNotes: "",
  estimatedWeightLbs: "",
  checklist: SAFETY_CHECKLIST.map(() => false),
};

// A datetime-local input value for the given time (default now).
export function toDateTimeLocal(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Fills "prepared at" with the current time if it's empty; the restaurant
// can change it.
export function withDefaultPreparedAt(value: FoodSafetyValue): FoodSafetyValue {
  return value.preparedAt ? value : { ...value, preparedAt: toDateTimeLocal() };
}

// Returns an error message, or null when the value can be submitted.
export function validateFoodSafety(value: FoodSafetyValue): string | null {
  if (!value.preparedAt || !value.useBy) return "Enter when the food was prepared and when it must be used by.";
  if (new Date(value.useBy) <= new Date(value.preparedAt)) return "Use-by time must be after the prepared time.";
  if (new Date(value.useBy) <= new Date()) return "Use-by time has already passed.";
  if (!value.storageType) return "Choose how the food is stored.";
  if (value.estimatedWeightLbs) {
    const weight = Number(value.estimatedWeightLbs);
    if (Number.isNaN(weight) || weight <= 0) return "Weight must be a positive number.";
  }
  if (!value.checklist.every(Boolean)) return "Confirm the food-safety checklist.";
  return null;
}

// RPC/insert arguments for the food-safety columns on donations.
export function foodSafetyColumns(value: FoodSafetyValue) {
  return {
    prepared_at: new Date(value.preparedAt).toISOString(),
    use_by: new Date(value.useBy).toISOString(),
    storage_type: value.storageType || null,
    allergens: value.allergens,
    allergen_notes: value.allergenNotes.trim() || null,
    estimated_weight_lbs: value.estimatedWeightLbs ? Number(value.estimatedWeightLbs) : null,
  };
}

export function storageLabel(storageType: string | null): string | null {
  if (!storageType) return null;
  return STORAGE_TYPES.find(([key]) => key === storageType)?.[1].split(" (")[0] || storageType;
}

export function allergenLabels(allergens: string[] | null): string {
  if (!allergens || allergens.length === 0) return "None listed";
  return allergens.map((a) => ALLERGENS.find(([key]) => key === a)?.[1] || a).join(", ");
}
