import { getSupabaseClient } from "@/lib/supabaseClient";
import { OFFER_SELECT, OfferRow } from "@/components/offers/offer-summary";

export const LISTING_PHOTO_BUCKET = "listing-photos";

export type ListingRow = OfferRow & {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  description: string | null;
  pickup_window: string | null;
  pickup_by: string | null;
  photo_path: string | null;
  status: "posted" | "matched" | "completed" | "cancelled";
  matched_shelter_id: string | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
};

export const LISTING_SELECT = `id, restaurant_id, restaurant_name, description, pickup_window, pickup_by, photo_path, status, matched_shelter_id, created_at, latitude, longitude, ${OFFER_SELECT}`;

export function listingPhotoUrl(path: string | null): string | null {
  if (!path) return null;
  return getSupabaseClient().storage.from(LISTING_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function isListingExpired(listing: Pick<ListingRow, "pickup_by">): boolean {
  return Boolean(listing.pickup_by && new Date(listing.pickup_by) <= new Date());
}
