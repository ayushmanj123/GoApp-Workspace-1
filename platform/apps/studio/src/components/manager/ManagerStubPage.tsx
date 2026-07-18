import styles from "./ManagerStubPage.module.css";

interface ManagerStubPageProps {
  title: string;
  description: string;
}

export function ManagerStubPage({ title, description }: ManagerStubPageProps) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      <span className={styles.badge}>Coming soon</span>
    </div>
  );
}
