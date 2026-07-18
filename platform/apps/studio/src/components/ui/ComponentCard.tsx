import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import styles from "./ComponentCard.module.css";

interface ComponentCardProps {
  title: string;
  description: string;
  tag?: string;
  icon?: ReactNode;
  onAdd?: () => void;
}

export function ComponentCard({
  title,
  description,
  tag,
  icon,
  onAdd,
}: ComponentCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {icon ? <div className={styles.iconWrap}>{icon}</div> : null}
        {tag ? <Badge variant="default">{tag}</Badge> : null}
      </div>
      <div className={styles.title}>{title}</div>
      <div className={styles.description}>{description}</div>
      <div className={styles.footer}>
        <Button variant="outlined" size="sm" className={styles.addBtn} onClick={onAdd}>
          + Add to App
        </Button>
      </div>
    </div>
  );
}
