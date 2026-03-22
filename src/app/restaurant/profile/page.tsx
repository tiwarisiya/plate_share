"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

const EMPTY_PROFILE: RestaurantProfile = {
  restaurantName: "Not set",
  email: "Not set",
  address: "Not set",
  city: "Not set",
  state: "Not set",
  zipCode: "Not set",
  foodTypes: "Not set",
  pickupWindow: "Not set",
};

export default function RestaurantProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<RestaurantProfile>(EMPTY_PROFILE);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawProfile = localStorage.getItem("restaurantProfile");
    if (!rawProfile) return;

    try {
      const parsed = JSON.parse(rawProfile) as Partial<RestaurantProfile>;
      setProfile({ ...EMPTY_PROFILE, ...parsed });
    } catch {
      setProfile(EMPTY_PROFILE);
    }
  }, []);

  const fields = useMemo(
    () => [
      { label: "Restaurant Name", value: profile.restaurantName },
      { label: "Email", value: profile.email },
      { label: "Address", value: profile.address },
      { label: "City", value: profile.city },
      { label: "State", value: profile.state },
      { label: "Zip Code", value: profile.zipCode },
      { label: "Food Types", value: profile.foodTypes },
      { label: "Pickup Window", value: profile.pickupWindow },
    ],
    [profile]
  );

  return (
    <div className="flex min-h-screen bg-yellow-50 font-sans">
      <aside className="w-64 bg-white border-r-2 border-emerald-100 p-6 shadow-sm">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-emerald-900">Plate Share</h2>
          <p className="text-sm text-emerald-600">Restaurant Portal</p>
        </div>

        <nav className="space-y-3">
          <button
            onClick={() => router.push("/restaurant/home")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-emerald-700 hover:bg-emerald-50 transition"
          >
            <span className="text-xl">🏠</span>
            <span>Home</span>
          </button>

          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium bg-emerald-100 text-emerald-900 border-l-4 border-emerald-600">
            <span className="text-xl">👤</span>
            <span>My Profile</span>
          </button>

          <button
            onClick={() => router.push("/restaurant/settings")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-emerald-700 hover:bg-emerald-50 transition"
          >
            <span className="text-xl">⚙️</span>
            <span>Settings</span>
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl border-2 border-emerald-100 shadow-lg p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center text-4xl mb-4">
              👤
            </div>
            <h1 className="text-3xl font-bold text-emerald-900">My Profile</h1>
            <p className="text-emerald-700 mt-2">Restaurant account details</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => (
              <div key={field.label} className="bg-yellow-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-xs uppercase tracking-wide font-semibold text-emerald-700 mb-1">
                  {field.label}
                </p>
                <p className="text-emerald-900 font-semibold break-words">{field.value || "Not set"}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <button
              onClick={() => router.push("/restaurant/settings")}
              className="w-full rounded-full bg-emerald-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-emerald-700 transition"
            >
              Go to Settings
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
