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
import { MobileHeader, MobileBottomNav } from "@/components/ui/mobile-nav";
import { Button } from "@/components/ui/button";

type Tab = "open" | "matched" | "completed";
type ScreenTab = "requests" | "chats";
type RequestTab = "open" | "matched" | "completed";

type RequestRow = {
  id: string;
  shelter_id: string;
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

type ChatInboxItem = {
  requestId: string;
  partnerName: string;
  requestTitle: string;
  lastSenderRole: "restaurant" | "shelter" | null;
  preview: string;
  createdAt: string;
  timestamp: string;
  sortAt: number;
};

type ShelterSummary = {
  id: string;
  name: string | null;
};

export default function RestaurantHome() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ScreenTab>("requests");
  const [requestTab, setRequestTab] = useState<RequestTab>("open");
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [openRequests, setOpenRequests] = useState<RequestRow[]>([]);
  const [matchedRequests, setMatchedRequests] = useState<RequestRow[]>([]);
  const [completedRequests, setCompletedRequests] = useState<RequestRow[]>([]);
  const [requestSummariesById, setRequestSummariesById] = useState<Record<string, RequestSummary>>({});
  const [shelterNamesById, setShelterNamesById] = useState<Record<string, string>>({});
  const [myResponseByRequestId, setMyResponseByRequestId] = useState<Record<string, ResponseRow>>({});
  const [chatInboxItems, setChatInboxItems] = useState<ChatInboxItem[]>([]);

  const loadDashboard = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setStatusMsg(null);
    }

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

    const [{ data: requestRows, error: requestError }, { data: myResponses, error: responsesError }] = await Promise.all([
      supabase
        .from("shelter_requests")
        .select("id, shelter_id, title, quantity, food_needed, pickup_window, urgency, notes, city, state, status, created_at, matched_donation_id")
        .in("status", ["open", "responded", "matched", "completed", "fulfilled", "cancelled"])
        .order("created_at", { ascending: false }),
      supabase
        .from("request_responses")
        .select("id, request_id, restaurant_id, donation_id, proposed_pickup_window, status, created_at")
        .eq("restaurant_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (requestError || responsesError) {
      setStatusMsg(`Failed to load dashboard: ${(requestError || responsesError)?.message || "Unknown error"}`);
      setOpenRequests([]);
      setMatchedRequests([]);
      setCompletedRequests([]);
      setChatInboxItems([]);
      setMyResponseByRequestId({});
      setRequestSummariesById({});
      setShelterNamesById({});
      if (!silent) setLoading(false);
      return;
    }

    const parsedRequests = (requestRows || []) as RequestRow[];
    const parsedResponses = (myResponses || []) as ResponseRow[];

    const responseByRequest: Record<string, ResponseRow> = {};
    parsedResponses.forEach((row) => {
      if (!responseByRequest[row.request_id]) {
        responseByRequest[row.request_id] = row;
      }
    });
    setMyResponseByRequestId(responseByRequest);

    const summaries: Record<string, RequestSummary> = {};
    parsedRequests.forEach((row) => {
      summaries[row.id] = { id: row.id, title: row.title, status: row.status };
    });
    setRequestSummariesById(summaries);

    let shelterNames: Record<string, string> = {};
    const shelterIds = Array.from(new Set(parsedRequests.map((row) => row.shelter_id)));
    if (shelterIds.length > 0) {
      const { data: shelterProfiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", shelterIds);

      (shelterProfiles || []).forEach((row: ShelterSummary) => {
        const shelter = row as ShelterSummary;
        shelterNames[shelter.id] = shelter.name || "Shelter";
      });
    }
    setShelterNamesById(shelterNames);

    const openQueue = parsedRequests.filter((row) => row.status === "open" || row.status === "responded");

    const matched = parsedRequests.filter((row) => row.status === "matched");

    const completed = parsedRequests.filter(
      (row) => row.status === "completed" || row.status === "fulfilled" || row.status === "cancelled"
    );

    setOpenRequests(openQueue);
    setMatchedRequests(matched);
    setCompletedRequests(completed);

    if (matched.length === 0) {
      setChatInboxItems([]);
    } else {
      const matchedChatRequestIds = matched.map((row) => row.id);
      const { data: chatRows } = await supabase
        .from("chat_messages")
        .select("request_id, sender_role, message, created_at")
        .in("request_id", matchedChatRequestIds)
        .order("created_at", { ascending: false });

      const latestByRequestId: Record<string, { sender_role: "restaurant" | "shelter"; message: string; created_at: string }> = {};
      (chatRows || []).forEach((row: { request_id: string; sender_role: "restaurant" | "shelter"; message: string; created_at: string }) => {
        if (!latestByRequestId[row.request_id]) {
          latestByRequestId[row.request_id] = {
            sender_role: row.sender_role,
            message: row.message,
            created_at: row.created_at,
          };
        }
      });

      const inbox = matched
        .map((row) => {
          const latest = latestByRequestId[row.id];
          const fallbackTime = new Date(row.created_at).getTime();
          const latestTime = latest ? new Date(latest.created_at).getTime() : fallbackTime;
          const partnerName = shelterNames[row.shelter_id] || "Shelter";
          const senderPrefix = latest ? (latest.sender_role === "restaurant" ? "You" : partnerName) : "No messages";

          return {
            requestId: row.id,
            partnerName,
            requestTitle: row.title,
            lastSenderRole: latest ? latest.sender_role : null,
            preview: latest ? `${senderPrefix}: ${latest.message}` : "No messages yet. Open chat to start coordination.",
            createdAt: latest ? latest.created_at : row.created_at,
            timestamp: new Date(latest ? latest.created_at : row.created_at).toLocaleString(),
            sortAt: latestTime,
          };
        })
        .sort((a, b) => b.sortAt - a.sortAt);

      setChatInboxItems(inbox);
    }

    if (!silent) setLoading(false);
  };

  useEffect(() => {
    void loadDashboard();

    const timer = setInterval(() => {
      void loadDashboard(true);
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("restaurant-home-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        void loadDashboard(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "shelter_requests" }, () => {
        void loadDashboard(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "request_responses" }, () => {
        void loadDashboard(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, () => {
        void loadDashboard(true);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const getRespondAction = (row: RequestRow): { canRespond: boolean; label: string } => {
    const myResponse = myResponseByRequestId[row.id];

    if (row.status === "matched" || row.status === "completed" || row.status === "fulfilled" || row.status === "cancelled") {
      return { canRespond: false, label: "Request unavailable" };
    }

    if (!myResponse) {
      return { canRespond: true, label: "Respond" };
    }

    if (myResponse.status === "rejected" || myResponse.status === "cancelled") {
      return { canRespond: true, label: "Respond Again" };
    }

    if (myResponse.status === "pending") {
      return { canRespond: false, label: "Response submitted" };
    }

    if (myResponse.status === "accepted") {
      return { canRespond: false, label: "Response accepted" };
    }

    return { canRespond: false, label: "Request unavailable" };
  };


  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/");
  };

  const navItems = [
    { id: "requests", label: "Requests", icon: "📋", onClick: () => setActiveTab("requests") },
    { id: "chats", label: "Chats", icon: "💬", onClick: () => setActiveTab("chats"), count: chatInboxItems.length },
    { id: "signout", label: "Sign Out", icon: "🚪", onClick: () => void handleSignOut() },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <MobileHeader
        title="Plate Share"
        subtitle="Restaurant Operations"
      />
      <Sidebar
        title="Plate Share"
        subtitle="Restaurant Operations"
        activeId={activeTab}
        items={navItems}
        footerLabel="Sign out"
        onFooterClick={() => void handleSignOut()}
      />
      <MobileBottomNav items={navItems} activeId={activeTab} />

      <main className="flex-1 px-4 pt-[72px] pb-20 md:px-6 md:py-6 md:pt-6 md:pb-6">
        <div className="mx-auto max-w-7xl">
          {/* Page title */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-slate-900 md:text-2xl">{activeTab === "requests" ? "Restaurant Request Queue" : "Chats"}</h1>
                <p className="text-xs text-slate-600 md:text-sm">
                  {activeTab === "requests"
                    ? "Browse shelter requests and manage your response pipeline."
                    : "Conversations with shelters on matched requests."}
                </p>
              </div>
              {activeTab === "requests" ? (
                <div className="hidden md:flex gap-2">
                  <Button variant={requestTab === "open" ? "primary" : "secondary"} className="shrink-0 whitespace-nowrap" onClick={() => setRequestTab("open")}>Open Requests</Button>
                  <Button variant={requestTab === "matched" ? "primary" : "secondary"} className="shrink-0 whitespace-nowrap" onClick={() => setRequestTab("matched")}>Matched</Button>
                  <Button variant={requestTab === "completed" ? "primary" : "secondary"} className="shrink-0 whitespace-nowrap" onClick={() => setRequestTab("completed")}>Completed</Button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Mobile: Tappable stats tiles */}
          {activeTab === "requests" ? (
            <div className="mb-4 md:hidden space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => setRequestTab("open")} className={`rounded-xl p-3 text-center transition ${requestTab === "open" ? "border-2 border-emerald-600 bg-emerald-50" : "border border-slate-200 bg-white"}`}>
                  <p className={`text-2xl font-bold ${requestTab === "open" ? "text-emerald-700" : "text-slate-900"}`}>{openRequests.length}</p>
                  <p className="text-[11px] text-slate-500">Open<br />Requests</p>
                </button>
                <button onClick={() => setRequestTab("matched")} className={`rounded-xl p-3 text-center transition ${requestTab === "matched" ? "border-2 border-emerald-600 bg-emerald-50" : "border border-slate-200 bg-white"}`}>
                  <p className={`text-2xl font-bold ${requestTab === "matched" ? "text-emerald-700" : "text-slate-900"}`}>{matchedRequests.length}</p>
                  <p className="text-[11px] text-slate-500">Matched</p>
                </button>
                <button onClick={() => setRequestTab("completed")} className={`rounded-xl p-3 text-center transition ${requestTab === "completed" ? "border-2 border-emerald-600 bg-emerald-50" : "border border-slate-200 bg-white"}`}>
                  <p className={`text-2xl font-bold ${requestTab === "completed" ? "text-emerald-700" : "text-slate-900"}`}>{completedRequests.length}</p>
                  <p className="text-[11px] text-slate-500">Completed</p>
                </button>
              </div>
            </div>
          ) : null}

          {statusMsg ? <p className="mb-4 text-sm text-slate-700">{statusMsg}</p> : null}

          {activeTab === "requests" ? (
          <section className="rounded-xl border border-slate-200 bg-white p-0 md:rounded">
            {loading ? (
              <p className="px-4 py-6 text-sm text-slate-600">Loading requests...</p>
            ) : requestTab === "open" ? (
              openRequests.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-600">No open requests available right now.</p>
              ) : (
                <>
                  <div className="hidden md:grid grid-cols-12 gap-2 border-b border-slate-200 px-4 py-3 text-xs uppercase text-slate-500">
                    <p className="col-span-3">Request</p>
                    <p className="col-span-2">Shelter</p>
                    <p className="col-span-2">Servings</p>
                    <p className="col-span-2">Food Type</p>
                    <p className="col-span-2">Pickup</p>
                    <p className="col-span-1">Urgency</p>
                    <p className="col-span-12 text-[10px] text-slate-400">Includes open and responded requests, even if you already submitted a pending response.</p>
                  </div>
                  {openRequests.map((row) => {
                    const respondAction = getRespondAction(row);
                    return (
                    <div key={row.id} className="border-t border-slate-200 px-3 py-3 text-sm md:px-4">
                      {/* Desktop table row */}
                      <div className="hidden md:block">
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-3">
                            <p className="font-medium text-slate-900">{row.title}</p>
                            <p className="text-xs text-slate-500">{row.city || "City"}, {row.state || "ST"}</p>
                          </div>
                          <p className="col-span-2 text-slate-700">{shelterNamesById[row.shelter_id] || "Shelter"}</p>
                          <p className="col-span-2 text-slate-700">{row.quantity || "-"}</p>
                          <p className="col-span-2 text-slate-700">{row.food_needed || "Not specified"}</p>
                          <p className="col-span-2 text-slate-700">{row.pickup_window || "Not set"}</p>
                          <p className="col-span-1 capitalize text-slate-700">{row.urgency}</p>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-xs text-slate-600">
                            <p>Status: {mapShelterStatusForUi(row.status)}</p>
                            <p>Notes: {row.notes ? `${row.notes.slice(0, 100)}${row.notes.length > 100 ? "..." : ""}` : "No notes"}</p>
                          </div>
                          <div className="flex gap-2">
                            <button className="rounded border px-3 py-1 text-xs" onClick={() => router.push(`/restaurant/donation/${row.id}`)}>
                              View Details
                            </button>
                            {respondAction.canRespond ? (
                              <button className="rounded bg-emerald-800 px-3 py-1 text-xs text-white" onClick={() => router.push(`/restaurant/donation/${row.id}/confirm`)}>
                                {respondAction.label}
                              </button>
                            ) : (
                              <button className="cursor-not-allowed rounded border px-3 py-1 text-xs text-slate-500" disabled>
                                {respondAction.label}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mobile: Rich request card (template design) */}
                      <div className="md:hidden">
                        <div className="flex gap-3">
                          {/* Shelter avatar */}
                          <div className="h-14 w-14 shrink-0 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl">
                            🏠
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">{shelterNamesById[row.shelter_id] || "Shelter"}</p>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                  row.urgency === "high" ? "bg-red-100 text-red-800" :
                                  row.urgency === "medium" ? "bg-amber-100 text-amber-800" :
                                  "bg-green-100 text-green-800"
                                }`}>{row.urgency} urgency</span>
                              </div>
                              <span className="shrink-0 text-xs text-slate-500">{row.quantity || "-"} servings</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{row.city || "City"}, {row.state || "ST"} • Pickup: {row.pickup_window || "Not set"}</p>
                            <p className="mt-0.5 text-xs text-slate-600">{row.food_needed || "Not specified"}</p>
                          </div>
                        </div>
                        {/* Action buttons row */}
                        <div className="mt-2 flex gap-2 pl-[68px]">
                          <button
                            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                            onClick={() => router.push(`/restaurant/donation/${row.id}`)}
                          >
                            Details
                          </button>
                          {respondAction.canRespond ? (
                            <button className="rounded-full bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white" onClick={() => router.push(`/restaurant/donation/${row.id}/confirm`)}>
                              {respondAction.label}
                            </button>
                          ) : (
                            <span className="flex items-center text-xs text-slate-500">{respondAction.label}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </>
              )
            ) : (
              requestTab === "matched" ? (
                matchedRequests.length === 0 ? (
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
                )
              ) : completedRequests.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-600">No completed or closed matched requests yet.</p>
              ) : (
                completedRequests.map((row) => (
                  <div key={row.id} className="border-t border-slate-200 px-4 py-3 text-sm first:border-t-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-900">{row.title}</p>
                      <p className="text-slate-700">{mapShelterStatusForUi(row.status)}</p>
                    </div>
                    <p className="text-slate-600">Pickup window: {row.pickup_window || "Not set"}</p>
                    <button className="mt-2 rounded border px-3 py-1 text-xs" onClick={() => router.push(`/restaurant/donation/${row.id}`)}>
                      View Details
                    </button>
                  </div>
                ))
              )
            )}
          </section>
          ) : activeTab === "chats" ? (
            <section className="rounded-xl border border-slate-200 bg-white p-0 md:rounded">
              <div className="px-4 py-3 border-b border-slate-200">
                <p className="text-sm font-semibold text-slate-900">Matched Chats</p>
                <p className="text-xs text-slate-500">Conversations with shelters on matched requests</p>
              </div>
              {chatInboxItems.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-600">No active chats. Chats become available when a request is matched to your restaurant.</p>
              ) : (
                chatInboxItems.map((item) => (
                  <button
                    key={item.requestId}
                    className="flex w-full items-center gap-3 border-t border-slate-200 px-4 py-3 text-left first:border-t-0 hover:bg-slate-50 transition"
                    onClick={() => router.push(`/restaurant/chat/${item.requestId}`)}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg">
                      🏠
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">{item.partnerName}</p>
                        <p className="shrink-0 text-[10px] text-slate-400">{item.timestamp}</p>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{item.requestTitle}</p>
                      <p className="mt-0.5 text-xs text-slate-600 truncate">{item.preview}</p>
                    </div>
                  </button>
                ))
              )}
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
