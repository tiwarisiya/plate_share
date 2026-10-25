"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { AppRole, getLoginPathForRole, getRoleGuardRedirect } from "@/lib/flow";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileBottomNav, MobileHeader } from "@/components/ui/mobile-nav";
import { NotificationBell } from "@/components/ui/notification-bell";
import { CHAT_KINDS, REQUEST_KINDS, useNotifications } from "@/lib/notifications";

export type RoleNavId = "requests" | "chats" | "listings" | "profile" | "settings";

// Signed-in user id once they're confirmed to be a `role` user with a
// complete profile; otherwise redirects (login, onboarding or the other
// role's dashboard) and stays null.
export function useRoleGuard(role: AppRole): string | null {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace(getLoginPathForRole(role));
        return;
      }

      const redirect = await getRoleGuardRedirect(role, user.id);
      if (redirect) {
        router.replace(redirect);
        return;
      }

      setUserId(user.id);
    };

    void check();
  }, [role, router]);

  return userId;
}

export function useRoleNavItems(role: AppRole, counts: Partial<Record<RoleNavId, number>> = {}) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/");
  };

  return [
    { id: "requests", label: "Requests", icon: "📋", onClick: () => router.push(`/${role}/home`), count: counts.requests },
    { id: "chats", label: "Chats", icon: "💬", onClick: () => router.push(`/${role}/home?tab=chats`), count: counts.chats },
    {
      id: "listings",
      label: role === "restaurant" ? "Listings" : "Available Food",
      icon: "🥡",
      onClick: () => router.push(`/${role}/listings`),
      count: counts.listings,
    },
    { id: "profile", label: "Profile", icon: "👤", onClick: () => router.push(`/${role}/profile`) },
    { id: "settings", label: "Settings", icon: "⚙️", onClick: () => router.push(`/${role}/settings`) },
    { id: "signout", label: "Sign Out", icon: "🚪", onClick: () => void handleSignOut() },
  ];
}

type RoleShellProps = {
  role: AppRole;
  activeId: RoleNavId;
  userId: string | null;
  children: React.ReactNode;
};

export function RoleShell({ role, activeId, userId, children }: RoleShellProps) {
  const notifications = useNotifications(userId);
  const items = useRoleNavItems(role, {
    requests: notifications.countOf(REQUEST_KINDS),
    chats: notifications.countOf(CHAT_KINDS),
  });
  const subtitle = role === "restaurant" ? "Restaurant Operations" : "Shelter Operations";
  const bell = (
    <NotificationBell
      role={role}
      items={notifications.items}
      unreadCount={notifications.unread.length}
      onMarkRead={(requestId) => notifications.markRead(requestId ?? null)}
    />
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <MobileHeader title="Plate Share" subtitle={subtitle} action={bell} />
      <Sidebar title="Plate Share" subtitle={subtitle} activeId={activeId} items={items} headerAction={bell} />
      <MobileBottomNav items={items} activeId={activeId} />
      <main className="min-w-0 flex-1 px-4 pt-[72px] pb-20 md:px-6 md:py-6 md:pt-6 md:pb-6">{children}</main>
    </div>
  );
}
