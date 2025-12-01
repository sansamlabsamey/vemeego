
import { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import OrganizationAdminDashboard from "./pages/OrganizationAdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import MeetingRoom from "./pages/MeetingRoom";
import Chat from "./pages/Chat";
import Files from "./pages/Files";
import Settings from "./pages/Settings";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import CalendarPage from "./pages/CalendarPage";

// Simple Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Login />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/orgdashboard" element={<OrganizationAdminDashboard />} />
            <Route path="/admindashboard" element={<SuperAdminDashboard />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/files" element={<Files />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          
          {/* Standalone Protected Route */}
          <Route path="/meeting/:id" element={<ProtectedRoute><MeetingRoom /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
