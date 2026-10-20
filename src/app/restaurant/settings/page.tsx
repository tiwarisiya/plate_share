"use client";

import React from "react";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { RoleShell, useRoleGuard } from "@/components/ui/role-shell";

export default function RestaurantSettingsPage() {
  const userId = useRoleGuard("restaurant");

  return (
    <RoleShell role="restaurant" activeId="settings" userId={userId}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-900 md:text-2xl">Settings</h1>
          <p className="mt-1 text-xs text-slate-600 md:text-sm">Manage account, location, and security controls.</p>
        </div>
        {userId ? <ProfileSettings role="restaurant" userId={userId} /> : <p className="text-sm text-slate-600">Loading settings...</p>}
      </div>
    </RoleShell>
  );
}
