"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getCurrentUserRole, isRestaurantProfileComplete } from "@/lib/flow";

type RequestRow = {
  id: string;
  title: string;
  pickup_window: string | null;
  status: "open" | "responded" | "matched" | "completed" | "fulfilled" | "cancelled";
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

    const [{ data: requestRow, error: requestError }, { data: existingResponse, error: responseError }] = await Promise.all([
      supabase
        .from("shelter_requests")
        .select("id, title, pickup_window, status")
        .eq("id", requestId)
        .maybeSingle(),
      supabase
        .from("request_responses")
        .select("proposed_pickup_window, response_note, status")
        .eq("request_id", requestId)
        .eq("restaurant_id", user.id)
        .maybeSingle(),
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
    setPickupWindow(response?.proposed_pickup_window || parsed.pickup_window || "");
    setResponseNote(response?.response_note || "");
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

    if (request.status === "matched" || request.status === "completed" || request.status === "fulfilled" || request.status === "cancelled") {
      setStatusMsg("Cannot respond to this request because it is no longer open.");
      return;
    }

    setSubmitting(true);
    setStatusMsg(null);

    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Please sign in again.");
      }

      const { data: donation } = await supabase
        .from("donations")
        .select("id")
        .eq("restaurant_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!donation) {
        throw new Error("No donation profile found. Complete onboarding first.");
      }

      const { data: latestResponse } = await supabase
        .from("request_responses")
        .select("status")
        .eq("request_id", request.id)
        .eq("restaurant_id", user.id)
        .maybeSingle();

      const latestStatus = latestResponse?.status as ExistingResponseRow["status"] | undefined;
      if (latestStatus === "pending" || latestStatus === "accepted") {
        throw new Error("You already have an active response for this request.");
      }

      const { error: responseError } = await supabase
        .from("request_responses")
        .upsert(
          {
            request_id: request.id,
            restaurant_id: user.id,
            donation_id: donation.id,
            proposed_pickup_window: pickupWindow || null,
            response_note: responseNote || null,
            status: "pending",
          },
          { onConflict: "request_id,restaurant_id" }
        );

      if (responseError) {
        throw new Error(responseError.message);
      }

      setExistingResponseStatus("pending");

      await supabase
        .from("shelter_requests")
        .update({ status: "responded" })
        .eq("id", request.id)
        .eq("status", "open");

      setStatusMsg("Response submitted. Waiting for shelter acceptance.");
      router.push(`/restaurant/donation/${request.id}`);
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : "Failed to submit response.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <main className="mx-auto max-w-3xl rounded border border-slate-200 bg-white p-4 md:p-6">
        {loading ? (
          <p className="text-sm text-slate-600">Loading...</p>
        ) : !request ? (
          <p className="text-sm text-slate-600">Request unavailable.</p>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <button className="rounded border px-3 py-2 text-sm" onClick={() => router.push(`/restaurant/donation/${request.id}`)}>Back</button>
              <p className="text-sm text-slate-600">Status: {request.status}</p>
            </div>

            <h1 className="text-xl font-semibold text-slate-900">Respond to Request</h1>
            <p className="mt-1 text-sm text-slate-600">Submit your coordination details. Shelter will accept or reject your response.</p>

            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Proposed pickup window</label>
                <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" value={pickupWindow} onChange={(e) => setPickupWindow(e.target.value)} placeholder="Today 16:00 - 18:00" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Response note (optional)</label>
                <textarea className="w-full rounded border border-slate-300 px-3 py-2 text-sm" rows={4} value={responseNote} onChange={(e) => setResponseNote(e.target.value)} placeholder="Packaging, loading, or scheduling notes" />
              </div>
            </div>

            {statusMsg ? <p className="mt-4 text-sm text-slate-700">{statusMsg}</p> : null}

            <div className="mt-5 flex gap-2">
              <button
                className="rounded bg-emerald-800 px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={submitting || existingResponseStatus === "pending" || existingResponseStatus === "accepted"}
                onClick={() => void handleSubmitResponse()}
              >
                {submitting ? "Submitting..." : "Submit Response"}
              </button>
              <button className="rounded border px-4 py-2 text-sm" onClick={() => router.push(`/restaurant/donation/${request.id}`)}>Cancel</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
