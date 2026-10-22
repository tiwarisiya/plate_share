"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AppRole } from "@/lib/flow";
import { NotificationRow, notificationHref } from "@/lib/notifications";

type NotificationBellProps = {
  role: AppRole;
  items: NotificationRow[];
  unreadCount: number;
  onMarkRead: (requestId?: string | null) => void | Promise<void>;
};

export function NotificationBell({ role, items, unreadCount, onMarkRead }: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const openItem = async (n: NotificationRow) => {
    setOpen(false);
    if (!n.read_at) await onMarkRead(n.request_id);
    router.push(notificationHref(role, n));
  };

  return (
    <div className="relative">
      <button
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg md:left-0 md:right-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              {unreadCount > 0 ? (
                <button className="text-xs text-emerald-800 hover:underline" onClick={() => void onMarkRead(null)}>
                  Mark all read
                </button>
              ) : null}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3 py-4 text-sm text-slate-500">Nothing yet.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => void openItem(n)}
                    className={`flex w-full gap-2 border-t border-slate-100 px-3 py-2 text-left first:border-t-0 hover:bg-slate-50 ${n.read_at ? "" : "bg-emerald-50/60"}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-rose-600"}`} />
                    <span className="min-w-0">
                      <span className="block text-sm text-slate-800">{n.body}</span>
                      <span className="block text-[11px] text-slate-500">{new Date(n.created_at).toLocaleString()}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
