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

type Tab = "open" | "matched" | "completed";
type ScreenTab = "requests" | "notifications";
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

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
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
      return { canRespond: false, label: "Awaiting shelter decision" };
    }

    if (myResponse.status === "accepted") {
      return { canRespond: false, label: "Response accepted" };
    }

    return { canRespond: false, label: "Request unavailable" };
  };

  const notifications = useMemo(() => {
    const items: NotificationItem[] = [];

    matchedRequests.forEach((row) => {
      const shelterName = shelterNamesById[row.shelter_id] || "Shelter";
      const ts = new Date(row.created_at).getTime();
      items.push({
        id: `matched-${row.id}`,
        title: "Request matched",
        message: `${row.title} is now matched with ${shelterName}.`,
        createdAt: new Date(row.created_at).toLocaleString(),
        sortAt: ts,
      });

      if (row.pickup_window) {
        items.push({
          id: `reminder-${row.id}`,
          title: "Delivery reminder",
          message: `${row.title} pickup window: ${row.pickup_window}.`,
          createdAt: new Date(row.created_at).toLocaleString(),
          sortAt: ts - 1,
        });
      }
    });

    completedRequests.forEach((row) => {
      const ts = new Date(row.created_at).getTime();
      items.push({
        id: `completed-${row.id}`,
        title: "Request closed",
        message: `${row.title} has moved to ${mapShelterStatusForUi(row.status)}.`,
        createdAt: new Date(row.created_at).toLocaleString(),
        sortAt: ts,
      });
    });

    chatInboxItems
      .filter((item) => item.lastSenderRole === "shelter")
      .forEach((item) => {
        items.push({
          id: `chat-${item.requestId}`,
          title: "New chat message",
          message: `${item.partnerName} sent a new message in ${item.requestTitle}.`,
          createdAt: new Date(item.createdAt).toLocaleString(),
          sortAt: new Date(item.createdAt).getTime(),
        });
      });

    return items.sort((a, b) => b.sortAt - a.sortAt);
  }, [matchedRequests, completedRequests, chatInboxItems, shelterNamesById]);

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
        activeId={activeTab}
        inboxAnchorId="requests"
        inboxLabel="Chats"
        inboxItems={chatInboxItems.map((item) => ({
          id: item.requestId,
          label: item.partnerName,
          preview: item.preview,
          timestamp: item.timestamp,
          onClick: () => router.push(`/restaurant/chat/${item.requestId}`),
        }))}
        inboxEmptyLabel="No active matched chats"
        items={[
          { id: "requests", label: "Requests", icon: "📋", onClick: () => setActiveTab("requests") },
          { id: "notifications", label: "Notifications", icon: "🔔", onClick: () => setActiveTab("notifications"), count: notifications.length },
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
              <h1 className="text-2xl font-semibold text-slate-900">{activeTab === "requests" ? "Restaurant Request Queue" : "Notifications"}</h1>
              <p className="text-sm text-slate-600">
                {activeTab === "requests"
                  ? "Browse open shelter requests and manage your response pipeline."
                  : "Track matching updates, reminders, and incoming chat activity."}
              </p>
            </div>
            {activeTab === "requests" ? (
              <div className="flex gap-2">
                <Button variant={requestTab === "open" ? "primary" : "secondary"} onClick={() => setRequestTab("open")}>Open Requests</Button>
                <Button variant={requestTab === "matched" ? "primary" : "secondary"} onClick={() => setRequestTab("matched")}>Matched</Button>
                <Button variant={requestTab === "completed" ? "primary" : "secondary"} onClick={() => setRequestTab("completed")}>Completed</Button>
              </div>
            ) : null}
          </div>

          {statusMsg ? <p className="mb-4 text-sm text-slate-700">{statusMsg}</p> : null}

          {activeTab === "requests" ? (
          <section className="rounded border border-slate-200 bg-white p-0">
            {loading ? (
              <p className="px-4 py-6 text-sm text-slate-600">Loading requests...</p>
            ) : requestTab === "open" ? (
              openRequests.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-600">No open requests available right now.</p>
              ) : (
                <>
                  <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-4 py-3 text-xs uppercase text-slate-500">
                    <p className="col-span-3">Request</p>
                    <p className="col-span-2">Shelter</p>
                    <p className="col-span-2">Servings</p>
                    <p className="col-span-2">Food Type</p>
                    <p className="col-span-2">Pickup</p>
                    <p className="col-span-1">Urgency</p>
                    <p className="col-span-12 text-[10px] text-slate-400">Includes open and responded requests, even if you already submitted a pending response.</p>
                  </div>
                  {openRequests.map((row) => (
                    <div key={row.id} className="border-t border-slate-200 px-4 py-3 text-sm">
                      {(() => {
                        const respondAction = getRespondAction(row);
                        return (
                          <>
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
                          </>
                        );
                      })()}
                    </div>
                  ))}
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
          ) : (
            <section className="rounded border border-slate-200 bg-white p-0">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-600">No notifications yet.</p>
              ) : (
                notifications.map((item) => (
                  <div key={item.id} className="border-t border-slate-200 px-4 py-3 first:border-t-0">
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-600">{item.message}</p>
                    <p className="text-xs text-slate-500">{item.createdAt}</p>
                  </div>
                ))
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
