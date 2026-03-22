"use client";
import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function ShelterEntry() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-yellow-50 font-sans">
      <main className="w-full max-w-md px-6 py-20">
        <div className="bg-white ring-1 ring-emerald-100 rounded-2xl shadow-xl p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-28 w-28 rounded-xl overflow-hidden bg-emerald-50 flex items-center justify-center shadow-sm">
              <Image src="/logo.svg" alt="Plate Share logo" width={112} height={112} />
            </div>

            <h1 className="text-3xl font-semibold text-emerald-900 tracking-tight">Shelter Portal</h1>
            <p className="text-sm text-emerald-700">Choose how you'd like to proceed - quick login or create a shelter account.</p>
          </div>

          <div className="mt-8 flex flex-col gap-4">
            <button
              aria-label="Shelter login"
              onClick={() => router.push("/shelter/login")}
              className="w-full rounded-full border-2 border-emerald-500 bg-white px-6 py-3 text-emerald-700 font-medium shadow-sm hover:bg-emerald-50 transition"
            >
              Login
            </button>

            <button
              aria-label="Make an account as a shelter"
              onClick={() => router.push("/shelter/register")}
              className="w-full rounded-full bg-emerald-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-emerald-700 transition"
            >
              Make an account as a shelter
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
