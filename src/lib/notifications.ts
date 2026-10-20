"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { AppRole } from "@/lib/flow";

export type NotificationKind = "new_response" | "response_accepted" | "listing_claimed" | "new_message" | "pickup_confirmed";

export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  request_id: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
};

// Kinds counted on each nav item.
export const REQUEST_KINDS: NotificationKind[] = ["new_response", "response_accepted", "listing_claimed", "pickup_confirmed"];
export const CHAT_KINDS: NotificationKind[] = ["new_message"];

export function notificationHref(role: AppRole, n: Pick<NotificationRow, "kind" | "request_id">): string {
  if (!n.request_id) return `/${role}/home`;
  if (n.kind === "new_message") return `/${role}/chat/${n.request_id}`;
  return role === "restaurant" ? `/restaurant/donation/${n.request_id}` : "/shelter/home";
}

export async function markNotificationsRead(requestId: string | null = null, kinds: NotificationKind[] | null = null) {
  const supabase = getSupabaseClient();
  await supabase.rpc("mark_notifications_read", { p_request_id: requestId, p_kinds: kinds });
}

// Recent notifications for the signed-in user, kept current over realtime.
export function useNotifications(userId: string | null) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("notifications")
        .select("id, kind, request_id, body, created_at, read_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      setItems((data || []) as NotificationRow[]);
    };

    void load();
  }, [userId, reloadKey]);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        reload();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  const unread = useMemo(() => items.filter((n) => !n.read_at), [items]);

  const countOf = useCallback((kinds: NotificationKind[]) => unread.filter((n) => kinds.includes(n.kind)).length, [unread]);

  const unreadRequestIds = useCallback(
    (kinds: NotificationKind[]) => new Set(unread.filter((n) => kinds.includes(n.kind) && n.request_id).map((n) => n.request_id as string)),
    [unread]
  );

  const markRead = useCallback(
    async (requestId: string | null = null, kinds: NotificationKind[] | null = null) => {
      await markNotificationsRead(requestId, kinds);
      reload();
    },
    [reload]
  );

  return { items, unread, countOf, unreadRequestIds, markRead };
}
