import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ApplicationPage from "./pages/application-page";
import ScreenPage from "./pages/screen-page";
import registerRuntime from "./registry-bridge";

registerRuntime();

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/playground" replace />} />
        <Route
          path="/playground"
          element={
            <div style={{ padding: 16 }}>
              <h2>Runtime Playground</h2>
              <p>Open /apps/:applicationId to view an app.</p>
            </div>
          }
        />
        <Route path="/apps/:applicationId" element={<ApplicationPage />} />
        <Route
          path="/apps/:applicationId/screens/:screenId"
          element={<ScreenPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}
