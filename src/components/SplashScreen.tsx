"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React from "react";

export default function SplashScreen() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-emerald-50 to-yellow-50 font-sans">
      <main className="flex w-full max-w-md flex-col items-center gap-8 px-6 py-24 text-center">
        <div className="flex flex-col items-center gap-6">
          <div className="h-40 w-40 rounded-2xl shadow-lg overflow-hidden bg-white flex items-center justify-center">
            <Image src="/logo.svg" alt="Plate Share logo" width={160} height={160} />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">Welcome To Plate Share</h1>
          <p className="text-sm text-zinc-600">Helping extra meals find hungry hands.</p>
        </div>

        <div className="mt-6 w-full flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            aria-label="I am a restaurant"
            onClick={() => router.push('/restaurant')}
            className="w-full rounded-full bg-emerald-500 px-6 py-3 text-white font-medium shadow-md hover:bg-emerald-600 transition"
          >
            I am a restaurant
          </button>

          <button
            aria-label="I am a shelter"
            onClick={() => router.push('/shelter')}
            className="w-full rounded-full border border-emerald-300 bg-white px-6 py-3 text-emerald-700 font-medium shadow-sm hover:bg-emerald-50 transition"
          >
            I am a shelter
          </button>
        </div>
      </main>
    </div>
  );
}
