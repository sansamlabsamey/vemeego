import { useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import SuperAdminDashboard from "./SuperAdminDashboard";
import OrganizationAdminDashboard from "./OrganizationAdminDashboard";
import UserDashboard from "./UserDashboard";
import Layout from "../components/Layout";

const Dashboard = () => {
  const { user, isLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "dashboard";

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">No user data available</p>
        </div>
      </div>
    );
  }

  const renderDashboard = () => {
    switch (user.role) {
      case "super-admin":
        return <SuperAdminDashboard activeTab={activeTab} />;
      case "org-admin":
        return <OrganizationAdminDashboard activeTab={activeTab} />;
      case "user":
        return <UserDashboard activeTab={activeTab} />;
      default:
        return (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-600">Invalid user role</p>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderDashboard()}
    </Layout>
  );
};

export default Dashboard;
