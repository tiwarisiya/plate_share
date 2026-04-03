import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>{children}</section>;
}

export function CardHeader({ children, className = "" }: CardProps) {
  return <header className={`border-b border-slate-200 px-4 py-3 ${className}`}>{children}</header>;
}

export function CardBody({ children, className = "" }: CardProps) {
  return <div className={`px-4 py-4 ${className}`}>{children}</div>;
}
