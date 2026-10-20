import { getSupabaseClient } from "@/lib/supabaseClient";

export type Coordinates = { latitude: number; longitude: number };
type MaybeCoordinates = { latitude?: number | null; longitude?: number | null };
export type GeocodeResult = Coordinates & { source: "address" | "zip" };

export type AddressParts = {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

// Geocodes through /api/geocode. Returns null when nothing matched or the
// service is down; callers save the address anyway and skip distance.
export async function geocode(parts: AddressParts): Promise<GeocodeResult | null> {
  const params = new URLSearchParams();
  if (parts.address) params.set("address", parts.address);
  if (parts.city) params.set("city", parts.city);
  if (parts.state) params.set("state", parts.state);
  if (parts.zip) params.set("zip", parts.zip);

  try {
    const res = await fetch(`/api/geocode?${params}`);
    if (!res.ok) return null;
    return (await res.json()) as GeocodeResult;
  } catch {
    return null;
  }
}

// Great-circle distance in miles.
export function distanceMiles(a: MaybeCoordinates | null, b: MaybeCoordinates | null): number | null {
  if (a?.latitude == null || a.longitude == null || b?.latitude == null || b.longitude == null) return null;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export function formatDistance(miles: number | null): string {
  if (miles === null) return "Distance unknown";
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

// Nearest first; rows without coordinates go last.
export function sortByDistance<T>(rows: T[], distanceOf: (row: T) => number | null): T[] {
  return [...rows].sort((a, b) => {
    const da = distanceOf(a);
    const db = distanceOf(b);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
}

export type ProfileLocation = {
  latitude: number | null;
  longitude: number | null;
  service_radius_miles: number;
};

// The user's profile coordinates and service radius. Geocodes and saves
// the profile address first if it has no coordinates yet (accounts created
// before location support); coordinates stay null if that fails.
export async function ensureProfileLocation(userId: string): Promise<ProfileLocation> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("address, city, state, zip_code, latitude, longitude, service_radius_miles")
    .eq("id", userId)
    .single();

  const radius = Number(data?.service_radius_miles ?? 10);
  if (!data) return { latitude: null, longitude: null, service_radius_miles: radius };
  if (data.latitude != null && data.longitude != null) {
    return { latitude: data.latitude, longitude: data.longitude, service_radius_miles: radius };
  }

  const result = await geocode({ address: data.address, city: data.city, state: data.state, zip: data.zip_code });
  if (!result) return { latitude: null, longitude: null, service_radius_miles: radius };

  await supabase
    .from("profiles")
    .update({ latitude: result.latitude, longitude: result.longitude, geocode_source: result.source })
    .eq("id", userId);
  return { latitude: result.latitude, longitude: result.longitude, service_radius_miles: radius };
}

// Coordinates for a row that either uses the profile's address (copy the
// profile's coordinates) or an override (geocode it).
export async function coordinatesFor(
  useOverride: boolean,
  override: AddressParts,
  profile: MaybeCoordinates | null
): Promise<{ latitude: number | null; longitude: number | null }> {
  if (!useOverride) return { latitude: profile?.latitude ?? null, longitude: profile?.longitude ?? null };
  const result = await geocode(override);
  return { latitude: result?.latitude ?? null, longitude: result?.longitude ?? null };
}
