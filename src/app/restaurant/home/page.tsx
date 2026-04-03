"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  getCurrentUserRole,
  isRestaurantProfileComplete,
  mapShelterStatusForUi,
  ShelterRequestStatus,
} from "@/lib/flow";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

type Tab = "open" | "responses" | "matched";

type RequestRow = {
  id: string;
  title: string;
  quantity: number | null;
  food_needed: string | null;
  pickup_window: string | null;
  urgency: "low" | "medium" | "high";
  notes: string | null;
  city: string | null;
  state: string | null;
  status: ShelterRequestStatus;
  created_at: string;
  matched_donation_id: string | null;
};

type ResponseRow = {
  id: string;
  request_id: string;
  restaurant_id: string;
  donation_id: string | null;
  proposed_pickup_window: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
};

type RequestSummary = {
  id: string;
  title: string;
  status: ShelterRequestStatus;
};

export default function RestaurantHome() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("open");
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [openRequests, setOpenRequests] = useState<RequestRow[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [matchedRequests, setMatchedRequests] = useState<RequestRow[]>([]);
  const [requestSummariesById, setRequestSummariesById] = useState<Record<string, RequestSummary>>({});

  const loadDashboard = async () => {
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

    const [{ data: requestRows }, { data: myResponses }] = await Promise.all([
      supabase
        .from("shelter_requests")
        .select("id, title, quantity, food_needed, pickup_window, urgency, notes, city, state, status, created_at, matched_donation_id")
        .in("status", ["open", "responded", "matched", "fulfilled", "cancelled"])
        .order("created_at", { ascending: false }),
      supabase
        .from("request_responses")
        .select("id, request_id, restaurant_id, donation_id, proposed_pickup_window, status, created_at")
        .eq("restaurant_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    const parsedRequests = (requestRows || []) as RequestRow[];
    const parsedResponses = (myResponses || []) as ResponseRow[];

    const summaries: Record<string, RequestSummary> = {};
    parsedRequests.forEach((row) => {
      summaries[row.id] = { id: row.id, title: row.title, status: row.status };
    });
    setRequestSummariesById(summaries);

    const responseRequestIds = new Set(parsedResponses.map((row) => row.request_id));

    const openQueue = parsedRequests.filter((row) => {
      if (row.status !== "open" && row.status !== "responded") return false;
      const myResponse = parsedResponses.find((resp) => resp.request_id === row.id);
      return !myResponse || myResponse.status === "rejected" || myResponse.status === "cancelled";
    });

    const matchedRequestIds = new Set(
      parsedResponses
        .filter((resp) => resp.status === "accepted")
        .map((resp) => resp.request_id)
    );

    const matched = parsedRequests.filter((row) => matchedRequestIds.has(row.id));

    setOpenRequests(openQueue);
    setResponses(parsedResponses);
    setMatchedRequests(matched);

    setLoading(false);
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const responseByRequest = useMemo(() => {
    const map: Record<string, ResponseRow> = {};
    responses.forEach((row) => {
      if (!map[row.request_id]) {
        map[row.request_id] = row;
      }
    });
    return map;
  }, [responses]);

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        title="Plate Share"
        subtitle="Restaurant Operations"
        activeId="home"
        items={[
          { id: "home", label: "Requests", icon: "📋", onClick: () => router.push("/restaurant/home") },
          { id: "profile", label: "Profile", icon: "👤", onClick: () => router.push("/restaurant/profile") },
          { id: "settings", label: "Settings", icon: "⚙️", onClick: () => router.push("/restaurant/settings") },
        ]}
        footerLabel="Sign out"
        onFooterClick={() => void handleSignOut()}
      />

      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Restaurant Request Queue</h1>
              <p className="text-sm text-slate-600">Browse open shelter requests and manage your response pipeline.</p>
            </div>
            <div className="flex gap-2">
              <Button variant={activeTab === "open" ? "primary" : "secondary"} onClick={() => setActiveTab("open")}>Open Requests</Button>
              <Button variant={activeTab === "responses" ? "primary" : "secondary"} onClick={() => setActiveTab("responses")}>My Responses</Button>
              <Button variant={activeTab === "matched" ? "primary" : "secondary"} onClick={() => setActiveTab("matched")}>Matched</Button>
            </div>
          </div>

          {statusMsg ? <p className="mb-4 text-sm text-slate-700">{statusMsg}</p> : null}

          <section className="rounded border border-slate-200 bg-white p-0">
            {loading ? (
              <p className="px-4 py-6 text-sm text-slate-600">Loading requests...</p>
            ) : activeTab === "open" ? (
              openRequests.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-600">No open requests available right now.</p>
              ) : (
                <>
                  <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-4 py-3 text-xs uppercase text-slate-500">
                    <p className="col-span-3">Request</p>
                    <p className="col-span-2">Servings</p>
                    <p className="col-span-2">Food Type</p>
                    <p className="col-span-2">Pickup</p>
                    <p className="col-span-1">Urgency</p>
                    <p className="col-span-2 text-right">Action</p>
                  </div>
                  {openRequests.map((row) => (
                    <div key={row.id} className="grid grid-cols-12 gap-2 border-t border-slate-200 px-4 py-3 text-sm">
                      <div className="col-span-3">
                        <p className="font-medium text-slate-900">{row.title}</p>
                        <p className="text-xs text-slate-500">{row.city || "City"}, {row.state || "ST"}</p>
                      </div>
                      <p className="col-span-2 text-slate-700">{row.quantity || "-"}</p>
                      <p className="col-span-2 text-slate-700">{row.food_needed || "Not specified"}</p>
                      <p className="col-span-2 text-slate-700">{row.pickup_window || "Not set"}</p>
                      <p className="col-span-1 capitalize text-slate-700">{row.urgency}</p>
                      <div className="col-span-2 text-right">
                        <button className="rounded border px-3 py-1 text-xs" onClick={() => router.push(`/restaurant/donation/${row.id}`)}>
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )
            ) : activeTab === "responses" ? (
              responses.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-600">You have not responded to any requests yet.</p>
              ) : (
                responses.map((row) => (
                  <div key={row.id} className="border-t border-slate-200 px-4 py-3 text-sm first:border-t-0">
                    {(() => {
                      const requestSummary = requestSummariesById[row.request_id];
                      const requestAvailable = Boolean(requestSummary);

                      return (
                        <>
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-900">{requestSummary?.title || `Request ${row.request_id.slice(0, 8)}`}</p>
                      <p className="capitalize text-slate-700">{row.status}</p>
                    </div>
                    {requestSummary ? <p className="text-xs text-slate-500">Current request status: {mapShelterStatusForUi(requestSummary.status)}</p> : null}
                    <p className="text-slate-600">Proposed pickup: {row.proposed_pickup_window || "Not provided"}</p>
                    {requestAvailable ? (
                      <button className="mt-2 rounded border px-3 py-1 text-xs" onClick={() => router.push(`/restaurant/donation/${row.request_id}`)}>
                        Open Request
                      </button>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">This request is no longer accessible.</p>
                    )}
                        </>
                      );
                    })()}
                  </div>
                ))
              )
            ) : matchedRequests.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-600">No matched requests yet.</p>
            ) : (
              matchedRequests.map((row) => (
                <div key={row.id} className="border-t border-slate-200 px-4 py-3 text-sm first:border-t-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900">{row.title}</p>
                    <p className="text-slate-700">{mapShelterStatusForUi(row.status)}</p>
                  </div>
                  <p className="text-slate-600">Pickup window: {row.pickup_window || "Not set"}</p>
                  <button className="mt-2 rounded border px-3 py-1 text-xs" onClick={() => router.push(`/restaurant/donation/${row.id}`)}>
                    View Coordination Details
                  </button>
                </div>
              ))
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
