import { Routes, Route, Navigate } from "react-router-dom";
import { StudioLayout } from "./components/layout/StudioLayout";
import { ManagerLayout } from "./components/manager/ManagerLayout";
import { AppsDashboard } from "./components/manager/apps/AppsDashboard";
import { DatabaseManagerPage } from "./components/manager/database/DatabaseManagerPage";
import { TablesListView } from "./components/manager/database/TablesListView";
import { TablePropertyView } from "./components/manager/database/TablePropertyView";
import { PackagesManagerPage } from "./components/manager/packages/PackagesManagerPage";
import { PackagesListView } from "./components/manager/packages/PackagesListView";
import { PackageDetailView } from "./components/manager/packages/PackageDetailView";
import { EnvironmentsManagerPage } from "./components/manager/environments/EnvironmentsManagerPage";
import { ConnectorsManagerPage } from "./components/manager/connectors/ConnectorsManagerPage";
import { ConnectorsListView } from "./components/manager/connectors/ConnectorsListView";
import { ConnectorDetailView } from "./components/manager/connectors/ConnectorDetailView";
import { WorkflowsManagerPage } from "./components/manager/workflows/WorkflowsManagerPage";
import { WorkflowsListView } from "./components/manager/workflows/WorkflowsListView";
import { WorkflowDetailView } from "./components/manager/workflows/WorkflowDetailView";
import { ExcelAppsPage } from "./components/manager/excel-apps/ExcelAppsPage";
import { LoginPage } from "./auth/LoginPage";
import { RequireAuth } from "./auth/RequireAuth";

export default function App() {
  return (
    <Routes>
      <Route path="/studio/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/studio" element={<ManagerLayout />}>
          <Route index element={<AppsDashboard />} />
          <Route path="database" element={<DatabaseManagerPage />}>
            <Route index element={<TablesListView />} />
            <Route path="tables/:entityId" element={<TablePropertyView />} />
          </Route>
          <Route path="excel-apps" element={<ExcelAppsPage />} />
          <Route path="connectors" element={<ConnectorsManagerPage />}>
            <Route index element={<ConnectorsListView />} />
            <Route path=":connectorId" element={<ConnectorDetailView />} />
          </Route>
          <Route path="packages" element={<PackagesManagerPage />}>
            <Route index element={<PackagesListView />} />
            <Route path=":packageId" element={<PackageDetailView />} />
          </Route>
          <Route path="workflows" element={<WorkflowsManagerPage />}>
            <Route index element={<WorkflowsListView />} />
            <Route path=":workflowId" element={<WorkflowDetailView />} />
          </Route>
          <Route path="environments" element={<EnvironmentsManagerPage />} />
        </Route>
        <Route path="/studio/components" element={<StudioLayout />} />
        <Route path="/studio/apps/:applicationId" element={<StudioLayout />} />
        <Route
          path="/studio/apps/:applicationId/screens/:screenId"
          element={<StudioLayout />}
        />
      </Route>
      <Route path="/" element={<Navigate to="/studio" replace />} />
      <Route path="*" element={<Navigate to="/studio" replace />} />
    </Routes>
  );
}
