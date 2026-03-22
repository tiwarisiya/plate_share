"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

type Section = "password" | "location" | "account" | "privacy" | "more";

export default function RestaurantSettingsPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>("password");

  // Password
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  // Location
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [locationMsg, setLocationMsg] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationDonationId, setLocationDonationId] = useState<string | number | null>(null);

  // Account
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountMsg, setAccountMsg] = useState<string | null>(null);

  // Privacy
  const [profileVisible, setProfileVisible] = useState(true);
  const [dataSharing, setDataSharing] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(true);
  const [privacyMsg, setPrivacyMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadLocationSettings = async () => {
      setLocationLoading(true);

      try {
        if (typeof window === "undefined") {
          return;
        }

        const storedDonationId = localStorage.getItem("restaurantDonationId");
        if (!storedDonationId) {
          setLocationMsg("No donation record found yet. Complete registration first.");
          setLocationDonationId(null);
          return;
        }

        const supabase = getSupabaseClient();
        const { data: donation, error: donationsError } = await supabase
          .from("donations")
          .select("id, address, city, state, zip_code")
          .eq("id", storedDonationId)
          .single();

        if (donationsError) {
          throw new Error(`Failed to read location: ${donationsError.message}`);
        }

        if (!donation) {
          setLocationMsg("No saved location found yet. Complete registration first.");
          setLocationDonationId(null);
          return;
        }

        setLocationDonationId(donation.id);
        setAddress(donation.address ?? "");
        setCity(donation.city ?? "");
        setState(donation.state ?? "");
        setZip(donation.zip_code ?? "");
      } catch (error: any) {
        setLocationMsg(error.message || "Failed to load location settings.");
      } finally {
        setLocationLoading(false);
      }
    };

    void loadLocationSettings();
  }, []);

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordMsg("Please fill out all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("New password and confirm password must match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg("New password must be at least 6 characters.");
      return;
    }
    setPasswordMsg("✓ Password updated successfully.");
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleLocationSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !city || !state || !zip) {
      setLocationMsg("Please fill in all location fields.");
      return;
    }

    if (!locationDonationId) {
      setLocationMsg("No donation record found to update. Please finish registration first.");
      return;
    }

    setLocationSaving(true);
    setLocationMsg(null);

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("donations")
        .update({
          address,
          city,
          state,
          zip_code: zip,
        })
        .eq("id", locationDonationId);

      if (updateError) {
        throw new Error(`Failed to save location: ${updateError.message}`);
      }

      setLocationMsg("✓ Location saved successfully.");
    } catch (error: any) {
      setLocationMsg(error.message || "Failed to save location settings.");
    } finally {
      setLocationSaving(false);
    }
  };

  const handleAccountSave = (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMsg("✓ Account details saved.");
  };

  const handlePrivacySave = () => {
    setPrivacyMsg("✓ Privacy preferences saved.");
  };

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: "password", label: "Password", icon: "🔒" },
    { id: "location", label: "Location", icon: "📍" },
    { id: "account", label: "Account", icon: "🏷️" },
    { id: "privacy", label: "Privacy", icon: "🛡️" },
    { id: "more", label: "More", icon: "⋯" },
  ];

  return (
    <div className="flex min-h-screen bg-yellow-50 font-sans">
      {/* Left sidebar — app nav */}
      <aside className="w-64 bg-white border-r-2 border-emerald-100 p-6 shadow-sm shrink-0">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-emerald-900">Plate Share</h2>
          <p className="text-sm text-emerald-600">Restaurant Portal</p>
        </div>
        <nav className="space-y-3">
          <button
            onClick={() => router.push("/restaurant/home")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-emerald-700 hover:bg-emerald-50 transition"
          >
            <span className="text-xl">🏠</span><span>Home</span>
          </button>
          <button
            onClick={() => router.push("/restaurant/profile")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-emerald-700 hover:bg-emerald-50 transition"
          >
            <span className="text-xl">👤</span><span>My Profile</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium bg-emerald-100 text-emerald-900 border-l-4 border-emerald-600">
            <span className="text-xl">⚙️</span><span>Settings</span>
          </button>
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Settings section picker */}
        <div className="w-56 bg-white border-r border-emerald-100 p-4 shrink-0">
          <p className="text-xs uppercase tracking-widest font-bold text-emerald-600 mb-4 px-2">Settings</p>
          <nav className="space-y-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition ${
                  activeSection === s.id
                    ? "bg-emerald-100 text-emerald-900 border-l-4 border-emerald-600"
                    : "text-emerald-700 hover:bg-yellow-50"
                }`}
              >
                <span className="text-lg">{s.icon}</span>
                <span>{s.label} Settings</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Section content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto">

            {/* ── PASSWORD ── */}
            {activeSection === "password" && (
              <div className="bg-white rounded-2xl border-2 border-emerald-100 shadow-lg p-8">
                <h1 className="text-2xl font-bold text-emerald-900 mb-1">Password Settings</h1>
                <p className="text-emerald-600 text-sm mb-6">Update your login password at any time.</p>

                <form onSubmit={handlePasswordUpdate} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-emerald-800 mb-2">Current Password</label>
                    <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-700"
                      placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-emerald-800 mb-2">New Password</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-700"
                      placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-emerald-800 mb-2">Confirm New Password</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-700"
                      placeholder="••••••••" />
                  </div>
                  {passwordMsg && (
                    <div className={`p-3 rounded-lg text-sm border ${passwordMsg.startsWith("✓") ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>
                      {passwordMsg}
                    </div>
                  )}
                  <button type="submit"
                    className="rounded-full bg-emerald-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-emerald-700 transition">
                    Update Password
                  </button>
                </form>
              </div>
            )}

            {/* ── LOCATION ── */}
            {activeSection === "location" && (
              <div className="bg-white rounded-2xl border-2 border-emerald-100 shadow-lg p-8">
                <h1 className="text-2xl font-bold text-emerald-900 mb-1">Location Settings</h1>
                <p className="text-emerald-600 text-sm mb-6">Update your restaurant's address so shelters can find you.</p>

                {locationLoading && (
                  <div className="mb-4 rounded-lg border border-emerald-200 bg-yellow-50 p-3 text-sm text-emerald-800">
                    Loading current location from your donations record...
                  </div>
                )}

                <form onSubmit={handleLocationSave} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-emerald-800 mb-2">Street Address</label>
                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-700"
                      placeholder="123 Main St" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-emerald-800 mb-2">City</label>
                      <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-700"
                        placeholder="City" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-emerald-800 mb-2">State</label>
                      <input type="text" value={state} onChange={(e) => setState(e.target.value)}
                        maxLength={2}
                        className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-700 uppercase"
                        placeholder="ST" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-emerald-800 mb-2">Zip Code</label>
                    <input type="text" value={zip} onChange={(e) => setZip(e.target.value)}
                      maxLength={5}
                      className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-700"
                      placeholder="12345" />
                  </div>
                  {locationMsg && (
                    <div className={`p-3 rounded-lg text-sm border ${locationMsg.startsWith("✓") ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>
                      {locationMsg}
                    </div>
                  )}
                  <button type="submit"
                    disabled={locationLoading || locationSaving}
                    className="rounded-full bg-emerald-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
                    {locationSaving ? "Saving..." : "Save Location"}
                  </button>
                </form>
              </div>
            )}

            {/* ── ACCOUNT ── */}
            {activeSection === "account" && (
              <div className="bg-white rounded-2xl border-2 border-emerald-100 shadow-lg p-8">
                <h1 className="text-2xl font-bold text-emerald-900 mb-1">Account Settings</h1>
                <p className="text-emerald-600 text-sm mb-6">Manage your restaurant name, phone number, and account details.</p>

                <form onSubmit={handleAccountSave} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-emerald-800 mb-2">Restaurant Display Name</label>
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-700"
                      placeholder="Your restaurant's public name" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-emerald-800 mb-2">Phone Number</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 text-gray-700"
                      placeholder="555-555-5555" />
                  </div>

                  <div className="pt-2 border-t border-emerald-100">
                    <p className="text-sm font-semibold text-emerald-800 mb-3">Notification Preferences</p>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between p-3 bg-yellow-50 border border-emerald-200 rounded-lg">
                        <span className="text-sm text-emerald-900 font-medium">Email me for new shelter requests</span>
                        <input type="checkbox" defaultChecked className="h-5 w-5 accent-emerald-600" />
                      </label>
                      <label className="flex items-center justify-between p-3 bg-yellow-50 border border-emerald-200 rounded-lg">
                        <span className="text-sm text-emerald-900 font-medium">SMS reminders for pickup windows</span>
                        <input type="checkbox" className="h-5 w-5 accent-emerald-600" />
                      </label>
                    </div>
                  </div>

                  {accountMsg && (
                    <div className="p-3 rounded-lg text-sm border bg-emerald-50 border-emerald-300 text-emerald-800">
                      {accountMsg}
                    </div>
                  )}
                  <button type="submit"
                    className="rounded-full bg-emerald-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-emerald-700 transition">
                    Save Account Details
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-emerald-100">
                  <p className="text-sm font-semibold text-red-700 mb-3">Danger Zone</p>
                  <button className="rounded-full border-2 border-red-300 px-6 py-3 text-red-600 font-semibold hover:bg-red-50 transition text-sm">
                    Delete Account
                  </button>
                </div>
              </div>
            )}

            {/* ── PRIVACY ── */}
            {activeSection === "privacy" && (
              <div className="bg-white rounded-2xl border-2 border-emerald-100 shadow-lg p-8">
                <h1 className="text-2xl font-bold text-emerald-900 mb-1">Privacy Settings</h1>
                <p className="text-emerald-600 text-sm mb-6">Control how your information is shared with shelters and the platform.</p>

                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-yellow-50 border-2 border-emerald-200 rounded-xl">
                    <div>
                      <p className="text-emerald-900 font-semibold text-sm">Public Profile</p>
                      <p className="text-emerald-600 text-xs mt-1">Allow shelters to discover your restaurant listing</p>
                    </div>
                    <input type="checkbox" checked={profileVisible} onChange={(e) => setProfileVisible(e.target.checked)}
                      className="h-5 w-5 accent-emerald-600" />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-yellow-50 border-2 border-emerald-200 rounded-xl">
                    <div>
                      <p className="text-emerald-900 font-semibold text-sm">Analytics & Data Sharing</p>
                      <p className="text-emerald-600 text-xs mt-1">Help improve Plate Share by sharing anonymous usage data</p>
                    </div>
                    <input type="checkbox" checked={dataSharing} onChange={(e) => setDataSharing(e.target.checked)}
                      className="h-5 w-5 accent-emerald-600" />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-yellow-50 border-2 border-emerald-200 rounded-xl">
                    <div>
                      <p className="text-emerald-900 font-semibold text-sm">Marketing Emails</p>
                      <p className="text-emerald-600 text-xs mt-1">Receive updates, tips, and news from Plate Share</p>
                    </div>
                    <input type="checkbox" checked={marketingEmails} onChange={(e) => setMarketingEmails(e.target.checked)}
                      className="h-5 w-5 accent-emerald-600" />
                  </label>
                </div>

                {privacyMsg && (
                  <div className="mt-4 p-3 rounded-lg text-sm border bg-emerald-50 border-emerald-300 text-emerald-800">
                    {privacyMsg}
                  </div>
                )}
                <button onClick={handlePrivacySave}
                  className="mt-6 rounded-full bg-emerald-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-emerald-700 transition">
                  Save Privacy Settings
                </button>
              </div>
            )}

            {/* ── MORE ── */}
            {activeSection === "more" && (
              <div className="bg-white rounded-2xl border-2 border-emerald-100 shadow-lg p-8">
                <h1 className="text-2xl font-bold text-emerald-900 mb-1">More Settings</h1>
                <p className="text-emerald-600 text-sm mb-6">Additional options and support.</p>

                <div className="space-y-3">
                  {[
                    { label: "Help & Support", desc: "Get assistance and read FAQs", icon: "💬" },
                    { label: "Terms of Service", desc: "Read our terms and conditions", icon: "📄" },
                    { label: "Privacy Policy", desc: "Learn how we handle your data", icon: "🔐" },
                    { label: "About Plate Share", desc: "Version 1.0.0", icon: "ℹ️" },
                  ].map((item) => (
                    <div key={item.label}
                      className="flex items-center justify-between p-4 bg-yellow-50 border-2 border-emerald-200 rounded-xl cursor-pointer hover:bg-emerald-50 transition">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <p className="text-emerald-900 font-semibold text-sm">{item.label}</p>
                          <p className="text-emerald-600 text-xs mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                      <span className="text-emerald-400 text-xl">›</span>
                    </div>
                  ))}

                  <div className="pt-4 border-t border-emerald-100">
                    <button
                      onClick={() => router.push("/")}
                      className="w-full rounded-full border-2 border-emerald-500 px-6 py-3 text-emerald-700 font-semibold hover:bg-emerald-50 transition"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
