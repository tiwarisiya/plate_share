"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getCurrentUserRole, isRestaurantProfileComplete } from "@/lib/flow";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Sidebar } from "@/components/ui/sidebar";

type Tab = "account" | "location" | "security";

export default function RestaurantSettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("account");

  const [userId, setUserId] = useState<string | null>(null);
  const [donationId, setDonationId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMsg(null);

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

      setUserId(user.id);
      setEmail(user.email || "");

      const [{ data: profileRow }, { data: donationRow }] = await Promise.all([
        supabase.from("profiles").select("name, phone").eq("id", user.id).single(),
        supabase
          .from("donations")
          .select("id, address, city, state, zip_code")
          .eq("restaurant_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
      ]);

      if (profileRow) {
        setName(profileRow.name || "");
        setPhone(profileRow.phone || "");
      }

      if (donationRow) {
        setDonationId(donationRow.id);
        setAddress(donationRow.address || "");
        setCity(donationRow.city || "");
        setState(donationRow.state || "");
        setZip(donationRow.zip_code || "");
      }

      setLoading(false);
    };

    void load();
  }, [router]);

  const navItems = useMemo(
    () => [
      { id: "home", label: "Requests", icon: "📋", onClick: () => router.push("/restaurant/home") },
      { id: "profile", label: "Profile", icon: "👤", onClick: () => router.push("/restaurant/profile") },
      { id: "settings", label: "Settings", icon: "⚙️", onClick: () => router.push("/restaurant/settings") },
    ],
    [router]
  );

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("profiles")
      .update({ name, phone, email })
      .eq("id", userId);

    setMsg(error ? `Failed to save account: ${error.message}` : "Account settings saved.");
  };

  const saveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donationId) {
      setMsg("No donation location found yet. Complete onboarding first.");
      return;
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("donations")
      .update({ address, city, state, zip_code: zip })
      .eq("id", donationId);

    setMsg(error ? `Failed to save location: ${error.message}` : "Location settings saved.");
  };

  const saveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      setMsg("Passwords must match.");
      return;
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMsg(`Failed to update password: ${error.message}`);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setMsg("Password updated.");
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar title="Plate Share" subtitle="Restaurant Operations" items={navItems} activeId="settings" />

      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            <p className="mt-1 text-sm text-slate-600">Manage account, location, and security controls.</p>
          </div>

          <div className="mb-4 flex gap-2">
            <Button variant={activeTab === "account" ? "primary" : "secondary"} onClick={() => setActiveTab("account")}>Account</Button>
            <Button variant={activeTab === "location" ? "primary" : "secondary"} onClick={() => setActiveTab("location")}>Location</Button>
            <Button variant={activeTab === "security" ? "primary" : "secondary"} onClick={() => setActiveTab("security")}>Security</Button>
          </div>

          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-slate-900">{activeTab === "account" ? "Account settings" : activeTab === "location" ? "Location settings" : "Security settings"}</p>
            </CardHeader>
            <CardBody>
              {loading ? (
                <p className="text-sm text-slate-600">Loading settings...</p>
              ) : activeTab === "account" ? (
                <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={saveAccount}>
                  <Field label="Display name">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Restaurant display name" />
                  </Field>
                  <Field label="Phone">
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Email">
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit">Save account</Button>
                  </div>
                </form>
              ) : activeTab === "location" ? (
                <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={saveLocation}>
                  <div className="md:col-span-2">
                    <Field label="Address">
                      <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
                    </Field>
                  </div>
                  <Field label="City">
                    <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Jose" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="State">
                      <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} placeholder="CA" />
                    </Field>
                    <Field label="ZIP">
                      <Input value={zip} onChange={(e) => setZip(e.target.value)} maxLength={5} placeholder="95112" />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit">Save location</Button>
                  </div>
                </form>
              ) : (
                <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={saveSecurity}>
                  <Field label="New password">
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} />
                  </Field>
                  <Field label="Confirm password">
                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} />
                  </Field>
                  <div className="md:col-span-2">
                    <Button type="submit">Update password</Button>
                  </div>
                </form>
              )}

              {msg ? <p className="mt-4 text-sm text-slate-600">{msg}</p> : null}
            </CardBody>
          </Card>
        </div>
      </main>
    </div>
  );
}
