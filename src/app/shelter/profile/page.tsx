"use client";

import React from "react";
import { ProfileOverview } from "@/components/settings/profile-overview";
import { RoleShell, useRoleGuard } from "@/components/ui/role-shell";

export default function ShelterProfilePage() {
  const userId = useRoleGuard("shelter");

  return (
    <RoleShell role="shelter" activeId="profile" userId={userId}>
      {userId ? <ProfileOverview role="shelter" userId={userId} /> : <p className="text-sm text-slate-600">Loading profile...</p>}
    </RoleShell>
  );
}
