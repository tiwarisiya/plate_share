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

type Tab = "requests" | "chats" | "settings";
type RequestViewFilter = "active" | "all" | "open" | "matched" | "completed";

type SettingsTab = "account" | "location" | "security";

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

function isMissingShelterRequestsColumnError(
  error: { code?: string; message?: string } | null,
  column: string
): boolean {
  if (!error) return false;

  if (error.code === "42703") return true;

  // PostgREST can return schema cache misses as PGRST204 instead of SQL 42703.
  if (error.code !== "PGRST204") return false;

  const message = (error.message || "").toLowerCase();
  return message.includes("schema cache") && message.includes(`'${column.toLowerCase()}'`);
}

export default function ShelterHomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("requests");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("account");
  const [requestView, setRequestView] = useState<RequestViewFilter>("open");
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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

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
      .select("id, name, email, phone, address, city, state, zip_code, organization_notes")
      .eq("id", user.id)
      .single();

    if (profileRow) {
      setProfile(profileRow as ProfileRow);
      setName(profileRow.name || "");
      setPhone(profileRow.phone || "");
      setEmail(profileRow.email || user.email || "");
      setAddress(profileRow.address || "");
      setCity(profileRow.city || "");
      setState(profileRow.state || "");
      setZip(profileRow.zip_code || "");
    } else {
      setEmail(user.email || "");
    }

    const requestSelect =
      "id, title, request_type, quantity, food_needed, food_restrictions, pickup_window, urgency, notes, coordination_notes, status, created_at, matched_donation_id, shelter_contact_email, shelter_contact_phone, address, city, state, zip_code";

    let requestRows: any[] | null = null;
    let requestError: { code?: string; message: string } | null = null;

    const withRequestType = await supabase
      .from("shelter_requests")
      .select(requestSelect)
      .eq("shelter_id", user.id)
      .order("created_at", { ascending: false });

    requestRows = withRequestType.data;
    requestError = withRequestType.error;

    if (isMissingShelterRequestsColumnError(requestError, "request_type")) {
      const withoutRequestType = await supabase
        .from("shelter_requests")
        .select(
          "id, title, quantity, food_needed, food_restrictions, pickup_window, urgency, notes, coordination_notes, status, created_at, matched_donation_id, shelter_contact_email, shelter_contact_phone, address, city, state, zip_code"
        )
        .eq("shelter_id", user.id)
        .order("created_at", { ascending: false });

      requestRows = withoutRequestType.data;
      requestError = withoutRequestType.error;

      if (
        isMissingShelterRequestsColumnError(requestError, "shelter_contact_email") ||
        isMissingShelterRequestsColumnError(requestError, "shelter_contact_phone")
      ) {
        const legacyWithoutSnapshot = await supabase
          .from("shelter_requests")
          .select(
            "id, title, quantity, food_needed, food_restrictions, pickup_window, urgency, notes, coordination_notes, status, created_at, matched_donation_id, address, city, state, zip_code"
          )
          .eq("shelter_id", user.id)
          .order("created_at", { ascending: false });

        requestRows = legacyWithoutSnapshot.data;
        requestError = legacyWithoutSnapshot.error;
      }
    }

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
      .select("id, request_id, restaurant_id, donation_id, proposed_pickup_window, response_note, status, created_at")
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
          const partnerName = acceptedResponse ? names[acceptedResponse.restaurant_id] || "Restaurant" : "Restaurant";
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

    const supabase = getSupabaseClient();
    const insertWithSnapshot = await supabase.from("shelter_requests").insert([
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
        status: "open",
      },
    ]);

    let error = insertWithSnapshot.error;
    if (isMissingShelterRequestsColumnError(error, "request_type")) {
      const withoutRequestType = await supabase.from("shelter_requests").insert([
        {
          shelter_id: userId,
          title: newRequest.title,
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
          status: "open",
        },
      ]);
      error = withoutRequestType.error;
    }

    if (
      isMissingShelterRequestsColumnError(error, "shelter_contact_email") ||
      isMissingShelterRequestsColumnError(error, "shelter_contact_phone")
    ) {
      const legacyInsert = await supabase.from("shelter_requests").insert([
        {
          shelter_id: userId,
          title: newRequest.title,
          quantity: parsedQuantity,
          food_needed: newRequest.foodNeeded || newRequest.title,
          food_restrictions: newRequest.restrictions || null,
          pickup_window: newRequest.pickupWindow,
          urgency: newRequest.urgency,
          notes: newRequest.notes || null,
          address: resolvedAddress,
          city: resolvedCity,
          state: resolvedState,
          zip_code: resolvedZip,
          status: "open",
        },
      ]);
      error = legacyInsert.error;
    }

    if (error) {
      setStatusMsg(`Failed to create request: ${error.message}`);
      return;
    }

    setNewRequest(initialRequestState);
    setStatusMsg("Request created.");
    await loadDashboard();
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
        })
        .eq("id", row.id)
        .eq("status", "open");

      if (error) {
        if (isMissingShelterRequestsColumnError(error, "request_type")) {
          const legacyUpdate = await supabase
            .from("shelter_requests")
            .update({
              title: editState.title,
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
            })
            .eq("id", row.id)
            .eq("status", "open");

          if (legacyUpdate.error) {
            setStatusMsg(`Failed to update request: ${legacyUpdate.error.message}`);
            return;
          }
        } else {
          setStatusMsg(`Failed to update request: ${error.message}`);
          return;
        }
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
    setStatusMsg("Request updated.");
    await loadDashboard();
  };

  const updateRequestStatus = async (requestId: string, nextStatus: "completed" | "cancelled") => {
    const supabase = getSupabaseClient();

    let matchedDonationId = requests.find((row) => row.id === requestId)?.matched_donation_id || null;

    if (nextStatus === "completed") {
      const completedUpdate = await supabase
        .from("shelter_requests")
        .update({ status: "completed" })
        .eq("id", requestId)
        .eq("status", "matched");

      if (completedUpdate.error) {
        // Backward compatibility for schemas that still use "fulfilled".
        if (completedUpdate.error.code === "22P02" || completedUpdate.error.code === "23514") {
          const fulfilledUpdate = await supabase
            .from("shelter_requests")
            .update({ status: "fulfilled" })
            .eq("id", requestId)
            .eq("status", "matched");

          if (fulfilledUpdate.error) {
            setStatusMsg(`Failed to update status: ${fulfilledUpdate.error.message}`);
            return;
          }
        } else {
          setStatusMsg(`Failed to update status: ${completedUpdate.error.message}`);
          return;
        }
      }

      if (!matchedDonationId) {
        const { data: acceptedResponse, error: acceptedResponseError } = await supabase
          .from("request_responses")
          .select("donation_id")
          .eq("request_id", requestId)
          .eq("status", "accepted")
          .maybeSingle();

        if (!acceptedResponseError) {
          matchedDonationId = acceptedResponse?.donation_id || null;

          if (matchedDonationId) {
            await supabase
              .from("shelter_requests")
              .update({ matched_donation_id: matchedDonationId })
              .eq("id", requestId)
              .is("matched_donation_id", null);
          }
        }
      }

      if (matchedDonationId) {
        const { error: donationUpdateError } = await supabase
          .from("donations")
          .update({ status: "completed" })
          .eq("id", matchedDonationId)
          .eq("matched_shelter_id", userId);

        if (donationUpdateError) {
          // Backward compatibility for environments that do not yet allow "completed" on donations.
          if (donationUpdateError.code === "22P02" || donationUpdateError.code === "23514") {
            await supabase
              .from("donations")
              .update({ status: "fulfilled" })
              .eq("id", matchedDonationId)
              .eq("matched_shelter_id", userId);
          }
        }
      }
    } else {
      const { error } = await supabase
        .from("shelter_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId)
        .in("status", ["open", "responded"]);

      if (error) {
        setStatusMsg(`Failed to update status: ${error.message}`);
        return;
      }
    }

    setStatusMsg(`Request marked ${nextStatus}.`);
    await loadDashboard();
  };

  const acceptResponse = async (request: RequestRow, response: ResponseRow) => {
    if (!userId) return;

    const supabase = getSupabaseClient();

    const rpcResult = await supabase.rpc("accept_request_response", {
      p_request_id: request.id,
      p_response_id: response.id,
    });

    if (rpcResult.error) {
      const rpcMissing = rpcResult.error.code === "PGRST202" || rpcResult.error.code === "42883";

      if (!rpcMissing) {
        setStatusMsg(`Failed to accept response: ${rpcResult.error.message}`);
        return;
      }

      // Backward-compatible fallback while database migrations or schema cache catch up.
      const { error: requestError } = await supabase
        .from("shelter_requests")
        .update({
          status: "matched",
          matched_donation_id: response.donation_id,
          pickup_window: response.proposed_pickup_window || request.pickup_window,
        })
        .eq("id", request.id)
        .in("status", ["open", "responded"]);

      if (requestError) {
        setStatusMsg(`Failed to match request: ${requestError.message}`);
        return;
      }

      const { error: acceptError } = await supabase
        .from("request_responses")
        .update({ status: "accepted" })
        .eq("id", response.id)
        .eq("request_id", request.id)
        .eq("status", "pending");

      if (acceptError) {
        setStatusMsg(`Failed to accept response: ${acceptError.message}`);
        return;
      }

      await supabase
        .from("request_responses")
        .update({ status: "rejected" })
        .eq("request_id", request.id)
        .eq("status", "pending")
        .neq("id", response.id);

      if (response.donation_id) {
        await supabase
          .from("donations")
          .update({ status: "matched", matched_shelter_id: userId })
          .eq("id", response.donation_id);
      }
    }

    setStatusMsg("Response accepted and request matched.");
    await loadDashboard();
  };

  const activeRequests = useMemo(
    () => requests.filter((row) => row.status === "open" || row.status === "responded" || row.status === "matched"),
    [requests]
  );

  const visibleRequests = useMemo(() => {
    if (requestView === "active") return activeRequests;
    if (requestView === "open") return requests.filter((r) => r.status === "open" || r.status === "responded");
    if (requestView === "matched") return requests.filter((r) => r.status === "matched");
    if (requestView === "completed") return requests.filter((r) => r.status === "completed" || r.status === "fulfilled" || r.status === "cancelled");
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
    { id: "requests", label: "Requests", icon: "📋", onClick: () => setActiveTab("requests") },
    { id: "chats", label: "Chats", icon: "💬", onClick: () => setActiveTab("chats"), count: chatInboxItems.length },
    { id: "settings", label: "Settings", icon: "⚙️", onClick: () => setActiveTab("settings") },
    { id: "signout", label: "Sign Out", icon: "🚪", onClick: () => void handleSignOut() },
  ];

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("profiles")
      .update({ name, phone, email })
      .eq("id", userId);

    if (error) {
      setStatusMsg(`Failed to save account: ${error.message}`);
      return;
    }

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            name,
            phone,
            email,
          }
        : prev
    );
    setStatusMsg("Account settings saved.");
  };

  const saveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("profiles")
      .update({ address, city, state, zip_code: zip })
      .eq("id", userId);

    if (error) {
      setStatusMsg(`Failed to save location: ${error.message}`);
      return;
    }

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            address,
            city,
            state,
            zip_code: zip,
          }
        : prev
    );
    setStatusMsg("Location settings saved.");
  };

  const saveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      setStatusMsg("Passwords must match.");
      return;
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setStatusMsg(`Failed to update password: ${error.message}`);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setStatusMsg("Password updated.");
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <MobileHeader
        title="Plate Share"
        subtitle="Shelter Operations"
      />
      <Sidebar
        title="Plate Share"
        subtitle="Shelter Operations"
        items={navItems}
        activeId={activeTab}
        footerLabel="Sign out"
        onFooterClick={() => void handleSignOut()}
      />
      <MobileBottomNav items={navItems} activeId={activeTab} />

      <main className="flex-1 px-4 pt-[72px] pb-20 md:px-6 md:py-6 md:pt-6 md:pb-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4">
            <h1 className="text-lg font-semibold text-slate-900 md:text-2xl">
              {activeTab === "settings" ? "Shelter Profile" : activeTab === "chats" ? "Chats" : "Shelter Request Management"}
            </h1>
            <p className="text-xs text-slate-600 md:text-sm">
              {activeTab === "settings"
                ? "Manage account, location, and security controls."
                : activeTab === "chats"
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
                    <p className={`text-2xl font-bold ${requestView === "completed" ? "text-emerald-700" : "text-slate-900"}`}>{requests.filter((r) => r.status === "completed" || r.status === "fulfilled" || r.status === "cancelled").length}</p>
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
                    <Button size="sm" variant={requestView === "active" ? "primary" : "secondary"} onClick={() => setRequestView("active")}>Active ({activeRequests.length})</Button>
                    <Button size="sm" variant={requestView === "all" ? "primary" : "secondary"} onClick={() => setRequestView("all")}>All ({requests.length})</Button>
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
                    {requestView === "active" ? "No active requests right now." : "No requests yet. Create your first request."}
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
                              <p className="font-medium text-slate-900">{row.title}</p>
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
                            {row.status === "matched" ? (
                              <Button size="sm" variant="primary" onClick={() => void updateRequestStatus(row.id, "completed")}>Mark Completed</Button>
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
                                  <p className="font-semibold text-slate-900 truncate">{row.title}</p>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                    row.status === "matched" ? "bg-emerald-100 text-emerald-800" :
                                    row.status === "completed" || row.status === "fulfilled" ? "bg-blue-100 text-blue-800" :
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
                            {row.status === "matched" ? (
                              <button className="rounded-full bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white" onClick={() => void updateRequestStatus(row.id, "completed")}>Complete</button>
                            ) : null}
                            {row.status === "completed" || row.status === "fulfilled" ? (
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
                              </div>
                              <Button size="sm" variant="secondary" onClick={() => router.push(`/shelter/chat/${row.id}`)}>Open Chat</Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </section>
            </div>
          ) : activeTab === "chats" ? (
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
          ) : (
            <section className="space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-1 md:overflow-visible md:pb-0">
                <Button variant={activeSettingsTab === "account" ? "primary" : "secondary"} className="shrink-0 whitespace-nowrap" onClick={() => setActiveSettingsTab("account")}>Account</Button>
                <Button variant={activeSettingsTab === "location" ? "primary" : "secondary"} className="shrink-0 whitespace-nowrap" onClick={() => setActiveSettingsTab("location")}>Location</Button>
                <Button variant={activeSettingsTab === "security" ? "primary" : "secondary"} className="shrink-0 whitespace-nowrap" onClick={() => setActiveSettingsTab("security")}>Security</Button>
              </div>

              <section className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-700">
                {loading ? (
                  <p>Loading settings...</p>
                ) : activeSettingsTab === "account" ? (
                  <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={saveAccount}>
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">Shelter name</label>
                      <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Shelter display name" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">Phone</label>
                      <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm text-slate-700">Email</label>
                      <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                    </div>
                    <div className="md:col-span-2">
                      <Button type="submit" variant="primary">Save account</Button>
                    </div>
                  </form>
                ) : activeSettingsTab === "location" ? (
                  <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={saveLocation}>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm text-slate-700">Address</label>
                      <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">City</label>
                      <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Jose" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-700">State</label>
                        <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} placeholder="CA" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-700">ZIP</label>
                        <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" value={zip} onChange={(e) => setZip(e.target.value)} maxLength={5} placeholder="95112" />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <Button type="submit" variant="primary">Save location</Button>
                    </div>
                  </form>
                ) : (
                  <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={saveSecurity}>
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">New password</label>
                      <input
                        className="h-10 w-full rounded border border-slate-300 px-3 text-sm"
                        type="password"
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-700">Confirm password</label>
                      <input
                        className="h-10 w-full rounded border border-slate-300 px-3 text-sm"
                        type="password"
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button type="submit" variant="primary">Update password</Button>
                    </div>
                  </form>
                )}
              </section>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
