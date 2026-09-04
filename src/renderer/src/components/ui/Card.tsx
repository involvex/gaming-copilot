import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  border?: boolean;
}

export function Card({
  children,
  padding = "md",
  border = true,
  className = "",
  ...props
}: CardProps) {
  const paddingClass = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  }[padding];

  const borderClass = border ? "border" : "";

  return (
    <div className={`card ${paddingClass} ${borderClass} ${className}`} {...props}>
      {children}
    </div>
  );
}
