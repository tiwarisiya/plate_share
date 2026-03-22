"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function ShelterRegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    shelterName: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    foodNeeded: "",
    quantityNeeded: "",
    foodRestrictions: "",
    pickupWindow: "",
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const saveShelterDataToLocal = () => {
    if (typeof window === "undefined") return;

    const shelterProfile = {
      shelterName: formData.shelterName,
      contactName: formData.contactName,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      zipCode: formData.zipCode,
    };

    const newRequest = {
      id: String(Date.now()),
      title: `${formData.foodNeeded || "Food"} Request`,
      quantity: formData.quantityNeeded,
      restrictions: formData.foodRestrictions,
      pickupWindow: formData.pickupWindow,
      status: "Pending" as const,
      createdAt: new Date().toLocaleString(),
      notes: formData.notes,
    };

    const existingRaw = localStorage.getItem("shelterRequests");
    let existing: typeof newRequest[] = [];
    if (existingRaw) {
      try {
        existing = JSON.parse(existingRaw);
      } catch {
        existing = [];
      }
    }

    localStorage.setItem("shelterProfile", JSON.stringify(shelterProfile));
    localStorage.setItem("shelterRequests", JSON.stringify([newRequest, ...existing]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveShelterDataToLocal();
    router.push("/shelter/home");
  };

  const handleSkipToDemo = () => {
    if (typeof window !== "undefined") {
      const hasProfile = Boolean(localStorage.getItem("shelterProfile"));
      const hasRequests = Boolean(localStorage.getItem("shelterRequests"));

      if (!hasProfile) {
        localStorage.setItem(
          "shelterProfile",
          JSON.stringify({
            shelterName: "Hope Center Shelter",
            contactName: "Jordan Lee",
            phone: "(555) 123-4567",
            email: "shelter@example.org",
            address: "123 Main St",
            city: "San Jose",
            state: "CA",
            zipCode: "95112",
          })
        );
      }

      if (!hasRequests) {
        localStorage.setItem(
          "shelterRequests",
          JSON.stringify([
            {
              id: String(Date.now()),
              title: "Dinner Meal Request",
              quantity: "50 meals",
              restrictions: "Nut-free options",
              pickupWindow: "Today 4:00 PM - 6:00 PM",
              status: "Pending",
              createdAt: new Date().toLocaleString(),
              notes: "Family-friendly meals preferred",
            },
          ])
        );
      }
    }

    router.push("/shelter/home");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-yellow-50 font-sans">
      <main className="w-full max-w-3xl px-6 py-12">
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-emerald-100">
          <h1 className="text-3xl font-bold tracking-tight text-emerald-900">
            Fill out the questions below to make your shelter account!
          </h1>
          <p className="mb-8 mt-2 text-emerald-700">
            Share your shelter needs so restaurants can respond with the right donations.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-lg font-semibold text-emerald-900">
                What is your shelter name?
              </label>
              <input
                name="shelterName"
                value={formData.shelterName}
                onChange={handleChange}
                required
                placeholder="Enter shelter name"
                className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block font-medium text-emerald-800">Contact Name</label>
                <input
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  required
                  placeholder="Primary contact person"
                  className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-2 block font-medium text-emerald-800">Phone</label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder="(555) 555-5555"
                  className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block font-medium text-emerald-800">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="shelter@example.org"
                className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-emerald-900">Location Information</h2>
              <div>
                <label className="mb-2 block font-medium text-emerald-800">Address</label>
                <input
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  placeholder="Street address"
                  className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block font-medium text-emerald-800">City</label>
                  <input
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                    placeholder="City"
                    className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="mb-2 block font-medium text-emerald-800">State</label>
                  <input
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                    maxLength={2}
                    placeholder="ST"
                    className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 uppercase text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="mb-2 block font-medium text-emerald-800">Zip Code</label>
                  <input
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    required
                    maxLength={5}
                    placeholder="12345"
                    className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-lg font-semibold text-emerald-900">
                What food does your shelter need?
              </label>
              <textarea
                name="foodNeeded"
                value={formData.foodNeeded}
                onChange={handleChange}
                required
                rows={3}
                placeholder="Examples: hot meals, sandwiches, produce, dairy"
                className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-lg font-semibold text-emerald-900">
                What quantities do you need?
              </label>
              <textarea
                name="quantityNeeded"
                value={formData.quantityNeeded}
                onChange={handleChange}
                required
                rows={2}
                placeholder="Example: 50 meals, 30 juice boxes, 20 fruit cups"
                className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-lg font-semibold text-emerald-900">
                Any food restrictions?
              </label>
              <textarea
                name="foodRestrictions"
                value={formData.foodRestrictions}
                onChange={handleChange}
                required
                rows={2}
                placeholder="Example: nut-free, halal, low sodium, vegetarian options"
                className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-lg font-semibold text-emerald-900">
                Preferred pickup or delivery window
              </label>
              <input
                name="pickupWindow"
                value={formData.pickupWindow}
                onChange={handleChange}
                required
                placeholder="Example: Weekdays 2:00 PM - 4:00 PM"
                className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="mb-2 block font-medium text-emerald-800">Additional Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Anything else restaurants should know"
                className="w-full rounded-lg border-2 border-emerald-200 px-4 py-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-emerald-700"
            >
              Create shelter account
            </button>

            <button
              type="button"
              onClick={handleSkipToDemo}
              className="w-full rounded-full border-2 border-emerald-600 px-6 py-3 font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              Skip to Demo (View Home Screen)
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
