import { Outlet } from "react-router-dom";
import styles from "./connectors-manager.module.css";

export function ConnectorsManagerPage() {
  return (
    <div className={styles.page}>
      <Outlet />
    </div>
  );
}
