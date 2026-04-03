"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getCurrentUserRole, isRestaurantProfileComplete } from "@/lib/flow";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

type RestaurantProfile = {
  restaurantName: string;
  email: string;
  phone: string;
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
  phone: "Not set",
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
    const loadProfile = async () => {
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

      const [{ data: profileRow }, { data: donationRow }] = await Promise.all([
        supabase
          .from("profiles")
          .select("name, email, phone, address, city, state, zip_code")
          .eq("id", user.id)
          .single(),
        supabase
          .from("donations")
          .select("food_type, pickup_window")
          .eq("restaurant_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
      ]);

      setProfile({
        restaurantName: profileRow?.name || EMPTY_PROFILE.restaurantName,
        email: profileRow?.email || user.email || EMPTY_PROFILE.email,
        phone: profileRow?.phone || EMPTY_PROFILE.phone,
        address: profileRow?.address || EMPTY_PROFILE.address,
        city: profileRow?.city || EMPTY_PROFILE.city,
        state: profileRow?.state || EMPTY_PROFILE.state,
        zipCode: profileRow?.zip_code || EMPTY_PROFILE.zipCode,
        foodTypes: donationRow?.food_type || EMPTY_PROFILE.foodTypes,
        pickupWindow: donationRow?.pickup_window || EMPTY_PROFILE.pickupWindow,
      });
    };

    void loadProfile();
  }, [router]);

  const fields = useMemo(
    () => [
      ["Restaurant", profile.restaurantName],
      ["Email", profile.email],
      ["Phone", profile.phone],
      ["Address", `${profile.address}, ${profile.city}, ${profile.state} ${profile.zipCode}`],
      ["Food Types", profile.foodTypes],
      ["Pickup Window", profile.pickupWindow],
    ],
    [profile]
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        title="Plate Share"
        subtitle="Restaurant Operations"
        activeId="profile"
        items={[
          { id: "home", label: "Requests", icon: "📋", onClick: () => router.push("/restaurant/home") },
          { id: "profile", label: "Profile", icon: "👤", onClick: () => router.push("/restaurant/profile") },
          { id: "settings", label: "Settings", icon: "⚙️", onClick: () => router.push("/restaurant/settings") },
        ]}
      />

      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Operations Profile</h1>
              <p className="mt-1 text-sm text-slate-600">Information shared during request matching and pickup coordination.</p>
            </div>
            <Button variant="secondary" onClick={() => router.push("/restaurant/settings")}>Edit Settings</Button>
          </div>

          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-slate-900">Account Data</p>
            </CardHeader>
            <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {fields.map((field) => (
                <div key={field[0]} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{field[0]}</p>
                  <p className="mt-1 text-sm text-slate-900">{field[1]}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </main>
    </div>
  );
}
