import { Outlet } from "react-router-dom";
import { ManagerTopBar } from "./ManagerTopBar";
import { ManagerSidebar } from "./ManagerSidebar";
import styles from "./ManagerLayout.module.css";

export function ManagerLayout() {
  return (
    <div className={styles.root}>
      <ManagerTopBar />
      <div className={styles.body}>
        <ManagerSidebar />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
