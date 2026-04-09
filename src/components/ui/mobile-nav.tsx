import React from "react";

type NavItem = {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  count?: number;
};

type MobileHeaderProps = {
  title: string;
  subtitle: string;
  notificationCount?: number;
  onNotificationClick?: () => void;
};

export function MobileHeader({
  title,
  subtitle,
  notificationCount,
  onNotificationClick,
}: MobileHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>
      {onNotificationClick ? (
        <button
          onClick={onNotificationClick}
          className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100"
        >
          <span className="text-lg">🔔</span>
          {typeof notificationCount === "number" && notificationCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          ) : null}
        </button>
      ) : null}
    </header>
  );
}

type MobileBottomNavProps = {
  items: NavItem[];
  activeId: string;
};

export function MobileBottomNav({ items, activeId }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      style={{ height: "64px" }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={item.onClick}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition ${
            activeId === item.id
              ? "text-emerald-800 font-semibold"
              : "text-slate-500"
          }`}
        >
          <span className="relative text-lg">
            {item.icon}
            {typeof item.count === "number" && item.count > 0 ? (
              <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-600 px-0.5 text-[9px] font-bold text-white">
                {item.count > 99 ? "99+" : item.count}
              </span>
            ) : null}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
