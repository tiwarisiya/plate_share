"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { AppRole } from "@/lib/flow";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type OverviewProfile = {
  name: string | null;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  organization_notes: string | null;
  cuisine: string | null;
  default_pickup_window: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

const NOT_SET = "Not set";

export function ProfileOverview({ role, userId }: { role: AppRole; userId: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<OverviewProfile | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("profiles")
        .select("name, email, phone, contact_name, organization_notes, cuisine, default_pickup_window, address, city, state, zip_code")
        .eq("id", userId)
        .single();
      setProfile((data as OverviewProfile) || null);
    };

    void load();
  }, [userId]);

  const address = profile?.address
    ? `${profile.address}, ${profile.city || ""}, ${profile.state || ""} ${profile.zip_code || ""}`
    : NOT_SET;

  const fields: [string, string][] = profile
    ? role === "restaurant"
      ? [
          ["Restaurant", profile.name || NOT_SET],
          ["Email", profile.email || NOT_SET],
          ["Phone", profile.phone || NOT_SET],
          ["Default pickup address", address],
          ["Food Types", profile.cuisine || NOT_SET],
          ["Default Pickup Window", profile.default_pickup_window || NOT_SET],
        ]
      : [
          ["Shelter", profile.name || NOT_SET],
          ["Contact", profile.contact_name || NOT_SET],
          ["Email", profile.email || NOT_SET],
          ["Phone", profile.phone || NOT_SET],
          ["Location", address],
          ["Organization Notes", profile.organization_notes || NOT_SET],
        ]
    : [];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 md:text-2xl">{role === "restaurant" ? "Operations Profile" : "Shelter Profile"}</h1>
          <p className="mt-1 text-xs text-slate-600 md:text-sm">Information shared during request matching and pickup coordination.</p>
        </div>
        <Button variant="secondary" className="shrink-0" onClick={() => router.push(`/${role}/settings`)}>Edit Settings</Button>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-slate-900">Account Data</p>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {!profile ? (
            <p className="text-sm text-slate-600">Loading profile...</p>
          ) : (
            fields.map(([label, value]) => (
              <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-900">{value}</p>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
