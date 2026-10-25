"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  canEditCoreRequestFields,
  canEditPickupWindow,
  getCurrentUserRole,
  isShelterProfileComplete,
  mapShelterStatusForUi,
  ShelterRequestStatus,
} from "@/lib/flow";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileHeader, MobileBottomNav } from "@/components/ui/mobile-nav";
import { Button } from "@/components/ui/button";
import { OFFER_SELECT, OfferRow, OfferSummary } from "@/components/offers/offer-summary";
import { HANDSHAKE_SELECT, PickupHandshake } from "@/components/offers/pickup-handshake";
import { coordinatesFor, ensureProfileLocation, geocode } from "@/lib/geo";
import { CHAT_KINDS, REQUEST_KINDS, useNotifications } from "@/lib/notifications";
import { NotificationBell } from "@/components/ui/notification-bell";

type Tab = "requests" | "chats";
type RequestViewFilter = "active" | "all" | "open" | "matched" | "completed";

type RequestRow = {
  id: string;
  title: string;
  request_type: string | null;
  quantity: number | null;
  food_needed: string | null;
  food_restrictions: string | null;
  pickup_window: string | null;
  urgency: "low" | "medium" | "high";
  notes: string | null;
  coordination_notes: string | null;
  status: ShelterRequestStatus;
  created_at: string;
  matched_donation_id: string | null;
  shelter_contact_email: string | null;
  shelter_contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  restaurant_pickup_confirmed_at: string | null;
  shelter_pickup_confirmed_at: string | null;
  latitude: number | null;
};

type ResponseRow = {
  id: string;
  request_id: string;
  restaurant_id: string;
  donation_id: string | null;
  proposed_pickup_window: string | null;
  response_note: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  offer: OfferRow | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  organization_notes: string | null;
  latitude: number | null;
  longitude: number | null;
};

type NewRequestState = {
  title: string;
  requestType: string;
  quantity: string;
  foodNeeded: string;
  restrictions: string;
  pickupWindow: string;
  urgency: "low" | "medium" | "high";
  notes: string;
  useCustomContact: boolean;
  contactEmail: string;
  contactPhone: string;
  useCustomLocation: boolean;
  locationAddress: string;
  locationCity: string;
  locationState: string;
  locationZip: string;
};

