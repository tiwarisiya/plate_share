import React from "react";
import { Button } from "./button";

type NavItem = {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  count?: number;
};

type SidebarProps = {
  title: string;
  subtitle: string;
  items: NavItem[];
  activeId: string;
  footerLabel?: string;
  onFooterClick?: () => void;
};

export function Sidebar({ title, subtitle, items, activeId, footerLabel, onFooterClick }: SidebarProps) {
  return (
    <aside className="sticky top-0 h-screen w-64 shrink-0 border-r border-slate-200 bg-white">
      <div className="px-4 py-5">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <nav className="space-y-1 px-3">
        {items.map((item) => (
          <button
            key={item.id}
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
