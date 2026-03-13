"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function RestaurantHome() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState("home");

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
    { id: "profile", label: "My Profile", icon: "👤" },
    { id: "settings", label: "Settings", icon: "⚙️" },
    { id: "ai", label: "Ask AI", icon: "🤖" },
    { id: "more", label: "More", icon: "•••" },
  ];

  const handleMenuClick = (menuId: string) => {
    setActiveMenu(menuId);
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
        </div>
      </main>
    </div>
  );
}
