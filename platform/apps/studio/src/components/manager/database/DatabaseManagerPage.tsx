import { Outlet } from "react-router-dom";
import { TenantTablesProvider } from "./TenantTablesContext";
import styles from "./DatabaseManagerPage.module.css";

export function DatabaseManagerPage() {
  return (
    <TenantTablesProvider>
      <div className={styles.page}>
        <Outlet />
      </div>
    </TenantTablesProvider>
  );
}
