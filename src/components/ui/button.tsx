import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
};

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-800 text-white border border-emerald-800 hover:bg-emerald-900 active:bg-emerald-950",
  secondary:
    "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 active:bg-slate-100",
  ghost: "bg-transparent text-slate-700 border border-transparent hover:bg-slate-100 active:bg-slate-200",
  danger: "bg-rose-700 text-white border border-rose-700 hover:bg-rose-800 active:bg-rose-900",
};

const sizeClass = {
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-xs",
};

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition min-h-[44px] disabled:cursor-not-allowed disabled:opacity-50 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...props}
    />
  );
}
