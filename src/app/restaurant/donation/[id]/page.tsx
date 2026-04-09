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

  const urgencyColor = (u: string) => {
    if (u === "high") return "bg-red-100 text-red-800";
    if (u === "medium") return "bg-amber-100 text-amber-800";
    return "bg-green-100 text-green-800";
  };

  return (
    <div className="min-h-screen bg-slate-50 p-0 md:p-6">
      <main className="mx-auto max-w-4xl bg-white md:rounded md:border md:border-slate-200 md:shadow-sm">
        {loading ? (
          <div className="p-4 text-sm text-slate-600">Loading request details...</div>
        ) : !request ? (
          <div className="p-4 text-sm text-slate-600">Request unavailable.</div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
              <button onClick={() => router.push("/restaurant/home")} className="text-slate-600 md:hidden">
                ←
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-semibold text-slate-900 truncate md:text-2xl">{request.title}</h1>
                <p className="text-xs text-slate-500 md:text-sm">Shelter: {shelterProfile?.name || "Shelter"}</p>
              </div>
              <span className={`hidden md:inline-flex rounded-full px-3 py-1 text-xs font-medium ${urgencyColor(request.urgency)}`}>
                {request.urgency} urgency
              </span>
              <button className="hidden md:inline-flex rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => router.push("/restaurant/home")}>
                Back
              </button>
            </div>

            {/* Mobile status + urgency bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 md:hidden">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${urgencyColor(request.urgency)}`}>
                {request.urgency} urgency
              </span>
              <span className="text-xs text-slate-500">
                {mapShelterStatusForUi(request.status)}
              </span>
            </div>

            {/* Desktop status */}
            <div className="hidden md:flex items-center justify-between px-6 py-3 border-b border-slate-100">
              <p className="text-sm text-slate-700">Status: {mapShelterStatusForUi(request.status)}</p>
            </div>

            {/* Details */}
            <div className="px-4 py-4 md:px-6 md:py-5 space-y-4">
              {/* Info cards */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 md:text-xs">Servings</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 md:text-base">{request.quantity || "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 md:text-xs">Urgency</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 capitalize md:text-base">{request.urgency}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 col-span-2 md:col-span-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 md:text-xs">Pickup Window</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{request.pickup_window || "Not provided"}</p>
                </div>
              </div>

              {/* Food details */}
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Food Details</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Food types</span>
                    <span className="font-medium text-slate-900 text-right max-w-[60%]">{request.food_needed || "Not specified"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Restrictions</span>
                    <span className="font-medium text-slate-900 text-right max-w-[60%]">{request.food_restrictions || "None"}</span>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Location</p>
                <p className="text-sm text-slate-900">
                  {request.address || "Address"}, {request.city || "City"}, {request.state || "ST"} {request.zip_code || ""}
                </p>
              </div>

              {/* Notes */}
              {request.notes ? (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Notes</p>
                  <p className="text-sm text-slate-700">{request.notes}</p>
                </div>
              ) : null}

              {/* Coordination notes */}
              {request.coordination_notes ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-emerald-600 mb-2">Coordination</p>
                  <p className="text-sm text-slate-700">{request.coordination_notes}</p>
                </div>
              ) : null}

              {/* Contact */}
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Shelter Contact</p>
                {contactVisible ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">✉️</span>
                      <span className="text-slate-700">{request.shelter_contact_email || "Not provided"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">📞</span>
                      <span className="text-slate-700">{request.shelter_contact_phone || "Not provided"}</span>
                    </div>
                    {!request.shelter_contact_email && !request.shelter_contact_phone ? (
                      <p className="text-xs text-slate-500">Shelter has not published contact fields yet.</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Visible after your restaurant submits a response or when matched.</p>
                )}
              </div>

              {/* My response */}
              {myResponse ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Your Response</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <span className={`font-medium capitalize ${
                        myResponse.status === "accepted" ? "text-emerald-700" :
                        myResponse.status === "pending" ? "text-amber-700" :
                        "text-slate-700"
                      }`}>{myResponse.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Proposed pickup</span>
                      <span className="font-medium text-slate-900">{myResponse.proposed_pickup_window || "Not provided"}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {statusMsg ? <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">{statusMsg}</p> : null}

              {/* Action buttons */}
              <div className="flex flex-col gap-2 md:flex-row">
                {canRespond ? (
                  <button
                    className="h-12 w-full rounded-xl bg-emerald-800 text-sm font-semibold text-white md:h-10 md:w-auto md:rounded-md md:px-5"
                    onClick={() => router.push(`/restaurant/donation/${request.id}/confirm`)}
                  >
                    Respond to Request
                  </button>
                ) : (
                  <button
                    className="h-12 w-full cursor-not-allowed rounded-xl border border-slate-300 text-sm text-slate-500 md:h-10 md:w-auto md:rounded-md md:px-5"
                    disabled
                  >
                    {responseActionLabel}
                  </button>
                )}
              </div>

              {/* Coordination pickup update */}
              {canUpdateMatchedPickup ? (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Update Pickup Window</p>
                  <input
                    className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm md:h-10 md:rounded-md md:px-3"
                    value={coordinationPickup}
                    onChange={(e) => setCoordinationPickup(e.target.value)}
                    placeholder="Updated pickup window"
                  />
                  <button
                    className="mt-2 h-10 w-full rounded-xl border border-slate-300 text-sm font-medium md:w-auto md:rounded-md md:px-4"
                    onClick={() => void handleUpdateMatchedPickup()}
                  >
                    Save pickup window
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
