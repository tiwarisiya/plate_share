"use client";

import React, { useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { AppRole } from "@/lib/flow";
import { Button } from "@/components/ui/button";

export const HANDSHAKE_SELECT = "restaurant_pickup_confirmed_at, shelter_pickup_confirmed_at";

type PickupHandshakeProps = {
  requestId: string;
  role: AppRole;
  restaurantConfirmedAt: string | null;
  shelterConfirmedAt: string | null;
  onChange: (message: string) => void | Promise<void>;
};

// Both sides confirm the hand-off; the request completes when both have.
export function PickupHandshake({ requestId, role, restaurantConfirmedAt, shelterConfirmedAt, onChange }: PickupHandshakeProps) {
  const [busy, setBusy] = useState(false);
  const mine = role === "restaurant" ? restaurantConfirmedAt : shelterConfirmedAt;

  const confirm = async () => {
    setBusy(true);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("confirm_pickup", { p_request_id: requestId });
    setBusy(false);

    if (error) {
      await onChange(`Failed to confirm pickup: ${error.message}`);
      return;
    }

    await onChange(
      data === "completed"
        ? "Pickup confirmed by both sides. Request completed."
        : `Pickup confirmed. Waiting for the ${role === "restaurant" ? "shelter" : "restaurant"} to confirm.`
    );
  };

  const stamp = (at: string | null) => (at ? `✓ ${new Date(at).toLocaleString()}` : "Not yet");

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
      <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">Pickup handshake</p>
      <p>Restaurant handed off: {stamp(restaurantConfirmedAt)}</p>
      <p>Shelter received: {stamp(shelterConfirmedAt)}</p>
      {mine ? null : (
        <Button size="sm" variant="primary" className="mt-2" disabled={busy} onClick={() => void confirm()}>
          {role === "restaurant" ? "Confirm food handed off" : "Confirm food received"}
        </Button>
      )}
    </div>
  );
}
