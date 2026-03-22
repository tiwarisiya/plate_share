"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type RestaurantProfile = {
  restaurantName: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  foodTypes: string;
  pickupWindow: string;
};

type AcceptedRequestNotification = {
  id: string;
  shelterName: string;
  requestTitle: string;
  pickupWindow: string;
  location: string;
  acceptedAt: string;
  reminder: string;
};

const requestDetails: Record<string, Omit<AcceptedRequestNotification, "acceptedAt" | "reminder">> = {
  "1": {
    id: "1",
    shelterName: "Community Shelter Downtown",
    requestTitle: "Lunch for 50 people",
    pickupWindow: "Today, 12:00 PM - 1:00 PM",
    location: "123 Main St, City, ST 10001",
  },
  "2": {
    id: "2",
    shelterName: "Hope Center",
    requestTitle: "Dinner for 35 people",
    pickupWindow: "Tomorrow, 5:00 PM - 6:00 PM",
    location: "456 Oak Ave, City, ST 10002",
  },
  "3": {
    id: "3",
    shelterName: "Family Services Hub",
    requestTitle: "Breakfast for 20 people",
    pickupWindow: "Next week, 7:30 AM - 8:30 AM",
    location: "789 Pine Rd, City, ST 10003",
  },
};

const defaultProfile: RestaurantProfile = {
  restaurantName: "Your Restaurant",
  email: "restaurant@example.com",
  address: "123 Main St",
  city: "City",
  state: "ST",
  zipCode: "12345",
  foodTypes: "Food types not provided",
  pickupWindow: "Pickup window not provided",
};

export default function DonationConfirmPage() {
  const params = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<RestaurantProfile>(defaultProfile);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (typeof window !== "undefined") {
      const id = String(params.id || "");
      const fallback = {
        id,
        shelterName: "Shelter Request",
        requestTitle: "Accepted donation request",
        pickupWindow: profile.pickupWindow,
        location: `${profile.address}, ${profile.city}, ${profile.state} ${profile.zipCode}`,
      };

      const request = requestDetails[id] || fallback;
      const notification: AcceptedRequestNotification = {
        ...request,
        acceptedAt: new Date().toLocaleString(),
        reminder: `Prepare your donation before ${request.pickupWindow}.`,
      };

      const existingRaw = localStorage.getItem("acceptedShelterRequests");
      let existing: AcceptedRequestNotification[] = [];

      if (existingRaw) {
        try {
          existing = JSON.parse(existingRaw) as AcceptedRequestNotification[];
        } catch {
          existing = [];
        }
      }

      const filtered = existing.filter((item) => item.id !== notification.id);
      const updated = [notification, ...filtered];
      localStorage.setItem("acceptedShelterRequests", JSON.stringify(updated));
    }

    setConfirmed(true);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawProfile = localStorage.getItem("restaurantProfile");
    if (!rawProfile) return;

    try {
      const parsed = JSON.parse(rawProfile) as Partial<RestaurantProfile>;
      setProfile({ ...defaultProfile, ...parsed });
    } catch {
      setProfile(defaultProfile);
    }
  }, []);

  return (
    <div className="min-h-screen bg-yellow-50 font-sans">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push(`/restaurant/donation/${String(params.id || "")}`)}
            className="rounded-full border-2 border-emerald-500 bg-white px-5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition"
          >
            Back to Request
          </button>

          <span className="rounded-full bg-emerald-100 px-4 py-1 text-xs font-bold text-emerald-700">
            Final Review
          </span>
        </div>

        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-8 shadow-lg">
          <h1 className="text-3xl font-bold text-emerald-900">Restaurant Contact Profile</h1>
          <p className="mt-2 text-emerald-700">
            Review your restaurant profile and contact information before confirming this request.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Restaurant Name</p>
              <p className="mt-1 text-xl font-bold text-emerald-900">{profile.restaurantName}</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Email</p>
              <p className="mt-1 text-emerald-900 font-semibold break-words">{profile.email}</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Phone</p>
              <p className="mt-1 text-emerald-900 font-semibold">(555) 000-0000</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Address</p>
              <p className="mt-1 text-emerald-900 font-semibold">
                {profile.address}, {profile.city}, {profile.state} {profile.zipCode}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Food Types</p>
              <p className="mt-1 text-emerald-900">{profile.foodTypes}</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pickup Window</p>
              <p className="mt-1 text-emerald-900">{profile.pickupWindow}</p>
            </div>
          </div>

          {confirmed && (
            <div className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
              Request confirmed. The shelter can now contact your restaurant using this profile.
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={handleConfirm}
              className="w-full rounded-full bg-emerald-600 px-6 py-3 text-white text-lg font-semibold shadow-md hover:bg-emerald-700 transition"
            >
              Confirm
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
