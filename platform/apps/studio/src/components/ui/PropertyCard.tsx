import type { ReactNode } from "react";
import styles from "./PropertyCard.module.css";

interface PropertyCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function PropertyCard({ title, children, className }: PropertyCardProps) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(" ")}>
      <div className={styles.header}>{title}</div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
