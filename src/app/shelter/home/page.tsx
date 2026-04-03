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

type Tab = "requests" | "notifications" | "settings";

type RequestRow = {
  id: string;
  title: string;
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
  quantity: string;
  foodNeeded: string;
  restrictions: string;
  pickupWindow: string;
  urgency: "low" | "medium" | "high";
  notes: string;
};

type EditState = {
  requestId: string;
  title: string;
  quantity: string;
  foodNeeded: string;
  restrictions: string;
  pickupWindow: string;
  urgency: "low" | "medium" | "high";
  notes: string;
  coordinationNotes: string;
};

const initialRequestState: NewRequestState = {
  title: "",
  quantity: "",
  foodNeeded: "",
  restrictions: "",
  pickupWindow: "",
  urgency: "medium",
  notes: "",
};

export default function ShelterHomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("requests");
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [responsesByRequest, setResponsesByRequest] = useState<Record<string, ResponseRow[]>>({});
  const [restaurantNames, setRestaurantNames] = useState<Record<string, string>>({});
  const [newRequest, setNewRequest] = useState<NewRequestState>(initialRequestState);
  const [editState, setEditState] = useState<EditState | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setStatusMsg(null);

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
      await supabase.auth.signOut();
      router.replace("/shelter/login");
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
    }

    const { data: requestRows } = await supabase
      .from("shelter_requests")
      .select(
        "id, title, quantity, food_needed, food_restrictions, pickup_window, urgency, notes, coordination_notes, status, created_at, matched_donation_id, address, city, state, zip_code"
      )
      .eq("shelter_id", user.id)
      .order("created_at", { ascending: false });

    const parsedRequests = (requestRows || []) as RequestRow[];
    setRequests(parsedRequests);

    const requestIds = parsedRequests.map((row) => row.id);
    if (requestIds.length === 0) {
      setResponsesByRequest({});
      setRestaurantNames({});
      setLoading(false);
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

    const restaurantIds = Array.from(new Set(parsedResponses.map((row) => row.restaurant_id)));
    if (restaurantIds.length > 0) {
      const { data: restaurantProfiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", restaurantIds);

      const names: Record<string, string> = {};
      (restaurantProfiles || []).forEach((row: any) => {
        names[row.id] = row.name || "Restaurant";
      });
      setRestaurantNames(names);
    } else {
      setRestaurantNames({});
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!userId || !profile) {
      setStatusMsg("Missing shelter profile data.");
      return;
    }

    if (!newRequest.title || !newRequest.quantity || !newRequest.pickupWindow) {
      setStatusMsg("Request title, quantity, and pickup window are required.");
      return;
    }

    const quantity = Number.parseInt(newRequest.quantity, 10);
    const parsedQuantity = Number.isNaN(quantity) ? null : quantity;

    const supabase = getSupabaseClient();
    const insertWithSnapshot = await supabase.from("shelter_requests").insert([
      {
        shelter_id: userId,
        title: newRequest.title,
        quantity: parsedQuantity,
        food_needed: newRequest.foodNeeded || newRequest.title,
        food_restrictions: newRequest.restrictions || null,
        pickup_window: newRequest.pickupWindow,
        urgency: newRequest.urgency,
        notes: newRequest.notes || null,
        shelter_contact_email: profile.email,
        shelter_contact_phone: profile.phone,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        zip_code: profile.zip_code,
        status: "open",
      },
    ]);

    let error = insertWithSnapshot.error;
    if (error && error.code === "42703") {
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
          address: profile.address,
          city: profile.city,
          state: profile.state,
          zip_code: profile.zip_code,
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
      quantity: row.quantity ? String(row.quantity) : "",
      foodNeeded: row.food_needed || "",
      restrictions: row.food_restrictions || "",
      pickupWindow: row.pickup_window || "",
      urgency: row.urgency || "medium",
      notes: row.notes || "",
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
          quantity: parsedQuantity,
          food_needed: editState.foodNeeded || editState.title,
          food_restrictions: editState.restrictions || null,
          pickup_window: editState.pickupWindow,
          urgency: editState.urgency,
          notes: editState.notes || null,
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
    setStatusMsg("Request updated.");
    await loadDashboard();
  };

  const updateRequestStatus = async (requestId: string, nextStatus: "fulfilled" | "cancelled") => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("shelter_requests").update({ status: nextStatus }).eq("id", requestId);
    if (error) {
      setStatusMsg(`Failed to update status: ${error.message}`);
      return;
    }
    setStatusMsg(`Request marked ${nextStatus}.`);
    await loadDashboard();
  };

  const acceptResponse = async (request: RequestRow, response: ResponseRow) => {
    if (!userId) return;

    const supabase = getSupabaseClient();

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
      .eq("request_id", request.id);

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

    setStatusMsg("Response accepted and request matched.");
    await loadDashboard();
  };

  const notifications = useMemo(() => {
    return requests
      .filter((row) => row.status === "responded" || row.status === "matched")
      .map((row) => ({
        id: row.id,
        title: row.status === "matched" ? "Request matched" : "New restaurant responses",
        message:
          row.status === "matched"
            ? `${row.title} is matched and ready for coordination.`
            : `${row.title} has pending responses to review.`,
        createdAt: new Date(row.created_at).toLocaleString(),
      }));
  }, [requests]);

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Shelter Request Management</h1>
            <p className="text-sm text-slate-600">Create requests, review restaurant responses, and manage fulfillment states.</p>
          </div>
          <div className="flex gap-2">
            <button className={`rounded border px-3 py-2 text-sm ${activeTab === "requests" ? "bg-white" : "bg-transparent"}`} onClick={() => setActiveTab("requests")}>Requests</button>
            <button className={`rounded border px-3 py-2 text-sm ${activeTab === "notifications" ? "bg-white" : "bg-transparent"}`} onClick={() => setActiveTab("notifications")}>Notifications</button>
            <button className={`rounded border px-3 py-2 text-sm ${activeTab === "settings" ? "bg-white" : "bg-transparent"}`} onClick={() => setActiveTab("settings")}>Settings</button>
            <button className="rounded border px-3 py-2 text-sm" onClick={() => void handleSignOut()}>Sign out</button>
          </div>
        </div>

        {statusMsg ? <p className="mb-4 text-sm text-slate-700">{statusMsg}</p> : null}

        {activeTab === "requests" ? (
          <div className="grid grid-cols-12 gap-4">
            <section className="col-span-12 rounded border border-slate-200 bg-white p-4 lg:col-span-4">
              <h2 className="mb-3 text-sm font-medium text-slate-900">Create New Request</h2>
              <form onSubmit={handleCreateRequest} className="space-y-3">
                <input className="h-10 w-full rounded border border-slate-300 px-3 text-sm" placeholder="Request title" value={newRequest.title} onChange={(e) => setNewRequest((prev) => ({ ...prev, title: e.target.value }))} />
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
                <button type="submit" className="h-10 w-full rounded bg-emerald-800 text-sm font-medium text-white">Post Request</button>
              </form>
            </section>

            <section className="col-span-12 rounded border border-slate-200 bg-white p-0 lg:col-span-8">
              <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-4 py-3 text-xs uppercase text-slate-500">
                <p className="col-span-3">Request</p>
                <p className="col-span-1">Urgency</p>
                <p className="col-span-2">Pickup</p>
                <p className="col-span-2">Status</p>
                <p className="col-span-4 text-right">Actions</p>
              </div>

              {loading ? (
                <p className="px-4 py-6 text-sm text-slate-600">Loading requests...</p>
              ) : requests.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-600">No requests yet. Create your first request.</p>
              ) : (
                requests.map((row) => {
                  const responses = responsesByRequest[row.id] || [];
                  const pendingResponses = responses.filter((item) => item.status === "pending");
                  const acceptedResponse = responses.find((item) => item.status === "accepted");
                  const isEditing = editState?.requestId === row.id;

                  return (
                    <div key={row.id} className="border-t border-slate-200 px-4 py-3 text-sm">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-3">
                          <p className="font-medium text-slate-900">{row.title}</p>
                          <p className="text-xs text-slate-500">{row.quantity || "-"} servings</p>
                        </div>
                        <p className="col-span-1 capitalize text-slate-700">{row.urgency}</p>
                        <p className="col-span-2 text-slate-700">{row.pickup_window || "-"}</p>
                        <p className="col-span-2 text-slate-700">{mapShelterStatusForUi(row.status)}</p>
                        <div className="col-span-4 flex justify-end gap-2">
                          {(canEditCoreRequestFields(row.status) || canEditPickupWindow(row.status)) && (
                            <button className="rounded border px-2 py-1 text-xs" onClick={() => startEdit(row)}>Edit</button>
                          )}
                          {row.status === "open" || row.status === "responded" ? (
                            <button className="rounded border px-2 py-1 text-xs" onClick={() => void updateRequestStatus(row.id, "cancelled")}>Cancel</button>
                          ) : null}
                          {row.status === "matched" ? (
                            <button className="rounded border px-2 py-1 text-xs" onClick={() => void updateRequestStatus(row.id, "fulfilled")}>Mark Completed</button>
                          ) : null}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                          {canEditCoreRequestFields(row.status) ? (
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.title} onChange={(e) => setEditState((prev) => (prev ? { ...prev, title: e.target.value } : prev))} placeholder="Title" />
                              <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.quantity} onChange={(e) => setEditState((prev) => (prev ? { ...prev, quantity: e.target.value } : prev))} placeholder="Servings" />
                              <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.foodNeeded} onChange={(e) => setEditState((prev) => (prev ? { ...prev, foodNeeded: e.target.value } : prev))} placeholder="Food requested" />
                              <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.restrictions} onChange={(e) => setEditState((prev) => (prev ? { ...prev, restrictions: e.target.value } : prev))} placeholder="Restrictions" />
                              <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.pickupWindow} onChange={(e) => setEditState((prev) => (prev ? { ...prev, pickupWindow: e.target.value } : prev))} placeholder="Pickup window" />
                              <select className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.urgency} onChange={(e) => setEditState((prev) => (prev ? { ...prev, urgency: e.target.value as "low" | "medium" | "high" } : prev))}>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                              <textarea className="rounded border border-slate-300 px-2 py-1 text-sm md:col-span-2" rows={2} value={editState.notes} onChange={(e) => setEditState((prev) => (prev ? { ...prev, notes: e.target.value } : prev))} placeholder="Notes" />
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <input className="h-9 rounded border border-slate-300 px-2 text-sm" value={editState.pickupWindow} onChange={(e) => setEditState((prev) => (prev ? { ...prev, pickupWindow: e.target.value } : prev))} placeholder="Updated pickup window" />
                              <textarea className="rounded border border-slate-300 px-2 py-1 text-sm" rows={2} value={editState.coordinationNotes} onChange={(e) => setEditState((prev) => (prev ? { ...prev, coordinationNotes: e.target.value } : prev))} placeholder="Coordination notes" />
                            </div>
                          )}
                          <div className="mt-2 flex gap-2">
                            <button className="rounded bg-emerald-800 px-3 py-1 text-xs text-white" onClick={() => void saveEdit()}>Save</button>
                            <button className="rounded border px-3 py-1 text-xs" onClick={() => setEditState(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : null}

                      {pendingResponses.length > 0 && (row.status === "open" || row.status === "responded") ? (
                        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700">Pending Restaurant Responses</p>
                          <div className="space-y-2">
                            {pendingResponses.map((response) => (
                              <div key={response.id} className="flex items-center justify-between rounded border border-amber-200 bg-white px-3 py-2">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{restaurantNames[response.restaurant_id] || "Restaurant"}</p>
                                  <p className="text-xs text-slate-600">Proposed pickup: {response.proposed_pickup_window || "Not provided"}</p>
                                  {response.response_note ? <p className="text-xs text-slate-500">{response.response_note}</p> : null}
                                </div>
                                <button className="rounded bg-emerald-800 px-3 py-1 text-xs text-white" onClick={() => void acceptResponse(row, response)}>Accept</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {acceptedResponse && row.status === "matched" ? (
                        <p className="mt-2 text-xs text-slate-600">
                          Matched with {restaurantNames[acceptedResponse.restaurant_id] || "Restaurant"}. Proposed pickup: {acceptedResponse.proposed_pickup_window || row.pickup_window || "Not set"}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </section>
          </div>
        ) : activeTab === "notifications" ? (
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
        ) : (
          <section className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-700">
            {profile ? (
              <div className="space-y-2">
                <p><span className="font-medium text-slate-900">Shelter:</span> {profile.name}</p>
                <p><span className="font-medium text-slate-900">Email:</span> {profile.email}</p>
                <p><span className="font-medium text-slate-900">Phone:</span> {profile.phone}</p>
                <p><span className="font-medium text-slate-900">Address:</span> {profile.address}, {profile.city}, {profile.state} {profile.zip_code}</p>
                {profile.organization_notes ? <p><span className="font-medium text-slate-900">Notes:</span> {profile.organization_notes}</p> : null}
              </div>
            ) : (
              <p>Profile unavailable.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