type EditState = {
  requestId: string;
  title: string;
  requestType: string;
  quantity: string;
  foodNeeded: string;
  restrictions: string;
  pickupWindow: string;
  urgency: "low" | "medium" | "high";
  notes: string;
  contactEmail: string;
  contactPhone: string;
  locationAddress: string;
  locationCity: string;
  locationState: string;
  locationZip: string;
  coordinationNotes: string;
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

const initialRequestState: NewRequestState = {
  title: "",
  requestType: "",
  quantity: "",
  foodNeeded: "",
  restrictions: "",
  pickupWindow: "",
  urgency: "medium",
  notes: "",
  useCustomContact: false,
  contactEmail: "",
  contactPhone: "",
  useCustomLocation: false,
  locationAddress: "",
  locationCity: "",
  locationState: "",
  locationZip: "",
};

export default function ShelterHomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("requests");
  const [requestView, setRequestView] = useState<RequestViewFilter>("active");
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [responsesByRequest, setResponsesByRequest] = useState<Record<string, ResponseRow[]>>({});
  const [restaurantNames, setRestaurantNames] = useState<Record<string, string>>({});
  const [chatInboxItems, setChatInboxItems] = useState<ChatInboxItem[]>([]);
  const [newRequest, setNewRequest] = useState<NewRequestState>(initialRequestState);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const notifications = useNotifications(userId);
  const newRequestIds = notifications.unreadRequestIds(REQUEST_KINDS);
  const unreadChatIds = notifications.unreadRequestIds(CHAT_KINDS);
  const { markRead } = notifications;
  const hasUnreadRequestNews = newRequestIds.size > 0;

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
      router.push("/shelter/login");
      return;
    }

    const role = await getCurrentUserRole(user.id);
    if (role && role !== "shelter") {
      router.push("/restaurant/home");
      return;
    }

    const complete = await isShelterProfileComplete(user.id);
    if (!complete) {
      router.push("/shelter/register/details");
      return;
    }

    setUserId(user.id);

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id, name, email, phone, address, city, state, zip_code, organization_notes, latitude, longitude")
      .eq("id", user.id)
      .single();

    setProfile((profileRow as ProfileRow) || null);

    const requestSelect = `id, title, request_type, quantity, food_needed, food_restrictions, pickup_window, urgency, notes, coordination_notes, status, created_at, matched_donation_id, shelter_contact_email, shelter_contact_phone, address, city, state, zip_code, latitude, ${HANDSHAKE_SELECT}`;

    const { data: requestRows, error: requestError } = await supabase
      .from("shelter_requests")
      .select(requestSelect)
      .eq("shelter_id", user.id)
      .order("created_at", { ascending: false });

    if (requestError) {
      setStatusMsg(`Failed to load requests: ${requestError.message}`);
      setRequests([]);
      setResponsesByRequest({});
      setRestaurantNames({});
      setChatInboxItems([]);
      if (!silent) setLoading(false);
      return;
    }

    const parsedRequests = ((requestRows || []) as RequestRow[]).map((row) => ({
      ...row,
      request_type: row.request_type || null,
      shelter_contact_email: row.shelter_contact_email || null,
      shelter_contact_phone: row.shelter_contact_phone || null,
    }));
    setRequests(parsedRequests);
    if (!silent) void backfillLocations(user.id, profileRow as ProfileRow | null, parsedRequests);

    const requestIds = parsedRequests.map((row) => row.id);
    if (requestIds.length === 0) {
      setResponsesByRequest({});
      setRestaurantNames({});
      setChatInboxItems([]);
      if (!silent) setLoading(false);
      return;
    }

    const { data: responseRows } = await supabase
      .from("request_responses")
      .select(`id, request_id, restaurant_id, donation_id, proposed_pickup_window, response_note, status, created_at, offer:donations(${OFFER_SELECT})`)
      .in("request_id", requestIds)
      .order("created_at", { ascending: false });

    const parsedResponses = (responseRows || []) as ResponseRow[];
    const grouped: Record<string, ResponseRow[]> = {};
    parsedResponses.forEach((row) => {
      if (!grouped[row.request_id]) {
        grouped[row.request_id] = [];
      }
      grouped[row.request_id].push(row);
    });
    setResponsesByRequest(grouped);

    let names: Record<string, string> = {};
    const restaurantIds = Array.from(new Set(parsedResponses.map((row) => row.restaurant_id)));
    if (restaurantIds.length > 0) {
      const { data: restaurantProfiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", restaurantIds);

      (restaurantProfiles || []).forEach((row: any) => {
        names[row.id] = row.name || "Restaurant";
      });
    }
    setRestaurantNames(names);

    const matchedRequests = parsedRequests.filter((row) => row.status === "matched");
    if (matchedRequests.length === 0) {
      setChatInboxItems([]);
    } else {
      const matchedRequestIds = matchedRequests.map((row) => row.id);

      // Claimed listings have no accepted response, so resolve their restaurant through the matched donation.
      const restaurantByDonationId: Record<string, string> = {};
      const matchedDonationIds = matchedRequests.map((row) => row.matched_donation_id).filter((id): id is string => !!id);
      if (matchedDonationIds.length > 0) {
        const { data: donationRows } = await supabase.from("donations").select("id, restaurant_id").in("id", matchedDonationIds);
        (donationRows || []).forEach((row: { id: string; restaurant_id: string | null }) => {
          if (row.restaurant_id) restaurantByDonationId[row.id] = row.restaurant_id;
        });

        const missingIds = Array.from(new Set(Object.values(restaurantByDonationId))).filter((id) => !names[id]);
        if (missingIds.length > 0) {
          const { data: extraProfiles } = await supabase.from("profiles").select("id, name").in("id", missingIds);
          (extraProfiles || []).forEach((row: any) => {
            names[row.id] = row.name || "Restaurant";
          });
          setRestaurantNames({ ...names });
        }
      }
      const { data: chatRows } = await supabase
        .from("chat_messages")
        .select("request_id, sender_role, message, created_at")
        .in("request_id", matchedRequestIds)
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

      const inbox = matchedRequests
        .map((row) => {
          const acceptedResponse = (grouped[row.id] || []).find((item) => item.status === "accepted");
          const restaurantId = (row.matched_donation_id && restaurantByDonationId[row.matched_donation_id]) || acceptedResponse?.restaurant_id;
          const partnerName = restaurantId ? names[restaurantId] || "Restaurant" : "Restaurant";
          const latest = latestByRequestId[row.id];
          const fallbackTime = new Date(row.created_at).getTime();
          const latestTime = latest ? new Date(latest.created_at).getTime() : fallbackTime;
          const senderPrefix = latest ? (latest.sender_role === "shelter" ? "You" : partnerName) : "No messages";

          return {
            requestId: row.id,
            partnerName,
            requestTitle: row.title,
            lastSenderRole: latest ? latest.sender_role : null,
            preview: latest ? `${senderPrefix}: ${latest.message}` : "No messages yet. Open chat to coordinate pickup.",
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

  // Accounts and requests created before location support have no
  // coordinates; geocode them so restaurants can sort by distance.
  const backfillLocations = async (shelterId: string, profileRow: ProfileRow | null, rows: RequestRow[]) => {
    if (profileRow && profileRow.latitude == null) await ensureProfileLocation(shelterId);

    const supabase = getSupabaseClient();
    const missing = rows.filter((row) => (row.status === "open" || row.status === "responded") && row.latitude == null && (row.address || row.zip_code));
    for (const row of missing) {
      const located = await geocode({ address: row.address, city: row.city, state: row.state, zip: row.zip_code });
      if (located) {
        await supabase.from("shelter_requests").update({ latitude: located.latitude, longitude: located.longitude }).eq("id", row.id);
      }
    }
  };

  // Request news is "seen" once the Requests list has been on screen for a
  // few seconds; rows keep their "New" tag until then.
  useEffect(() => {
    if (activeTab !== "requests" || loading || !hasUnreadRequestNews) return;
    const timer = setTimeout(() => void markRead(null, REQUEST_KINDS), 4000);
    return () => clearTimeout(timer);
  }, [activeTab, loading, hasUnreadRequestNews, markRead]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "chats") setActiveTab("chats");
    void loadDashboard().then(() => {
      if (params.get("claimed")) {
        setStatusMsg("Listing claimed. It's in your Matched requests below: open the chat to arrange pickup, then confirm when you've received the food.");
      }
    });

    const timer = setInterval(() => {
      void loadDashboard(true);
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("shelter-home-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        void loadDashboard(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "shelter_requests" }, () => {
        void loadDashboard(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "request_responses" }, () => {
        void loadDashboard(true);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!userId || !profile) {
      setStatusMsg("Missing shelter profile data.");
      return;
    }

    if (!newRequest.title || !newRequest.requestType || !newRequest.quantity || !newRequest.pickupWindow) {
      setStatusMsg("Request title, request type, quantity, and pickup window are required.");
      return;
    }

    const quantity = Number.parseInt(newRequest.quantity, 10);
    const parsedQuantity = Number.isNaN(quantity) ? null : quantity;
    if (!parsedQuantity || parsedQuantity <= 0) {
      setStatusMsg("Servings needed must be a positive number.");
      return;
    }

    const resolvedContactEmail = newRequest.useCustomContact
      ? newRequest.contactEmail || null
      : profile.email || null;
    const resolvedContactPhone = newRequest.useCustomContact
      ? newRequest.contactPhone || null
      : profile.phone || null;
    const resolvedAddress = newRequest.useCustomLocation
      ? newRequest.locationAddress || null
      : profile.address || null;
    const resolvedCity = newRequest.useCustomLocation ? newRequest.locationCity || null : profile.city || null;
    const resolvedState = newRequest.useCustomLocation
      ? newRequest.locationState || null
      : profile.state || null;
    const resolvedZip = newRequest.useCustomLocation ? newRequest.locationZip || null : profile.zip_code || null;
    const coordinates = await coordinatesFor(
      newRequest.useCustomLocation,
      { address: resolvedAddress, city: resolvedCity, state: resolvedState, zip: resolvedZip },
      profile
    );

    const supabase = getSupabaseClient();
    const { error } = await supabase.from("shelter_requests").insert([
      {
        shelter_id: userId,
        title: newRequest.title,
        request_type: newRequest.requestType,
        quantity: parsedQuantity,
        food_needed: newRequest.foodNeeded || newRequest.title,
        food_restrictions: newRequest.restrictions || null,
        pickup_window: newRequest.pickupWindow,
        urgency: newRequest.urgency,
        notes: newRequest.notes || null,
        shelter_contact_email: resolvedContactEmail,
        shelter_contact_phone: resolvedContactPhone,
        address: resolvedAddress,
        city: resolvedCity,
        state: resolvedState,
        zip_code: resolvedZip,
        ...coordinates,
        status: "open",
      },
    ]);

    if (error) {
      setStatusMsg(`Failed to create request: ${error.message}`);
      return;
    }

    setNewRequest(initialRequestState);
    await loadDashboard();
    setStatusMsg("Request created.");
  };

  const startEdit = (row: RequestRow) => {
    setEditState({
      requestId: row.id,
      title: row.title,
      requestType: row.request_type || "",
      quantity: row.quantity ? String(row.quantity) : "",
      foodNeeded: row.food_needed || "",
      restrictions: row.food_restrictions || "",
      pickupWindow: row.pickup_window || "",
      urgency: row.urgency || "medium",
      notes: row.notes || "",
      contactEmail: row.shelter_contact_email || profile?.email || "",
      contactPhone: row.shelter_contact_phone || profile?.phone || "",
      locationAddress: row.address || profile?.address || "",
      locationCity: row.city || profile?.city || "",
      locationState: row.state || profile?.state || "",
      locationZip: row.zip_code || profile?.zip_code || "",
      coordinationNotes: row.coordination_notes || "",
    });
  };

  const saveEdit = async () => {
    if (!editState) return;

    const row = requests.find((item) => item.id === editState.requestId);
    if (!row) return;

    const supabase = getSupabaseClient();

    if (canEditCoreRequestFields(row.status)) {
      const quantity = Number.parseInt(editState.quantity, 10);
      const parsedQuantity = Number.isNaN(quantity) ? null : quantity;
      const locationChanged =
        (editState.locationAddress || null) !== row.address ||
        (editState.locationCity || null) !== row.city ||
        (editState.locationState || null) !== row.state ||
        (editState.locationZip || null) !== row.zip_code;
      const located = locationChanged
        ? await geocode({ address: editState.locationAddress, city: editState.locationCity, state: editState.locationState, zip: editState.locationZip })
        : null;

      const { error } = await supabase
        .from("shelter_requests")
        .update({
          title: editState.title,
          request_type: editState.requestType || null,
          quantity: parsedQuantity,
          food_needed: editState.foodNeeded || editState.title,
          food_restrictions: editState.restrictions || null,
          pickup_window: editState.pickupWindow,
          urgency: editState.urgency,
          notes: editState.notes || null,
          shelter_contact_email: editState.contactEmail || null,
          shelter_contact_phone: editState.contactPhone || null,
          address: editState.locationAddress || null,
          city: editState.locationCity || null,
          state: editState.locationState || null,
          zip_code: editState.locationZip || null,
          ...(locationChanged ? { latitude: located?.latitude ?? null, longitude: located?.longitude ?? null } : {}),
        })
        .eq("id", row.id)
        .eq("status", "open");

      if (error) {
        setStatusMsg(`Failed to update request: ${error.message}`);
        return;
      }
    } else if (canEditPickupWindow(row.status)) {
      const { error } = await supabase
        .from("shelter_requests")
        .update({
          pickup_window: editState.pickupWindow,
          coordination_notes: editState.coordinationNotes || null,
        })
        .eq("id", row.id)
        .in("status", ["responded", "matched"]);

      if (error) {
        setStatusMsg(`Failed to update coordination details: ${error.message}`);
        return;
      }
    }

    setEditState(null);
    await loadDashboard();
    setStatusMsg("Request updated.");
  };

  const updateRequestStatus = async (requestId: string, nextStatus: "cancelled") => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("cancel_request", {
      p_request_id: requestId,
    });

    if (error) {
      setStatusMsg(`Failed to update status: ${error.message}`);
      return;
    }

    await loadDashboard();
    setStatusMsg(`Request marked ${nextStatus}.`);
  };

  const acceptResponse = async (request: RequestRow, response: ResponseRow) => {
    if (!userId) return;

    const supabase = getSupabaseClient();

    const { error } = await supabase.rpc("accept_request_response", {
      p_request_id: request.id,
      p_response_id: response.id,
    });

    if (error) {
      setStatusMsg(`Failed to accept response: ${error.message}`);
      return;
    }

    await loadDashboard();
    setStatusMsg("Response accepted and request matched.");
  };

  const activeRequests = useMemo(
    () => requests.filter((row) => row.status === "open" || row.status === "responded" || row.status === "matched"),
    [requests]
  );

  const visibleRequests = useMemo(() => {
    if (requestView === "active") return activeRequests;
    if (requestView === "open") return requests.filter((r) => r.status === "open" || r.status === "responded");
    if (requestView === "matched") return requests.filter((r) => r.status === "matched");
    if (requestView === "completed") return requests.filter((r) => r.status === "completed" || r.status === "cancelled");
    return requests;
  }, [activeRequests, requestView, requests]);

  const getResponseState = (row: RequestRow): string => {
    const responses = responsesByRequest[row.id] || [];
    const pendingCount = responses.filter((item) => item.status === "pending").length;
    const acceptedCount = responses.filter((item) => item.status === "accepted").length;

    if (row.status === "matched") {
      return "Matched";
    }
    if (row.status === "responded") {
      return pendingCount > 0 ? `${pendingCount} pending response${pendingCount > 1 ? "s" : ""}` : "Response received";
    }
    if (row.status === "open") {
      return pendingCount > 0 ? `${pendingCount} pending response${pendingCount > 1 ? "s" : ""}` : "Awaiting responses";
    }
    if (row.status === "cancelled") {
      return "Cancelled";
    }
    return "Completed";
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/");
  };

  const navItems = [
    { id: "requests", label: "Requests", icon: "📋", onClick: () => setActiveTab("requests"), count: notifications.countOf(REQUEST_KINDS) },
    { id: "chats", label: "Chats", icon: "💬", onClick: () => setActiveTab("chats"), count: notifications.countOf(CHAT_KINDS) },
    { id: "listings", label: "Available Food", icon: "🥡", onClick: () => router.push("/shelter/listings") },
    { id: "profile", label: "Profile", icon: "👤", onClick: () => router.push("/shelter/profile") },
    { id: "settings", label: "Settings", icon: "⚙️", onClick: () => router.push("/shelter/settings") },
    { id: "signout", label: "Sign Out", icon: "🚪", onClick: () => void handleSignOut() },
  ];

  const bell = (
    <NotificationBell
      role="shelter"
      items={notifications.items}
      unreadCount={notifications.unread.length}
      onMarkRead={(requestId) => markRead(requestId ?? null)}
    />
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <MobileHeader
        title="Plate Share"
        subtitle="Shelter Operations"
        action={bell}
      />
      <Sidebar
        title="Plate Share"
        subtitle="Shelter Operations"
        items={navItems}
        activeId={activeTab}
        headerAction={bell}
      />
      <MobileBottomNav items={navItems} activeId={activeTab} />

      <main className="min-w-0 flex-1 px-4 pt-[72px] pb-20 md:px-6 md:py-6 md:pt-6 md:pb-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4">
            <h1 className="text-lg font-semibold text-slate-900 md:text-2xl">
              {activeTab === "chats" ? "Chats" : "Shelter Request Management"}
            </h1>
            <p className="text-xs text-slate-600 md:text-sm">
              {activeTab === "chats"
                ? "Conversations with restaurants on matched requests."
                : "Create requests, review responses, and manage fulfillment."}
            </p>
          </div>

          {statusMsg ? <p className="mb-4 text-sm text-slate-700">{statusMsg}</p> : null}

          {activeTab === "requests" ? (
            <div className="flex flex-col gap-4 md:grid md:grid-cols-12">
              {/* Mobile: Tappable stats tiles + create */}
              <div className="md:hidden space-y-3">
                {/* Tappable stats tiles */}
                <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => setRequestView("open")} className={`rounded-xl p-3 text-center transition ${requestView === "open" ? "border-2 border-emerald-600 bg-emerald-50" : "border border-slate-200 bg-white"}`}>
                    <p className={`text-2xl font-bold ${requestView === "open" ? "text-emerald-700" : "text-slate-900"}`}>{requests.filter((r) => r.status === "open" || r.status === "responded").length}</p>
                    <p className="text-[11px] text-slate-500">Open<br />Requests</p>
                  </button>
                  <button onClick={() => setRequestView("matched")} className={`rounded-xl p-3 text-center transition ${requestView === "matched" ? "border-2 border-emerald-600 bg-emerald-50" : "border border-slate-200 bg-white"}`}>
                    <p className={`text-2xl font-bold ${requestView === "matched" ? "text-emerald-700" : "text-slate-900"}`}>{requests.filter((r) => r.status === "matched").length}</p>
                    <p className="text-[11px] text-slate-500">Matched</p>
                  </button>
                  <button onClick={() => setRequestView("completed")} className={`rounded-xl p-3 text-center transition ${requestView === "completed" ? "border-2 border-emerald-600 bg-emerald-50" : "border border-slate-200 bg-white"}`}>
                    <p className={`text-2xl font-bold ${requestView === "completed" ? "text-emerald-700" : "text-slate-900"}`}>{requests.filter((r) => r.status === "completed" || r.status === "cancelled").length}</p>
                    <p className="text-[11px] text-slate-500">Completed</p>
                  </button>
                </div>

                {/* Section heading with create button */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Your Requests</p>
                  <button className="rounded-full bg-emerald-800 px-4 py-2 text-xs font-semibold text-white" onClick={() => setShowCreateForm(true)}>+ Create</button>
                </div>
              </div>

              {/* Mobile: Create Request overlay */}
              {showCreateForm ? (
                <div className="fixed inset-0 z-50 md:hidden">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateForm(false)} />
                  <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-medium text-slate-900">Create New Request</h2>
                      <button className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100" onClick={() => setShowCreateForm(false)}>Close</button>
                    </div>
                    <form onSubmit={(e) => { handleCreateRequest(e); setShowCreateForm(false); }} className="space-y-3">
                      <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Request title" value={newRequest.title} onChange={(e) => setNewRequest((prev) => ({ ...prev, title: e.target.value }))} />
                      <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Request type (Meal kits, Produce, Ready-to-eat)" value={newRequest.requestType} onChange={(e) => setNewRequest((prev) => ({ ...prev, requestType: e.target.value }))} />
                      <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Servings needed" value={newRequest.quantity} onChange={(e) => setNewRequest((prev) => ({ ...prev, quantity: e.target.value }))} />
                      <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Food types requested" value={newRequest.foodNeeded} onChange={(e) => setNewRequest((prev) => ({ ...prev, foodNeeded: e.target.value }))} />
                      <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Food restrictions" value={newRequest.restrictions} onChange={(e) => setNewRequest((prev) => ({ ...prev, restrictions: e.target.value }))} />
                      <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Pickup window" value={newRequest.pickupWindow} onChange={(e) => setNewRequest((prev) => ({ ...prev, pickupWindow: e.target.value }))} />
                      <select className="h-10 w-full rounded border border-slate-300 px-3 text-sm" value={newRequest.urgency} onChange={(e) => setNewRequest((prev) => ({ ...prev, urgency: e.target.value as "low" | "medium" | "high" }))}>
                        <option value="low">Low urgency</option>
                        <option value="medium">Medium urgency</option>
                        <option value="high">High urgency</option>
                      </select>
                      <textarea className="w-full rounded border border-slate-300 px-3 py-2 text-sm" rows={3} placeholder="Notes" value={newRequest.notes} onChange={(e) => setNewRequest((prev) => ({ ...prev, notes: e.target.value }))} />
                      <Button type="submit" variant="primary" className="w-full">Post Request</Button>
                    </form>
                  </div>
                </div>
              ) : null}

              {/* Desktop: Always-visible create form */}
              <section className="hidden md:block col-span-12 rounded border border-slate-200 bg-white p-4 lg:col-span-4">
                <h2 className="mb-3 text-sm font-medium text-slate-900">Create New Request</h2>
                <form onSubmit={handleCreateRequest} className="space-y-3">
                  <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Request title" value={newRequest.title} onChange={(e) => setNewRequest((prev) => ({ ...prev, title: e.target.value }))} />
                  <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Request type (Meal kits, Produce, Ready-to-eat)" value={newRequest.requestType} onChange={(e) => setNewRequest((prev) => ({ ...prev, requestType: e.target.value }))} />
                  <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Servings needed" value={newRequest.quantity} onChange={(e) => setNewRequest((prev) => ({ ...prev, quantity: e.target.value }))} />
                  <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Food types requested" value={newRequest.foodNeeded} onChange={(e) => setNewRequest((prev) => ({ ...prev, foodNeeded: e.target.value }))} />
                  <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Food restrictions" value={newRequest.restrictions} onChange={(e) => setNewRequest((prev) => ({ ...prev, restrictions: e.target.value }))} />
                  <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Pickup window" value={newRequest.pickupWindow} onChange={(e) => setNewRequest((prev) => ({ ...prev, pickupWindow: e.target.value }))} />
                  <select className="h-10 w-full rounded border border-slate-300 px-3 text-sm" value={newRequest.urgency} onChange={(e) => setNewRequest((prev) => ({ ...prev, urgency: e.target.value as "low" | "medium" | "high" }))}>
                    <option value="low">Low urgency</option>
                    <option value="medium">Medium urgency</option>
                    <option value="high">High urgency</option>
                  </select>
                  <textarea className="w-full rounded border border-slate-300 px-3 py-2 text-sm" rows={3} placeholder="Notes" value={newRequest.notes} onChange={(e) => setNewRequest((prev) => ({ ...prev, notes: e.target.value }))} />

                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={newRequest.useCustomContact} onChange={(e) => setNewRequest((prev) => ({ ...prev, useCustomContact: e.target.checked }))} />
                    Override contact details for this request
                  </label>
                  {newRequest.useCustomContact ? (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <input className="h-9 rounded border border-slate-300 px-2 text-sm" placeholder="Contact email" value={newRequest.contactEmail} onChange={(e) => setNewRequest((prev) => ({ ...prev, contactEmail: e.target.value }))} />
                      <input className="h-9 rounded border border-slate-300 px-2 text-sm" placeholder="Contact phone" value={newRequest.contactPhone} onChange={(e) => setNewRequest((prev) => ({ ...prev, contactPhone: e.target.value }))} />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Using shelter profile contact: {profile?.email || "-"} / {profile?.phone || "-"}</p>
                  )}

                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={newRequest.useCustomLocation} onChange={(e) => setNewRequest((prev) => ({ ...prev, useCustomLocation: e.target.checked }))} />
                    Override pickup location for this request
                  </label>
                  {newRequest.useCustomLocation ? (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <input className="h-9 rounded border border-slate-300 px-2 text-sm md:col-span-2" placeholder="Address" value={newRequest.locationAddress} onChange={(e) => setNewRequest((prev) => ({ ...prev, locationAddress: e.target.value }))} />
                      <input className="h-9 rounded border border-slate-300 px-2 text-sm" placeholder="City" value={newRequest.locationCity} onChange={(e) => setNewRequest((prev) => ({ ...prev, locationCity: e.target.value }))} />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="h-9 rounded border border-slate-300 px-2 text-sm" placeholder="State" value={newRequest.locationState} onChange={(e) => setNewRequest((prev) => ({ ...prev, locationState: e.target.value }))} />
                        <input className="h-9 rounded border border-slate-300 px-2 text-sm" placeholder="ZIP" value={newRequest.locationZip} onChange={(e) => setNewRequest((prev) => ({ ...prev, locationZip: e.target.value }))} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Using shelter profile location: {profile?.address || "-"}</p>
                  )}

                  <Button type="submit" variant="primary" className="w-full">Post Request</Button>
                </form>
              </section>

              <section className="col-span-12 rounded-xl border border-slate-200 bg-white p-0 lg:col-span-8 md:rounded">
                <div className="hidden md:flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <p className="text-sm font-medium text-slate-800">Requests</p>
                  <div className="flex items-center gap-2">
                    {([
                      ["active", "Active", activeRequests.length],
                      ["open", "Open", requests.filter((r) => r.status === "open" || r.status === "responded").length],
                      ["matched", "Matched", requests.filter((r) => r.status === "matched").length],
                      ["completed", "Closed", requests.filter((r) => r.status === "completed" || r.status === "cancelled").length],
                      ["all", "All", requests.length],
                    ] as const).map(([view, label, count]) => (
                      <Button key={view} size="sm" variant={requestView === view ? "primary" : "secondary"} onClick={() => setRequestView(view)}>
                        {label} ({count})
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="hidden md:grid grid-cols-12 gap-2 border-b border-slate-200 px-4 py-3 text-xs uppercase text-slate-500">
                  <p className="col-span-3">Request</p>
                  <p className="col-span-1">Urgency</p>
                  <p className="col-span-2">Pickup</p>
                  <p className="col-span-2">Status</p>
                  <p className="col-span-2">Response State</p>
                  <p className="col-span-2 text-right">Actions</p>
                </div>

                {loading ? (
                  <p className="px-4 py-6 text-sm text-slate-600">Loading requests...</p>
                ) : visibleRequests.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-600">
                    {requestView === "active" ? "No active requests right now." : requests.length === 0 ? "No requests yet. Create your first request." : "No requests in this view."}
                  </p>
                ) : (
                  visibleRequests.map((row) => {
                    const responses = responsesByRequest[row.id] || [];
                    const pendingResponses = responses.filter((item) => item.status === "pending");
                    const acceptedResponse = responses.find((item) => item.status === "accepted");
                    const isEditing = editState?.requestId === row.id;
                    const hasPendingResponses = pendingResponses.length > 0 && (row.status === "open" || row.status === "responded");
                    const responseState = getResponseState(row);

                    return (
                      <div key={row.id} className="border-t border-slate-200 px-3 py-3 text-sm md:px-4">
                        {/* Desktop table row */}
                        <div className="hidden md:block">
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-3">
                              <p className="font-medium text-slate-900">
                                {row.title}
                                {newRequestIds.has(row.id) ? <span className="ml-2 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">New</span> : null}
                              </p>
                              <p className="text-xs text-slate-500">{row.request_type || "General request"} • {row.quantity || "-"} servings</p>
                            </div>
                            <p className="col-span-1 capitalize text-slate-700">{row.urgency}</p>
                            <p className="col-span-2 text-slate-700">{row.pickup_window || "-"}</p>
                            <p className="col-span-2 text-slate-700">{mapShelterStatusForUi(row.status)}</p>
                            <div className="col-span-4">
                              <span
                                className={`inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-xs font-medium ${
                                  hasPendingResponses
                                    ? "border-slate-300 bg-slate-100 text-slate-700"
                                    : row.status === "matched"
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                      : "border-slate-300 bg-slate-50 text-slate-700"
                                }`}
                              >
                                {responseState}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex justify-end gap-2">
                            {(canEditCoreRequestFields(row.status) || canEditPickupWindow(row.status)) && (
                              <Button size="sm" variant="secondary" onClick={() => startEdit(row)}>Edit</Button>
                            )}
                            {row.status === "open" || row.status === "responded" ? (
                              <Button size="sm" variant="danger" onClick={() => void updateRequestStatus(row.id, "cancelled")}>Cancel</Button>
                            ) : null}
                          </div>
                        </div>

                        {/* Mobile: Rich request card */}
                        <div className="md:hidden">
                          <div className="flex gap-3">
                            {/* Request icon */}
                            <div className="h-14 w-14 shrink-0 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl">
                              🍽️
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate">
                                    {newRequestIds.has(row.id) ? <span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-600" /> : null}
                                    {row.title}
                                  </p>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                    row.status === "matched" ? "bg-emerald-100 text-emerald-800" :
                                    row.status === "completed" ? "bg-blue-100 text-blue-800" :
                                    row.status === "cancelled" ? "bg-slate-100 text-slate-600" :
                                    "bg-amber-100 text-amber-800"
                                  }`}>{mapShelterStatusForUi(row.status)}</span>
                                </div>
                                <span className="shrink-0 text-xs text-slate-500">{row.quantity || "-"} servings</span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">{row.request_type || "General"} • Pickup: {row.pickup_window || "-"}</p>
                              <p className="mt-0.5 text-xs text-slate-600">{responseState}</p>
                            </div>
                          </div>
                          {/* Action buttons row */}
                          <div className="mt-2 flex gap-2 pl-[68px]">
                            {(canEditCoreRequestFields(row.status) || canEditPickupWindow(row.status)) && (
                              <button className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700" onClick={() => startEdit(row)}>Edit</button>
                            )}
                            {row.status === "open" || row.status === "responded" ? (
                              <button className="rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700" onClick={() => void updateRequestStatus(row.id, "cancelled")}>Cancel</button>
                            ) : null}
                            {row.status === "completed" ? (
                              <span className="flex items-center text-xs text-emerald-700 font-medium">Delivered ✓</span>
                            ) : null}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                            {canEditCoreRequestFields(row.status) ? (
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.title} onChange={(e) => setEditState((prev) => (prev ? { ...prev, title: e.target.value } : prev))} placeholder="Title" />
                                <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.requestType} onChange={(e) => setEditState((prev) => (prev ? { ...prev, requestType: e.target.value } : prev))} placeholder="Request type" />
                                <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.quantity} onChange={(e) => setEditState((prev) => (prev ? { ...prev, quantity: e.target.value } : prev))} placeholder="Servings" />
                                <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.foodNeeded} onChange={(e) => setEditState((prev) => (prev ? { ...prev, foodNeeded: e.target.value } : prev))} placeholder="Food requested" />
                                <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.restrictions} onChange={(e) => setEditState((prev) => (prev ? { ...prev, restrictions: e.target.value } : prev))} placeholder="Restrictions" />
                                <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.pickupWindow} onChange={(e) => setEditState((prev) => (prev ? { ...prev, pickupWindow: e.target.value } : prev))} placeholder="Pickup window" />
                                <select className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.urgency} onChange={(e) => setEditState((prev) => (prev ? { ...prev, urgency: e.target.value as "low" | "medium" | "high" } : prev))}>
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                </select>
                                <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.contactEmail} onChange={(e) => setEditState((prev) => (prev ? { ...prev, contactEmail: e.target.value } : prev))} placeholder="Contact email" />
                                <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.contactPhone} onChange={(e) => setEditState((prev) => (prev ? { ...prev, contactPhone: e.target.value } : prev))} placeholder="Contact phone" />
                                <input className="h-9 rounded border border-slate-300 px-2 text-sm md:col-span-2" value={editState.locationAddress} onChange={(e) => setEditState((prev) => (prev ? { ...prev, locationAddress: e.target.value } : prev))} placeholder="Address" />
                                <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.locationCity} onChange={(e) => setEditState((prev) => (prev ? { ...prev, locationCity: e.target.value } : prev))} placeholder="City" />
                                <div className="grid grid-cols-2 gap-2">
                                  <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.locationState} onChange={(e) => setEditState((prev) => (prev ? { ...prev, locationState: e.target.value } : prev))} placeholder="State" />
                                  <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.locationZip} onChange={(e) => setEditState((prev) => (prev ? { ...prev, locationZip: e.target.value } : prev))} placeholder="ZIP" />
                                </div>
                                <textarea className="rounded border border-slate-300 px-2 py-1 text-sm md:col-span-2" rows={2} value={editState.notes} onChange={(e) => setEditState((prev) => (prev ? { ...prev, notes: e.target.value } : prev))} placeholder="Notes" />
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.pickupWindow} onChange={(e) => setEditState((prev) => (prev ? { ...prev, pickupWindow: e.target.value } : prev))} placeholder="Updated pickup window" />
                                <textarea className="rounded border border-slate-300 px-2 py-1 text-sm" rows={2} value={editState.coordinationNotes} onChange={(e) => setEditState((prev) => (prev ? { ...prev, coordinationNotes: e.target.value } : prev))} placeholder="Coordination notes" />
                              </div>
                            )}
                            <div className="mt-2 flex gap-2">
                              <Button size="sm" variant="primary" onClick={() => void saveEdit()}>Save</Button>
                              <Button size="sm" variant="secondary" onClick={() => setEditState(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : null}

                        {hasPendingResponses ? (
                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Pending Restaurant Responses</p>
                              <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                {pendingResponses.length} waiting
                              </span>
                            </div>
                            <div className="space-y-2">
                              {pendingResponses.map((response) => (
                                <div key={response.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-900">{restaurantNames[response.restaurant_id] || "Restaurant"}</p>
                                    <p className="text-xs text-slate-600">Proposed pickup: {response.proposed_pickup_window || "Not provided"}</p>
                                    <OfferSummary offer={response.offer} />
                                    {response.response_note ? <p className="text-xs text-slate-500">{response.response_note}</p> : null}
                                  </div>
                                  <Button size="sm" variant="primary" onClick={() => void acceptResponse(row, response)}>Accept</Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {acceptedResponse && row.status === "matched" ? (
                          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="mb-1 inline-flex rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                                  Matched Response
                                </div>
                                <p className="text-sm font-medium text-slate-900">
                                  {restaurantNames[acceptedResponse.restaurant_id] || "Restaurant"}
                                </p>
                                <p className="text-xs text-slate-700">
                                  Confirmed pickup: {acceptedResponse.proposed_pickup_window || row.pickup_window || "Not set"}
                                </p>
                                <OfferSummary offer={acceptedResponse.offer} />
                              </div>
                              <Button size="sm" variant="secondary" onClick={() => router.push(`/shelter/chat/${row.id}`)}>Open Chat</Button>
                            </div>
                            <div className="mt-2">
                              <PickupHandshake
                                requestId={row.id}
                                role="shelter"
                                restaurantConfirmedAt={row.restaurant_pickup_confirmed_at}
                                shelterConfirmedAt={row.shelter_pickup_confirmed_at}
                                onChange={async (message) => {
                                  await loadDashboard();
                                  setStatusMsg(message);
                                }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </section>
            </div>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white p-0 md:rounded">
              <div className="px-4 py-3 border-b border-slate-200">
                <p className="text-sm font-semibold text-slate-900">Matched Chats</p>
                <p className="text-xs text-slate-500">Conversations with restaurants on matched requests</p>
              </div>
              {chatInboxItems.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-600">No active chats. Chats become available when a request is matched to a restaurant.</p>
              ) : (
                chatInboxItems.map((item) => (
                  <button
                    key={item.requestId}
                    className="flex w-full items-center gap-3 border-t border-slate-200 px-4 py-3 text-left first:border-t-0 hover:bg-slate-50 transition"
                    onClick={() => router.push(`/shelter/chat/${item.requestId}`)}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg">
                      🍽️
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate text-slate-900 ${unreadChatIds.has(item.requestId) ? "font-bold" : "font-semibold"}`}>
                          {unreadChatIds.has(item.requestId) ? <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-rose-600" /> : null}
                          {item.partnerName}
                        </p>
                        <p className="shrink-0 text-[10px] text-slate-400">{item.timestamp}</p>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{item.requestTitle}</p>
                      <p className="mt-0.5 text-xs text-slate-600 truncate">{item.preview}</p>
                    </div>
                  </button>
                ))
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
