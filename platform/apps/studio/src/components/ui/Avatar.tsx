import styles from "./Avatar.module.css";

interface AvatarProps {
  initials: string;
  size?: "sm" | "md";
  title?: string;
}

export function Avatar({ initials, size = "md", title }: AvatarProps) {
  return (
    <div
      className={[styles.avatar, size === "sm" ? styles.sm : ""].filter(Boolean).join(" ")}
      title={title}
    >
      {initials}
    </div>
  );
}
