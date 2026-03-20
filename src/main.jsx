// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import AppPage from "./pages/App.jsx";

// Route guard — redirects unauthenticated users to /login
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f4f0e8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'VT323',monospace", fontSize: 24, color: "#8a6a00" }}>
      ◈ Loading...
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/app"   element={<PrivateRoute><AppPage /></PrivateRoute>} />
          <Route path="/"      element={<Navigate to="/app" replace />} />
          <Route path="*"      element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
