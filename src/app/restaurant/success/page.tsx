"use client";
import React, { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const donationId = searchParams.get("id");

  return (
    <div className="flex min-h-screen items-center justify-center bg-yellow-50 font-sans">
      <main className="w-full max-w-md px-6 py-20">
        <div className="bg-white ring-1 ring-emerald-100 rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center">
            {/* Main Title */}
            <h1 className="text-3xl font-bold text-emerald-900 text-center mb-8 leading-tight">
              Here is your donation ID use this to login to your account
            </h1>

            {/* Restaurant ID Display */}
            <div className="w-full p-8 bg-yellow-50 border-2 border-emerald-200 rounded-xl mb-8 text-center">
              <p className="text-4xl font-bold text-emerald-900 break-all font-mono tracking-tight">
                {donationId || "N/A"}
              </p>
            </div>

            {/* Warning Text */}
            <p className="text-sm text-emerald-700 text-center mb-8 leading-relaxed">
              Your ID is private and shouldn't be shared.
            </p>

            {/* Email Confirmation Notice */}
            <div className="mb-8 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
              <p className="text-sm text-blue-700 text-center">
                📧 <strong>Check your email!</strong> We've sent a confirmation link to activate your account.
                You won't be able to log in until you confirm your email address.
              </p>
            </div>

            {/* Next Button */}
            <button
              onClick={() => router.push("/restaurant/home")}
              className="w-full rounded-full bg-emerald-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-emerald-700 transition"
            >
              Next
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RegistrationSuccess() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-yellow-50"><div className="text-emerald-900">Loading...</div></div>}>
      <SuccessContent />
    </Suspense>
  );
}
