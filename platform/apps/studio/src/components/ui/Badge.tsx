import type { ReactNode } from "react";
import styles from "./Badge.module.css";

type BadgeVariant = "default" | "primary" | "premium" | "ai";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span className={[styles.badge, styles[variant]].join(" ")}>{children}</span>
  );
}
