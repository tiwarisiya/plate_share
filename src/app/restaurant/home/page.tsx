"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AcceptedRequestNotification = {
  id: string;
  shelterName: string;
  requestTitle: string;
  pickupWindow: string;
  location: string;
  acceptedAt: string;
  reminder: string;
};

export default function RestaurantHome() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState("home");
  const [notifications, setNotifications] = useState<AcceptedRequestNotification[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem("acceptedShelterRequests");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as AcceptedRequestNotification[];
      setNotifications(parsed);
    } catch {
      setNotifications([]);
    }
  }, []);

  // Sample shelter donation requests
  const shelters = [
    {
      id: 1,
      name: "Community Shelter Downtown",
      location: "123 Main St, City, ST",
      requestType: "Lunch for 50 people",
      urgency: "High",
      time: "Today 12:00 PM",
      meals: "Sandwiches, Salads, Beverages",
    },
    {
      id: 2,
      name: "Hope Center",
      location: "456 Oak Ave, City, ST",
      requestType: "Dinner for 35 people",
      urgency: "Medium",
      time: "Tomorrow 5:00 PM",
      meals: "Any hot meal",
    },
    {
      id: 3,
      name: "Family Services Hub",
      location: "789 Pine Rd, City, ST",
      requestType: "Breakfast for 20 people",
      urgency: "Low",
      time: "Next week",
      meals: "Pastries, Breakfast items",
    },
  ];

  const menuItems = [
    { id: "home", label: "Home", icon: "🏠" },
    { id: "notifications", label: "Notifications", icon: "🔔" },
    { id: "profile", label: "My Profile", icon: "👤" },
    { id: "settings", label: "Settings", icon: "⚙️" },
    { id: "ai", label: "Ask AI", icon: "🤖" },
    { id: "more", label: "More", icon: "•••" },
  ];

  const handleMenuClick = (menuId: string) => {
    setActiveMenu(menuId);

    if (menuId === "home") {
      router.push("/restaurant/home");
      return;
    }

    if (menuId === "notifications") {
      return;
    }

    if (menuId === "profile") {
      router.push("/restaurant/profile");
      return;
    }

    if (menuId === "settings") {
      router.push("/restaurant/settings");
    }
  };

  const handleDonationRequest = (shelterId: number) => {
    router.push(`/restaurant/donation/${shelterId}`);
  };

  return (
    <div className="flex min-h-screen bg-yellow-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r-2 border-emerald-100 p-6 shadow-sm transition-all">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-emerald-900">Plate Share</h2>
          <p className="text-sm text-emerald-600">Restaurant Portal</p>
        </div>

        <nav className="space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                activeMenu === item.id
                  ? "bg-emerald-100 text-emerald-900 border-l-4 border-emerald-600"
                  : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "notifications" && notifications.length > 0 && (
                <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                  {notifications.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-12 pt-6 border-t border-emerald-100">
          <button
            onClick={() => router.push("/")}
            className="w-full px-4 py-3 rounded-lg text-emerald-700 hover:bg-emerald-50 font-medium transition"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          {activeMenu === "notifications" ? (
            <>
              <div className="mb-8">
                <h1 className="text-4xl font-bold text-emerald-900 mb-2">Notifications</h1>
                <p className="text-emerald-700">
                  Updates and reminders for shelter requests your restaurant has accepted.
                </p>
              </div>

              {notifications.length === 0 ? (
                <div className="rounded-2xl border-2 border-emerald-100 bg-white p-8 shadow-md text-center">
                  <p className="text-lg font-semibold text-emerald-900">No notifications yet</p>
                  <p className="mt-2 text-emerald-700">
                    Accept a shelter request to start seeing updates and reminders here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border-2 border-emerald-100 bg-white p-6 shadow-md"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <h3 className="text-xl font-bold text-emerald-900">{item.shelterName}</h3>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                          Accepted
                        </span>
                      </div>

                      <p className="mt-2 text-emerald-900 font-semibold">{item.requestTitle}</p>
                      <p className="mt-2 text-sm text-emerald-700">Location: {item.location}</p>
                      <p className="text-sm text-emerald-700">Pickup Window: {item.pickupWindow}</p>

                      <div className="mt-3 rounded-lg border border-emerald-200 bg-yellow-50 p-3">
                        <p className="text-sm font-medium text-emerald-900">Reminder: {item.reminder}</p>
                      </div>

                      <p className="mt-3 text-xs text-emerald-600">Accepted at: {item.acceptedAt}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-4xl font-bold text-emerald-900 mb-2">
                  Welcome Back
                </h1>
                <p className="text-emerald-700">
                  Browse donation requests from shelters in your area
                </p>
              </div>

              {/* Shelter Requests Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {shelters.map((shelter) => (
                  <div
                    key={shelter.id}
                    className="bg-white rounded-xl border-2 border-emerald-100 shadow-md overflow-hidden hover:shadow-lg transition"
                  >
                    {/* Card Header */}
                    <div className="bg-emerald-50 p-4 border-b-2 border-emerald-100">
                      <h3 className="text-lg font-bold text-emerald-900">
                        {shelter.name}
                      </h3>
                      <p className="text-sm text-emerald-600 mt-1">{shelter.location}</p>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                          Request
                        </p>
                        <p className="text-md font-semibold text-emerald-900">
                          {shelter.requestType}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                          Meal Types Needed
                        </p>
                        <p className="text-sm text-emerald-800">{shelter.meals}</p>
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                            Time
                          </p>
                          <p className="text-sm text-emerald-800">{shelter.time}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                            Urgency
                          </p>
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                              shelter.urgency === "High"
                                ? "bg-red-100 text-red-700"
                                : shelter.urgency === "Medium"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {shelter.urgency}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="p-4 border-t border-emerald-100 bg-yellow-50">
                      <button
                        onClick={() => handleDonationRequest(shelter.id)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg transition"
                      >
                        Respond to Request
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
