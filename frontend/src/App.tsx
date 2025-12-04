import { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import MeetingRoom from "./pages/MeetingRoom";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import OrganizationSetup from "./pages/OrganizationSetup";
import CompleteOrganizationSetup from "./pages/CompleteOrganizationSetup";
import PendingApproval from "./pages/PendingApproval";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { MeetingProvider } from "./contexts/MeetingContext";
import IncomingCallOverlay from "./components/IncomingCallOverlay";

// Simple Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect pending users without organization to setup page
  if (
    user?.status === "pending" &&
    !user?.organization_id &&
    window.location.pathname !== "/complete-organization-setup"
  ) {
    return <Navigate to="/complete-organization-setup" replace />;
  }

  // Redirect pending users with organization to pending approval page
  if (
    user?.status === "pending" &&
    user?.organization_id &&
    window.location.pathname !== "/pending-approval"
  ) {
    return <Navigate to="/pending-approval" replace />;
  }

  // Redirect active users away from pending/setup pages
  if (
    user?.status === "active" &&
    (window.location.pathname === "/pending-approval" ||
      window.location.pathname === "/complete-organization-setup")
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <MeetingProvider>
            <IncomingCallOverlay />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/organization-setup"
                element={<OrganizationSetup />}
              />
              <Route
                path="/complete-organization-setup"
                element={<CompleteOrganizationSetup />}
              />

              {/* Protected Routes */}
              <Route
                path="/pending-approval"
                element={
                  <ProtectedRoute>
                    <PendingApproval />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              {/* Standalone Protected Route */}
              <Route
                path="/meeting/:id"
                element={
                  <ProtectedRoute>
                    <MeetingRoom />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MeetingProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
