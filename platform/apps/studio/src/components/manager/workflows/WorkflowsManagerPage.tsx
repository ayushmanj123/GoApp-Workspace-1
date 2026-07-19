import { Outlet } from "react-router-dom";
import styles from "../connectors/connectors-manager.module.css";

export function WorkflowsManagerPage() {
  return (
    <div className={styles.page}>
      <Outlet />
    </div>
  );
}
