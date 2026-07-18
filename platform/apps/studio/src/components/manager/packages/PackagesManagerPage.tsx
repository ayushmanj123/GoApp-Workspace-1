import { Outlet } from "react-router-dom";
import styles from "./packages-manager.module.css";

export function PackagesManagerPage() {
  return (
    <div className={styles.page}>
      <Outlet />
    </div>
  );
}
