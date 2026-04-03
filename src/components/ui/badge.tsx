import React from "react";

type BadgeTone = "default" | "success" | "warning" | "danger" | "info";

type BadgeProps = {
  children: React.ReactNode;
  tone?: BadgeTone;
};

const toneClass: Record<BadgeTone, string> = {
  default: "bg-slate-100 text-slate-700 border-slate-200",
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  danger: "bg-rose-100 text-rose-800 border-rose-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
};

export function Badge({ children, tone = "default" }: BadgeProps) {
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${toneClass[tone]}`}>{children}</span>;
}
