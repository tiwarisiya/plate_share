import React from "react";
import { Button } from "./button";

type NavItem = {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  count?: number;
};

type SidebarInboxItem = {
  id: string;
  label: string;
  preview?: string;
  timestamp?: string;
  onClick: () => void;
};

type SidebarProps = {
  title: string;
  subtitle: string;
  items: NavItem[];
  activeId: string;
  inboxAnchorId?: string;
  inboxLabel?: string;
  inboxItems?: SidebarInboxItem[];
  inboxEmptyLabel?: string;
  footerLabel?: string;
  onFooterClick?: () => void;
};

export function Sidebar({
  title,
  subtitle,
  items,
  activeId,
  inboxAnchorId,
  inboxLabel = "Inbox",
  inboxItems = [],
  inboxEmptyLabel = "No active chats",
  footerLabel,
  onFooterClick,
}: SidebarProps) {
  return (
    <aside className="hidden md:sticky md:top-0 md:block h-screen w-64 shrink-0 border-r border-slate-200 bg-white">
      <div className="px-4 py-5">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <nav className="space-y-1 px-3">
        {items.map((item) => (
          <div key={item.id}>
            <button
              onClick={item.onClick}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                activeId === item.id
                  ? "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {typeof item.count === "number" && item.count > 0 ? (
                <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-600">{item.count}</span>
              ) : null}
            </button>

            {inboxAnchorId === item.id ? (
              <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 p-2">
                <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{inboxLabel}</p>
                <div className="space-y-1">
                  {inboxItems.length === 0 ? (
                    <p className="px-1 py-1 text-xs text-slate-500">{inboxEmptyLabel}</p>
                  ) : (
                    inboxItems.map((inboxItem) => (
                      <button
                        key={inboxItem.id}
                        onClick={inboxItem.onClick}
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        <p className="truncate text-xs font-medium text-slate-900">{inboxItem.label}</p>
                        {inboxItem.preview ? <p className="truncate text-[11px] text-slate-600">{inboxItem.preview}</p> : null}
                        {inboxItem.timestamp ? <p className="mt-0.5 text-[10px] text-slate-500">{inboxItem.timestamp}</p> : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </nav>
      {footerLabel && onFooterClick ? (
        <div className="absolute bottom-4 left-3 right-3">
          <Button variant="secondary" className="w-full" onClick={onFooterClick}>
            {footerLabel}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
