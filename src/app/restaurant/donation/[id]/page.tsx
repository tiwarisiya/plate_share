"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  getCurrentUserRole,
  isRestaurantProfileComplete,
  mapShelterStatusForUi,
  ShelterRequestStatus,
} from "@/lib/flow";

type RequestRow = {
  id: string;
  shelter_id: string;
  title: string;
  quantity: number | null;
  food_needed: string | null;
  food_restrictions: string | null;
  pickup_window: string | null;
  urgency: "low" | "medium" | "high";
  notes: string | null;
  coordination_notes: string | null;
  shelter_contact_email: string | null;
  shelter_contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: ShelterRequestStatus;
  matched_donation_id: string | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
};

type ResponseRow = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  proposed_pickup_window: string | null;
};

export default function DonationRequestDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = String(params.id || "");

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [shelterProfile, setShelterProfile] = useState<ProfileRow | null>(null);
  const [myResponse, setMyResponse] = useState<ResponseRow | null>(null);
  const [isMatchedToMe, setIsMatchedToMe] = useState(false);
  const [coordinationPickup, setCoordinationPickup] = useState("");

  const loadRequest = async () => {
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

    setUserId(user.id);

    let requestRow: any = null;
    const requestWithSnapshot = await supabase
      .from("shelter_requests")
      .select(
        "id, shelter_id, title, quantity, food_needed, food_restrictions, pickup_window, urgency, notes, coordination_notes, shelter_contact_email, shelter_contact_phone, address, city, state, zip_code, status, matched_donation_id"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (requestWithSnapshot.error && requestWithSnapshot.error.code === "42703") {
      const legacyRequest = await supabase
        .from("shelter_requests")
        .select(
          "id, shelter_id, title, quantity, food_needed, food_restrictions, pickup_window, urgency, notes, coordination_notes, address, city, state, zip_code, status, matched_donation_id"
        )
        .eq("id", requestId)
        .maybeSingle();

      if (legacyRequest.error) {
        setStatusMsg(`Failed to load request: ${legacyRequest.error.message}`);
        setLoading(false);
        return;
      }

      requestRow = legacyRequest.data
        ? { ...legacyRequest.data, shelter_contact_email: null, shelter_contact_phone: null }
        : null;
    } else if (requestWithSnapshot.error) {
      setStatusMsg(`Failed to load request: ${requestWithSnapshot.error.message}`);
      setLoading(false);
      return;
    } else {
      requestRow = requestWithSnapshot.data;
    }

    if (!requestRow) {
      setStatusMsg("Request not found.");
      setLoading(false);
      return;
    }

    const parsed = requestRow as RequestRow;
    setRequest(parsed);
    setCoordinationPickup(parsed.pickup_window || "");

    const { data: shelter } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("id", parsed.shelter_id)
      .maybeSingle();

    setShelterProfile((shelter as ProfileRow) || null);

    const { data: responseRow } = await supabase
      .from("request_responses")
      .select("id, status, proposed_pickup_window")
      .eq("request_id", requestId)
      .eq("restaurant_id", user.id)
      .maybeSingle();

    setMyResponse((responseRow as ResponseRow) || null);

    if (parsed.matched_donation_id) {
      const { data: donation } = await supabase
        .from("donations")
        .select("id, restaurant_id")
        .eq("id", parsed.matched_donation_id)
        .maybeSingle();
      setIsMatchedToMe(Boolean(donation && donation.restaurant_id === user.id));
    } else {
      setIsMatchedToMe(false);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!requestId) return;
    void loadRequest();
  }, [requestId]);

  const contactVisible = useMemo(() => {
    // Contact is visible once this restaurant has responded at least once
    // or when the request is matched to this restaurant.
    const hasRespondedAtLeastOnce = Boolean(myResponse);
    return Boolean(hasRespondedAtLeastOnce || isMatchedToMe);
  }, [myResponse, isMatchedToMe]);

  const canRespond = useMemo(() => {
    if (!request) return false;
    if (request.status === "matched" || request.status === "completed" || request.status === "fulfilled" || request.status === "cancelled") return false;
    if (!myResponse) return true;
    return myResponse.status === "rejected" || myResponse.status === "cancelled";
  }, [request, myResponse]);

  const responseActionLabel = useMemo(() => {
    if (!request) return "Response unavailable";
    if (myResponse?.status === "accepted") return "Response accepted by shelter";
    if (myResponse?.status === "pending") return "Awaiting shelter decision";
    if (request.status === "completed" || request.status === "fulfilled") return "Request already completed";
    if (request.status === "cancelled") return "Request cancelled by shelter";
    if (request.status === "matched") return "Request already matched";
    return "Response unavailable for this status";
  }, [request, myResponse]);

  const canUpdateMatchedPickup = Boolean(request && request.status === "matched" && isMatchedToMe);

  const handleUpdateMatchedPickup = async () => {
    if (!request || !canUpdateMatchedPickup) return;

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("shelter_requests")
      .update({ pickup_window: coordinationPickup })
      .eq("id", request.id)
      .eq("status", "matched");

    if (error) {
      setStatusMsg(`Failed to update pickup window: ${error.message}`);
      return;
    }

    setStatusMsg("Pickup window updated for coordination.");
    await loadRequest();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <main className="mx-auto max-w-4xl rounded border border-slate-200 bg-white p-4 md:p-6">
        {loading ? (
          <p className="text-sm text-slate-600">Loading request details...</p>
        ) : !request ? (
          <p className="text-sm text-slate-600">Request unavailable.</p>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <button className="rounded border px-3 py-2 text-sm" onClick={() => router.push("/restaurant/home")}>Back</button>
              <p className="text-sm text-slate-700">Status: {mapShelterStatusForUi(request.status)}</p>
            </div>

            <h1 className="text-2xl font-semibold text-slate-900">{request.title}</h1>
            <p className="mt-1 text-sm text-slate-600">Shelter: {shelterProfile?.name || "Shelter"}</p>

            <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <p><span className="font-medium text-slate-900">Servings:</span> {request.quantity || "-"}</p>
              <p><span className="font-medium text-slate-900">Food types:</span> {request.food_needed || "Not provided"}</p>
              <p><span className="font-medium text-slate-900">Pickup window:</span> {request.pickup_window || "Not provided"}</p>
              <p><span className="font-medium text-slate-900">Urgency:</span> {request.urgency}</p>
              <p className="md:col-span-2"><span className="font-medium text-slate-900">Location:</span> {request.address || "Address"}, {request.city || "City"}, {request.state || "ST"} {request.zip_code || ""}</p>
              <p className="md:col-span-2"><span className="font-medium text-slate-900">Notes:</span> {request.notes || "None"}</p>
              {request.coordination_notes ? <p className="md:col-span-2"><span className="font-medium text-slate-900">Coordination:</span> {request.coordination_notes}</p> : null}
            </div>

            <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Shelter Contact Details</p>
              {contactVisible ? (
                <div className="space-y-1 text-sm text-slate-700">
                  <p>Email: {request.shelter_contact_email || "Not provided"}</p>
                  <p>Phone: {request.shelter_contact_phone || "Not provided"}</p>
                  {!request.shelter_contact_email && !request.shelter_contact_phone ? (
                    <p className="text-xs text-slate-500">Shelter has not published contact fields yet.</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-600">Visible after your restaurant submits a response or when this request is matched to your restaurant.</p>
              )}
            </div>

            {myResponse ? (
              <div className="mt-4 rounded border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">Your response status: {myResponse.status}</p>
                <p className="text-slate-600">Proposed pickup: {myResponse.proposed_pickup_window || "Not provided"}</p>
              </div>
            ) : null}

            {statusMsg ? <p className="mt-3 text-sm text-slate-700">{statusMsg}</p> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {canRespond ? (
                <button className="rounded bg-emerald-800 px-4 py-2 text-sm text-white" onClick={() => router.push(`/restaurant/donation/${request.id}/confirm`)}>
                  Respond to Request
                </button>
              ) : (
                <button className="cursor-not-allowed rounded border px-4 py-2 text-sm text-slate-500" disabled>
                  {responseActionLabel}
                </button>
              )}
            </div>

            {canUpdateMatchedPickup ? (
              <div className="mt-4 rounded border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium text-slate-900">Update pickup window (coordination)</p>
                <div className="flex flex-wrap gap-2">
                  <input className="h-9 min-w-[280px] rounded border border-slate-300 px-2 text-sm" value={coordinationPickup} onChange={(e) => setCoordinationPickup(e.target.value)} placeholder="Updated pickup window" />
                  <button className="rounded border px-3 py-1 text-sm" onClick={() => void handleUpdateMatchedPickup()}>Save pickup window</button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
