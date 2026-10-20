"use client";

import React from "react";
import { ProfileOverview } from "@/components/settings/profile-overview";
import { RoleShell, useRoleGuard } from "@/components/ui/role-shell";

export default function RestaurantProfilePage() {
  const userId = useRoleGuard("restaurant");

  return (
    <RoleShell role="restaurant" activeId="profile">
      {userId ? <ProfileOverview role="restaurant" userId={userId} /> : <p className="text-sm text-slate-600">Loading profile...</p>}
    </RoleShell>
  );
}
