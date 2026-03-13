"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function RegisterDonor() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    restaurantName: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    foodTypes: "",
    pickupWindow: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();

      // First, create the user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        console.error("Auth signup error:", authError);
        throw new Error(`Account creation failed: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      // Then, save the donation data
      const { data, error: insertError } = await supabase
        .from("donations")
        .insert([
          {
            restaurant_name: formData.restaurantName,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zip_code: formData.zipCode,
            food_type: formData.foodTypes,
            pickup_time: formData.pickupWindow,
            user_id: authData.user.id, // Link to the authenticated user
          },
        ])
        .select();

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        throw new Error(`Failed to save donation: ${insertError.message}`);
      }

      if (data && data.length > 0) {
        const donationId = data[0].id;
        router.push(`/restaurant/success?id=${donationId}`);
      } else {
        throw new Error("No data returned from database");
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || "Failed to create account. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-yellow-50 font-sans">
      <main className="w-full max-w-2xl px-6 py-12">
        <div className="bg-white ring-1 ring-emerald-100 rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-emerald-900 mb-2 tracking-tight">
            Fill out the questions below to make your account!
          </h1>
          <p className="text-emerald-600 mb-8">
            Tell us about your restaurant so we can get started.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-lg font-semibold text-emerald-900 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-gray-700"
                placeholder="restaurant@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-lg font-semibold text-emerald-900 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-gray-700"
                placeholder="••••••••"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-lg font-semibold text-emerald-900 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-gray-700"
                placeholder="••••••••"
              />
            </div>

            {/* Restaurant Name */}
            <div>
              <label className="block text-lg font-semibold text-emerald-900 mb-2">
                What is your restaurant name?
              </label>
              <input
                type="text"
                name="restaurantName"
                value={formData.restaurantName}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-gray-700"
                placeholder="Enter restaurant name"
              />
            </div>

            {/* Address Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-emerald-900">
                Location Information
              </h2>

              <div>
                <label className="block text-md font-medium text-emerald-800 mb-2">
                  Address:
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-gray-700"
                  placeholder="Street address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-md font-medium text-emerald-800 mb-2">
                    City:
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-gray-700"
                    placeholder="City"
                  />
                </div>

                <div>
                  <label className="block text-md font-medium text-emerald-800 mb-2">
                    State:
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                    maxLength={2}
                    className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-gray-700 uppercase"
                    placeholder="ST"
                  />
                </div>
              </div>

              <div>
                <label className="block text-md font-medium text-emerald-800 mb-2">
                  Zip Code:
                </label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  required
                  maxLength={5}
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-gray-700"
                  placeholder="12345"
                />
              </div>
            </div>

            {/* Food Types */}
            <div>
              <label className="block text-lg font-semibold text-emerald-900 mb-2">
                What food types do you serve?
              </label>
              <textarea
                name="foodTypes"
                value={formData.foodTypes}
                onChange={handleChange}
                required
                rows={3}
                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-gray-700"
                placeholder="e.g., Italian, Asian, Mediterranean..."
              />
            </div>

            {/* Pickup Window */}
            <div>
              <label className="block text-lg font-semibold text-emerald-900 mb-2">
                What is a good pick up window?
              </label>
              <textarea
                name="pickupWindow"
                value={formData.pickupWindow}
                onChange={handleChange}
                required
                rows={3}
                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-gray-700"
                placeholder="e.g., 3:00 PM - 5:00 PM daily..."
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-emerald-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Create your account"}
            </button>

            {/* Demo Button */}
            <button
              type="button"
              onClick={() => router.push("/restaurant/home")}
              className="w-full rounded-full border-2 border-emerald-600 px-6 py-3 text-emerald-700 font-semibold shadow-sm hover:bg-emerald-50 transition"
            >
              Skip to Demo (View Home Screen)
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
