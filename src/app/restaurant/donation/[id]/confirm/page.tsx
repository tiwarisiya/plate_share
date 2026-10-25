"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getCurrentUserRole, isRestaurantProfileComplete } from "@/lib/flow";
import { EMPTY_FOOD_SAFETY, FoodSafetyValue, foodSafetyColumns, validateFoodSafety, withDefaultPreparedAt } from "@/lib/food-safety";
import { geocode } from "@/lib/geo";
import { FoodSafetyFields } from "@/components/offers/food-safety-fields";
import { PickupMethodField } from "@/components/offers/pickup-method-field";
import { PhotoScan, applyScanToFoodSafety, linkFoodScan } from "@/components/offers/photo-scan";
import { PickupMethod } from "@/lib/delivery";
import {
  EMPTY_PICKUP_ADDRESS,
  PickupAddressFields,
  PickupAddressValue,
  validatePickupAddress,
} from "@/components/offers/pickup-address-fields";

type RequestRow = {
  id: string;
  shelter_id: string;
  title: string;
  pickup_window: string | null;
  status: "open" | "responded" | "matched" | "completed" | "cancelled";
};

type RestaurantDefaults = {
  cuisine: string | null;
  default_pickup_window: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

type ExistingResponseRow = {
  proposed_pickup_window: string | null;
  response_note: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
};

export default function DonationConfirmPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = String(params.id || "");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [pickupWindow, setPickupWindow] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [foodType, setFoodType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [defaults, setDefaults] = useState<RestaurantDefaults | null>(null);
  const [pickupAddress, setPickupAddress] = useState<PickupAddressValue>(EMPTY_PICKUP_ADDRESS);
  const [foodSafety, setFoodSafety] = useState<FoodSafetyValue>(EMPTY_FOOD_SAFETY);
  const [pickupMethod, setPickupMethod] = useState<PickupMethod>("self");
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanApplied, setScanApplied] = useState(false);
  const [existingResponseStatus, setExistingResponseStatus] = useState<ExistingResponseRow["status"] | null>(null);

  const loadData = async () => {
    setLoading(true);
    setStatusMsg(null);

    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/restaurant/login");
      return;
    }

    const role = await getCurrentUserRole(user.id);
    if (role && role !== "restaurant") {
      router.push("/shelter/home");
      return;
    }

    const complete = await isRestaurantProfileComplete(user.id);
    if (!complete) {
      router.push("/restaurant/register-donor/details");
      return;
    }

    const [
      { data: requestRow, error: requestError },
      { data: existingResponse, error: responseError },
      { data: profileRow },
    ] = await Promise.all([
      supabase
        .from("shelter_requests")
        .select("id, shelter_id, title, pickup_window, status")
        .eq("id", requestId)
        .maybeSingle(),
      supabase
        .from("request_responses")
        .select("proposed_pickup_window, response_note, status")
        .eq("request_id", requestId)
        .eq("restaurant_id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("cuisine, default_pickup_window, address, city, state, zip_code")
        .eq("id", user.id)
        .single(),
    ]);

    if (requestError) {
      setStatusMsg(`Failed to load request: ${requestError.message}`);
      setLoading(false);
      return;
    }

    if (responseError) {
      setStatusMsg(`Failed to load response data: ${responseError.message}`);
      setLoading(false);
      return;
    }

    if (!requestRow) {
      setStatusMsg("Request not found.");
      setLoading(false);
      return;
    }

    const parsed = requestRow as RequestRow;
    setRequest(parsed);

    const response = (existingResponse as ExistingResponseRow | null) || null;
    const restaurantDefaults = (profileRow as RestaurantDefaults | null) || null;
    setDefaults(restaurantDefaults);
    setPickupWindow(response?.proposed_pickup_window || parsed.pickup_window || restaurantDefaults?.default_pickup_window || "");
    setResponseNote(response?.response_note || "");
    setFoodType(restaurantDefaults?.cuisine || "");
    setFoodSafety(withDefaultPreparedAt);
    setExistingResponseStatus(response?.status || null);

    setLoading(false);
  };

  useEffect(() => {
    if (!requestId) return;
    void loadData();
  }, [requestId]);

  const handleSubmitResponse = async () => {
    if (!request) return;

    if (existingResponseStatus === "pending" || existingResponseStatus === "accepted") {
      setStatusMsg("You already have an active response for this request.");
      return;
    }

    if (request.status === "matched" || request.status === "completed" || request.status === "cancelled") {
      setStatusMsg("Cannot respond to this request because it is no longer open.");
      return;
    }

    setSubmitting(true);
    setStatusMsg(null);

    try {
      const parsedQuantity = quantity ? Number.parseInt(quantity, 10) : null;
      if (parsedQuantity !== null && (Number.isNaN(parsedQuantity) || parsedQuantity <= 0)) {
        throw new Error("Servings must be a positive number.");
      }

      const addressError = validatePickupAddress(pickupAddress);
      if (addressError) throw new Error(addressError);

      const safetyError = validateFoodSafety(foodSafety);
      if (safetyError) throw new Error(safetyError);
      const safety = foodSafetyColumns(foodSafety);
      const overrideLocation = pickupAddress.useCustom
        ? await geocode({ address: pickupAddress.address, city: pickupAddress.city, state: pickupAddress.state, zip: pickupAddress.zip })
        : null;

      const supabase = getSupabaseClient();
      const { data: responseId, error: responseError } = await supabase.rpc("submit_request_response", {
        p_request_id: request.id,
        p_proposed_pickup_window: pickupWindow || null,
        p_response_note: responseNote || null,
        p_food_type: foodType || null,
        p_quantity: parsedQuantity,
        p_pickup_address: pickupAddress.useCustom ? pickupAddress.address : null,
        p_pickup_city: pickupAddress.useCustom ? pickupAddress.city : null,
        p_pickup_state: pickupAddress.useCustom ? pickupAddress.state : null,
        p_pickup_zip: pickupAddress.useCustom ? pickupAddress.zip : null,
        p_prepared_at: safety.prepared_at,
        p_use_by: safety.use_by,
        p_storage_type: safety.storage_type,
        p_allergens: safety.allergens,
        p_allergen_notes: safety.allergen_notes,
        p_estimated_weight_lbs: safety.estimated_weight_lbs,
        p_safety_checklist_confirmed: true,
        p_pickup_latitude: overrideLocation?.latitude ?? null,
        p_pickup_longitude: overrideLocation?.longitude ?? null,
        p_pickup_method: pickupMethod,
      });

      if (responseError) {
        throw new Error(responseError.message);
      }

      if (scanId && responseId) {
        const { data: submitted } = await supabase.from("request_responses").select("donation_id").eq("id", responseId).single();
        await linkFoodScan(scanId, submitted?.donation_id ?? null);
      }

      setStatusMsg("Response sent. The shelter will review it and confirm the match.");
      router.push(`/restaurant/donation/${request.id}`);
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : "Failed to submit response.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-0 md:p-6">
      <main className="mx-auto max-w-3xl bg-white md:rounded md:border md:border-slate-200 md:shadow-sm">
        {loading ? (
          <div className="p-4 text-sm text-slate-600">Loading...</div>
        ) : !request ? (
          <div className="p-4 text-sm text-slate-600">Request unavailable.</div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
              <button onClick={() => router.push(`/restaurant/donation/${request.id}`)} className="text-slate-600 md:hidden">
                ←
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-semibold text-slate-900 md:text-xl">Respond to Request</h1>
                <p className="text-xs text-slate-500 md:text-sm">Status: {request.status}</p>
              </div>
              <button className="hidden md:inline-flex rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => router.push(`/restaurant/donation/${request.id}`)}>
                Back
              </button>
            </div>

            {/* Form */}
            <div className="px-4 py-4 md:px-6 md:py-5 space-y-4">
              <p className="text-sm text-slate-600">Submit your coordination details. The shelter reviews responses and confirms the match.</p>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Proposed pickup window</label>
                <input
                  className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm md:h-10 md:rounded-md md:px-3"
                  value={pickupWindow}
                  onChange={(e) => setPickupWindow(e.target.value)}
                  placeholder="Today 16:00 - 18:00"
                />
              </div>

              <PhotoScan
                onApply={(s, id) => {
                  if (s.food_name) setFoodType(s.description ? `${s.food_name} (${s.description})` : s.food_name);
                  if (s.estimated_servings) setQuantity(String(s.estimated_servings));
                  setFoodSafety((prev) => applyScanToFoodSafety(prev, s));
                  setScanId(id);
                  setScanApplied(true);
                }}
              />
              {scanApplied ? <p className="text-xs text-sky-800">Fields were pre-filled from the photo. Check each one, especially allergens, before submitting.</p> : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Food you are offering</label>
                  <input
                    className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm md:h-10 md:rounded-md md:px-3"
                    value={foodType}
                    onChange={(e) => setFoodType(e.target.value)}
                    placeholder="Prepared meals, bread, produce"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Servings (optional)</label>
                  <input
                    className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm md:h-10 md:rounded-md md:px-3"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="40"
                  />
                </div>
              </div>

              <PickupAddressFields value={pickupAddress} onChange={setPickupAddress} defaults={defaults} />
              <PickupMethodField value={pickupMethod} onChange={setPickupMethod} />

              <FoodSafetyFields value={foodSafety} onChange={setFoodSafety} />

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Response note (optional)</label>
                <textarea
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm md:rounded-md md:px-3 md:py-2"
                  rows={4}
                  value={responseNote}
                  onChange={(e) => setResponseNote(e.target.value)}
                  placeholder="Packaging, loading, or scheduling notes"
                />
              </div>

              {statusMsg ? (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-sm text-slate-700">{statusMsg}</p>
                </div>
              ) : null}

              {/* Action buttons */}
              <div className="flex flex-col gap-2 pt-2 md:flex-row">
                <button
                  className="h-12 w-full rounded-xl bg-emerald-800 text-sm font-semibold text-white disabled:opacity-50 md:h-10 md:w-auto md:rounded-md md:px-5"
                  disabled={submitting || existingResponseStatus === "pending" || existingResponseStatus === "accepted"}
                  onClick={() => void handleSubmitResponse()}
                >
                  {submitting ? "Submitting..." : "Submit Response"}
                </button>
                <button
                  className="h-12 w-full rounded-xl border border-slate-300 text-sm font-medium md:h-10 md:w-auto md:rounded-md md:px-5"
                  onClick={() => router.push(`/restaurant/donation/${request.id}`)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
