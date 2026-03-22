"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";

type ShelterRequest = {
  shelterName: string;
  location: string;
  contact: string;
  requestTitle: string;
  peopleServed: string;
  foodNeeded: string;
  pickupWindow: string;
  urgency: "High" | "Medium" | "Low";
  notes: string;
};

const requestData: Record<string, ShelterRequest> = {
  "1": {
    shelterName: "Community Shelter Downtown",
    location: "123 Main St, City, ST 10001",
    contact: "(555) 123-1001",
    requestTitle: "Lunch for 50 people",
    peopleServed: "Approximately 50 guests",
    foodNeeded: "Sandwiches, fresh salads, and bottled beverages",
    pickupWindow: "Today, 12:00 PM - 1:00 PM",
    urgency: "High",
    notes:
      "Please package meals in individual servings. Shelter has limited cold storage, so same-day pickup is preferred.",
  },
  "2": {
    shelterName: "Hope Center",
    location: "456 Oak Ave, City, ST 10002",
    contact: "(555) 123-1002",
    requestTitle: "Dinner for 35 people",
    peopleServed: "Approximately 35 guests",
    foodNeeded: "Any hot meal with vegetarian option",
    pickupWindow: "Tomorrow, 5:00 PM - 6:00 PM",
    urgency: "Medium",
    notes:
      "Please label any allergens if possible. We can provide containers at pickup if needed.",
  },
  "3": {
    shelterName: "Family Services Hub",
    location: "789 Pine Rd, City, ST 10003",
    contact: "(555) 123-1003",
    requestTitle: "Breakfast for 20 people",
    peopleServed: "Approximately 20 guests",
    foodNeeded: "Pastries, fruit cups, and breakfast items",
    pickupWindow: "Next week, 7:30 AM - 8:30 AM",
    urgency: "Low",
    notes:
      "Easy-to-serve items are preferred for quick morning distribution.",
  },
};

export default function DonationRequestDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");

  const request = requestData[id] || {
    shelterName: "Shelter Request",
    location: "Location not provided",
    contact: "Contact not provided",
    requestTitle: "Food request details",
    peopleServed: "Guest count not provided",
    foodNeeded: "Food types not provided",
    pickupWindow: "Pickup window not provided",
    urgency: "Medium" as const,
    notes: "Additional details are not available for this request.",
  };

  return (
    <div className="min-h-screen bg-yellow-50 font-sans">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push("/restaurant/home")}
            className="rounded-full border-2 border-emerald-500 bg-white px-5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition"
          >
            Back to Home
          </button>
          <span
            className={`rounded-full px-4 py-1 text-xs font-bold ${
              request.urgency === "High"
                ? "bg-red-100 text-red-700"
                : request.urgency === "Medium"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {request.urgency} Urgency
          </span>
        </div>

        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-8 shadow-lg">
          <h1 className="text-3xl font-bold text-emerald-900">Shelter Request Overview</h1>
          <p className="mt-2 text-emerald-700">
            Review what the shelter needs before accepting this donation request.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Shelter Name</p>
              <p className="mt-1 text-lg font-bold text-emerald-900">{request.shelterName}</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Request</p>
              <p className="mt-1 text-lg font-bold text-emerald-900">{request.requestTitle}</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">People Served</p>
              <p className="mt-1 text-emerald-900 font-semibold">{request.peopleServed}</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pickup Window</p>
              <p className="mt-1 text-emerald-900 font-semibold">{request.pickupWindow}</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Food Needed</p>
              <p className="mt-1 text-emerald-900 font-semibold">{request.foodNeeded}</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Location</p>
              <p className="mt-1 text-emerald-900 font-semibold">{request.location}</p>
              <p className="mt-2 text-sm text-emerald-700">Contact: {request.contact}</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-yellow-50 p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Additional Notes</p>
              <p className="mt-1 text-emerald-900">{request.notes}</p>
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={() => router.push(`/restaurant/donation/${id}/confirm`)}
              className="w-full rounded-full bg-emerald-600 px-6 py-3 text-white text-lg font-semibold shadow-md hover:bg-emerald-700 transition"
            >
              Accept the request
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
