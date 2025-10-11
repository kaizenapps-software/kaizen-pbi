import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./ui/AppShell";
import BiDashboardPage from "./pages/BiDashboardPage";
import { initTheme } from "./lib/theme";
import Login from "./pages/Login";
import RequireAuth from "./routes/RequireAuth";
import BackForwardGuard from "./components/BackForwardGuard";
import { AuthProvider } from "./auth/AuthContext";
import ProfilePage from "./pages/ProfilePage.jsx";
import ChatFab from "./components/ChatFab";

function Placeholder({ title }) {
  return (
    <div className="card p-6">
      <div className="text-lg font-semibold">{title}</div>
      <p className="text-muted mt-1">Pronto aquí tu módulo Kaizen.</p>
    </div>
  );
}

export default function App() {
  useEffect(() => initTheme(), []);
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <>
              <BackForwardGuard enabled />
              <Login />
            </>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          element={
            <RequireAuth>
              <>
                <AppShell />
                <ChatFab
                  apiBase={import.meta.env.VITE_API_BASE || "https://kaizen-pbi.onrender.com"}
                  webBase="https://kaizenapps.net/gpt"
                  label="Asistente"
                  theme="dark"
                />
              </>
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<BiDashboardPage />} />
          <Route path="/reports/costos" element={<Placeholder title="Costos" />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
