"use client";
import React, { Suspense } from "react";
import { useRouter } from "next/navigation";

function SuccessContent() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-yellow-50 font-sans">
      <main className="w-full max-w-md px-6 py-20">
        <div className="bg-white ring-1 ring-emerald-100 rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center">
            {/* Main Title */}
            <h1 className="text-3xl font-bold text-emerald-900 text-center mb-8 leading-tight">
              Thank you. Your account has been confirmed. Please continue to the home screen.
            </h1>

            {/* Confirmation Notice */}
            <div className="mb-8 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl">
              <p className="text-sm text-emerald-700 text-center">
                Your account is confirmed and ready. Continue to access your restaurant home screen.
              </p>
            </div>

            {/* Continue Button */}
            <button
              onClick={() => router.push("/restaurant/home")}
              className="w-full rounded-full bg-emerald-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-emerald-700 transition"
            >
              Continue
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
