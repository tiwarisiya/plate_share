"use client";

import React, { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { AppRole } from "@/lib/flow";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, TextArea } from "@/components/ui/field";

type Tab = "account" | "location" | "security";

type SettingsProfile = {
  name: string | null;
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

const PROFILE_SELECT =
  "name, phone, contact_name, organization_notes, cuisine, default_pickup_window, address, city, state, zip_code";

type ProfileSettingsProps = {
  role: AppRole;
  userId: string;
};

// Account, location and security settings for either role. The login email
// is changed through Supabase Auth (which sends a confirmation link); the
// database copies it to profiles.email once confirmed.
export function ProfileSettings({ role, userId }: ProfileSettingsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsProfile | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient();
      const [{ data: userData }, { data: profileRow, error }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("profiles").select(PROFILE_SELECT).eq("id", userId).single(),
      ]);

      if (error) {
        setMsg(`Failed to load settings: ${error.message}`);
      } else {
        setForm(profileRow as SettingsProfile);
      }
      setLoginEmail(userData.user?.email || "");
      setPendingEmail(userData.user?.new_email || null);
      setLoading(false);
    };

    void load();
  }, [userId]);

  const set = (key: keyof SettingsProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => (prev ? { ...prev, [key]: e.target.value } : prev));

  const saveProfileFields = async (fields: Partial<SettingsProfile>, label: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("profiles").update(fields).eq("id", userId);
    setMsg(error ? `Failed to save ${label}: ${error.message}` : `${label[0].toUpperCase()}${label.slice(1)} saved.`);
  };

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    const fields: Partial<SettingsProfile> = { name: form.name, phone: form.phone };
    if (role === "restaurant") {
      fields.cuisine = form.cuisine;
      fields.default_pickup_window = form.default_pickup_window || null;
    } else {
      fields.contact_name = form.contact_name;
      fields.organization_notes = form.organization_notes || null;
    }
    await saveProfileFields(fields, "account settings");
  };

  const saveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    await saveProfileFields(
      { address: form.address, city: form.city, state: form.state, zip_code: form.zip_code },
      "location"
    );
  };

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = newEmail.trim();
    if (!next || next.toLowerCase() === loginEmail.toLowerCase()) {
      setMsg("Enter a new email address.");
      return;
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo: `${window.location.origin}/${role}/settings` }
    );

    if (error) {
      setMsg(`Failed to change email: ${error.message}`);
      return;
    }

    setPendingEmail(next);
    setNewEmail("");
    setMsg(`Check ${next} for a confirmation link. Your sign-in email changes once you confirm it.`);
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

  const orgLabel = role === "restaurant" ? "Restaurant" : "Shelter";

  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 md:overflow-visible md:pb-0">
        {(["account", "location", "security"] as const).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "primary" : "secondary"}
            className="shrink-0 whitespace-nowrap capitalize"
            onClick={() => {
              setActiveTab(tab);
              setMsg(null);
            }}
          >
            {tab}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm font-medium capitalize text-slate-900">{activeTab} settings</p>
        </CardHeader>
        <CardBody>
          {loading ? (
            <p className="text-sm text-slate-600">Loading settings...</p>
          ) : !form ? null : activeTab === "account" ? (
            <div className="space-y-8">
              <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={saveAccount}>
                <Field label={`${orgLabel} name`}>
                  <Input value={form.name || ""} onChange={set("name")} required />
                </Field>
                <Field label="Phone">
                  <Input value={form.phone || ""} onChange={set("phone")} placeholder="(555) 555-5555" required />
                </Field>
                {role === "restaurant" ? (
                  <>
                    <Field label="Food types you usually have (cuisine)">
                      <Input value={form.cuisine || ""} onChange={set("cuisine")} placeholder="Prepared meals, salads, packaged items" required />
                    </Field>
                    <Field label="Default pickup window">
                      <Input value={form.default_pickup_window || ""} onChange={set("default_pickup_window")} placeholder="Mon-Fri 15:00 - 18:00" />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Contact name">
                      <Input value={form.contact_name || ""} onChange={set("contact_name")} placeholder="Jordan Lee" />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Organization notes">
                        <TextArea rows={3} value={form.organization_notes || ""} onChange={set("organization_notes")} placeholder="Program details, distribution constraints, special handling notes" />
                      </Field>
                    </div>
                  </>
                )}
                <div className="md:col-span-2">
                  <Button type="submit">Save account</Button>
                </div>
              </form>

              <form className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-6 md:grid-cols-2" onSubmit={changeEmail}>
                <Field label="Sign-in email">
                  <Input value={loginEmail} disabled />
                </Field>
                <Field label="New email">
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@example.org" />
                </Field>
                {pendingEmail ? (
                  <p className="text-xs text-amber-700 md:col-span-2">Waiting for confirmation of {pendingEmail}.</p>
                ) : null}
                <div className="md:col-span-2">
                  <Button type="submit" variant="secondary">Change email</Button>
                </div>
              </form>
            </div>
          ) : activeTab === "location" ? (
            <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={saveLocation}>
              <p className="text-xs text-slate-500 md:col-span-2">
                {role === "restaurant"
                  ? "Your default pickup address for offers. You can use a different address on each response."
                  : "Your default delivery/pickup location for requests. You can override it on each request."}
              </p>
              <div className="md:col-span-2">
                <Field label="Address">
                  <Input value={form.address || ""} onChange={set("address")} placeholder="123 Main St" required />
                </Field>
              </div>
              <Field label="City">
                <Input value={form.city || ""} onChange={set("city")} placeholder="San Jose" required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="State">
                  <Input value={form.state || ""} onChange={set("state")} maxLength={2} placeholder="CA" required />
                </Field>
                <Field label="ZIP">
                  <Input value={form.zip_code || ""} onChange={set("zip_code")} maxLength={5} placeholder="95112" required />
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
    </>
  );
}
