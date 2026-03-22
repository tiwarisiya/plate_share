"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TabKey = "requests" | "notifications" | "settings" | "ai";

type ShelterRequest = {
  id: string;
  title: string;
  quantity: string;
  restrictions: string;
  pickupWindow: string;
  status: "Pending" | "Accepted" | "In Progress" | "Completed";
  createdAt: string;
  notes?: string;
};

type ShelterProfile = {
  shelterName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
};

type ShelterNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
};

const emptyProfile: ShelterProfile = {
  shelterName: "Your Shelter",
  contactName: "Shelter Contact",
  phone: "(555) 000-0000",
  email: "shelter@example.org",
  address: "123 Main St",
  city: "City",
  state: "ST",
  zipCode: "12345",
};

export default function ShelterHomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("requests");
  const [requests, setRequests] = useState<ShelterRequest[]>([]);
  const [profile, setProfile] = useState<ShelterProfile>(emptyProfile);
  const [notifications, setNotifications] = useState<ShelterNotification[]>([]);
  const [newRequest, setNewRequest] = useState({
    title: "",
    quantity: "",
    restrictions: "",
    pickupWindow: "",
    notes: "",
  });
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawProfile = localStorage.getItem("shelterProfile");
    if (rawProfile) {
      try {
        const parsedProfile = JSON.parse(rawProfile) as Partial<ShelterProfile>;
        setProfile({ ...emptyProfile, ...parsedProfile });
      } catch {
        setProfile(emptyProfile);
      }
    }

    const rawRequests = localStorage.getItem("shelterRequests");
    if (rawRequests) {
      try {
        const parsedRequests = JSON.parse(rawRequests) as ShelterRequest[];
        setRequests(parsedRequests);
      } catch {
        setRequests([]);
      }
    }

    const rawNotifications = localStorage.getItem("shelterNotifications");
    if (rawNotifications) {
      try {
        const parsed = JSON.parse(rawNotifications) as ShelterNotification[];
        setNotifications(parsed);
      } catch {
        setNotifications([]);
      }
    }
  }, []);

  const tabItems = useMemo(
    () => [
      { id: "requests" as const, label: "Requests", icon: "📋" },
      { id: "notifications" as const, label: "Notifications", icon: "🔔" },
      { id: "settings" as const, label: "Settings", icon: "⚙️" },
      { id: "ai" as const, label: "Ask AI", icon: "🤖" },
    ],
    []
  );

  const saveRequests = (next: ShelterRequest[]) => {
    setRequests(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("shelterRequests", JSON.stringify(next));
    }
  };

  const saveNotifications = (next: ShelterNotification[]) => {
    setNotifications(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("shelterNotifications", JSON.stringify(next));
    }
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.title || !newRequest.quantity || !newRequest.pickupWindow) {
      setStatusMsg("Please fill in request name, quantity, and pickup window.");
      return;
    }

    const created: ShelterRequest = {
      id: String(Date.now()),
      title: newRequest.title,
      quantity: newRequest.quantity,
      restrictions: newRequest.restrictions || "None listed",
      pickupWindow: newRequest.pickupWindow,
      status: "Pending",
      createdAt: new Date().toLocaleString(),
      notes: newRequest.notes,
    };

    const updatedRequests = [created, ...requests];
    saveRequests(updatedRequests);

    const notification: ShelterNotification = {
      id: created.id,
      title: "New request created",
      message: `${created.title} has been posted and is waiting for restaurant responses.`,
      createdAt: created.createdAt,
    };
    saveNotifications([notification, ...notifications]);

    setNewRequest({ title: "", quantity: "", restrictions: "", pickupWindow: "", notes: "" });
    setStatusMsg("Request created successfully.");
  };

  return (
    <div className="flex min-h-screen bg-yellow-50 font-sans">
      <aside className="w-64 shrink-0 border-r-2 border-emerald-100 bg-white p-6 shadow-sm">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-emerald-900">Plate Share</h2>
          <p className="text-sm text-emerald-600">Shelter Portal</p>
        </div>

        <nav className="space-y-3">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 font-medium transition ${
                activeTab === tab.id
                  ? "border-l-4 border-emerald-600 bg-emerald-100 text-emerald-900"
                  : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === "notifications" && notifications.length > 0 && (
                <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                  {notifications.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-12 border-t border-emerald-100 pt-6">
          <button
            onClick={() => router.push("/")}
            className="w-full rounded-lg px-4 py-3 font-medium text-emerald-700 transition hover:bg-emerald-50"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-6xl">
          {activeTab === "requests" && (
            <>
              <div className="mb-8">
                <h1 className="text-4xl font-bold text-emerald-900">Shelter Home</h1>
                <p className="mt-2 text-emerald-700">
                  Create new food requests and track the status of your previous requests.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 shadow-md">
                  <h2 className="text-2xl font-bold text-emerald-900">Create New Request</h2>
                  <p className="mb-5 mt-1 text-sm text-emerald-700">Post what your shelter needs right now.</p>

                  <form onSubmit={handleCreateRequest} className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-emerald-800">Food Needed</label>
                      <input
                        value={newRequest.title}
                        onChange={(e) => setNewRequest((prev) => ({ ...prev, title: e.target.value }))}
                        className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none"
                        placeholder="Example: Dinner meals"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-emerald-800">Quantity Needed</label>
                      <input
                        value={newRequest.quantity}
                        onChange={(e) => setNewRequest((prev) => ({ ...prev, quantity: e.target.value }))}
                        className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none"
                        placeholder="Example: 60 meals"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-emerald-800">Food Restrictions</label>
                      <input
                        value={newRequest.restrictions}
                        onChange={(e) => setNewRequest((prev) => ({ ...prev, restrictions: e.target.value }))}
                        className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none"
                        placeholder="Example: Nut-free and vegetarian"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-emerald-800">Pickup/Delivery Window</label>
                      <input
                        value={newRequest.pickupWindow}
                        onChange={(e) => setNewRequest((prev) => ({ ...prev, pickupWindow: e.target.value }))}
                        className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none"
                        placeholder="Example: Today 4:00 PM - 6:00 PM"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-emerald-800">Additional Notes</label>
                      <textarea
                        value={newRequest.notes}
                        onChange={(e) => setNewRequest((prev) => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                        className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none"
                        placeholder="Any extra details for restaurants"
                      />
                    </div>

                    {statusMsg && (
                      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                        {statusMsg}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-emerald-700"
                    >
                      Post Request
                    </button>
                  </form>
                </section>

                <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 shadow-md">
                  <h2 className="text-2xl font-bold text-emerald-900">Previous Request Status</h2>
                  <p className="mb-5 mt-1 text-sm text-emerald-700">Track status updates for your posted requests.</p>

                  <div className="space-y-3">
                    {requests.length === 0 ? (
                      <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4 text-sm text-emerald-800">
                        No requests posted yet.
                      </div>
                    ) : (
                      requests.map((request) => (
                        <div key={request.id} className="rounded-xl border border-emerald-200 bg-yellow-50 p-4">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-emerald-900">{request.title}</p>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                request.status === "Pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : request.status === "Accepted"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : request.status === "In Progress"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {request.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-emerald-800">Quantity: {request.quantity}</p>
                          <p className="text-sm text-emerald-800">Window: {request.pickupWindow}</p>
                          <p className="mt-2 text-xs text-emerald-600">Posted: {request.createdAt}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </>
          )}

          {activeTab === "notifications" && (
            <>
              <h1 className="text-4xl font-bold text-emerald-900">Notifications</h1>
              <p className="mb-6 mt-2 text-emerald-700">Updates and reminders about your shelter requests.</p>

              <div className="space-y-4">
                {notifications.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-white p-5 text-emerald-800">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div key={item.id} className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
                      <p className="font-bold text-emerald-900">{item.title}</p>
                      <p className="mt-1 text-sm text-emerald-800">{item.message}</p>
                      <p className="mt-2 text-xs text-emerald-600">{item.createdAt}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === "settings" && (
            <>
              <h1 className="text-4xl font-bold text-emerald-900">Settings</h1>
              <p className="mb-6 mt-2 text-emerald-700">Manage your shelter contact and profile settings.</p>

              <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6 shadow-md">
                <p className="text-lg font-bold text-emerald-900">{profile.shelterName}</p>
                <p className="mt-2 text-emerald-800">Contact: {profile.contactName}</p>
                <p className="text-emerald-800">Phone: {profile.phone}</p>
                <p className="text-emerald-800">Email: {profile.email}</p>
                <p className="mt-2 text-emerald-800">
                  {profile.address}, {profile.city}, {profile.state} {profile.zipCode}
                </p>
              </div>
            </>
          )}

          {activeTab === "ai" && (
            <>
              <h1 className="text-4xl font-bold text-emerald-900">Ask AI</h1>
              <p className="mb-6 mt-2 text-emerald-700">
                Get help drafting requests, estimating quantities, and planning pickup windows.
              </p>

              <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6 shadow-md">
                <p className="font-semibold text-emerald-900">Try asking:</p>
                <ul className="mt-3 space-y-2 text-sm text-emerald-800">
                  <li>How many meals should I request for 75 people?</li>
                  <li>What food categories are easiest for restaurants to donate?</li>
                  <li>How should I write a clear pickup note?</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
