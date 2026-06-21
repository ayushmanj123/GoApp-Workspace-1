import { Routes, Route, Navigate } from "react-router-dom";
import { StudioLayout } from "./components/layout/StudioLayout";

export default function App() {
  return (
    <Routes>
      {/* All studio routes share the same layout; URL params drive selection */}
      <Route path="/studio" element={<StudioLayout />} />
      <Route path="/studio/apps/:applicationId" element={<StudioLayout />} />
      <Route
        path="/studio/apps/:applicationId/screens/:screenId"
        element={<StudioLayout />}
      />
      <Route path="/" element={<Navigate to="/studio" replace />} />
      <Route path="*" element={<Navigate to="/studio" replace />} />
    </Routes>
  );
}
