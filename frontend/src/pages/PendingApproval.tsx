import React from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const PendingApproval = () => {
  const { logout, user, refreshUser } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    const checkStatus = async () => {
      await refreshUser();
      if (user?.status === "active") {
        navigate("/dashboard");
      }
    };

    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [user?.status, navigate, refreshUser]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="text-white" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Approval Pending
          </h1>
          <p className="text-indigo-100">
            Your account is waiting for administrator approval
          </p>
        </div>

        <div className="p-8">
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
              <ShieldCheck className="text-amber-600 flex-shrink-0 mt-1" size={24} />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">
                  What happens next?
                </h3>
                <p className="text-sm text-amber-800 leading-relaxed">
                  Our team reviews all organization requests to ensure platform security. You will receive an email notification once your account has been approved.
                </p>
              </div>
            </div>

            <div className="text-center space-y-4">
              <p className="text-slate-600 text-sm">
                Signed in as <span className="font-semibold text-slate-900">{user?.email}</span>
              </p>
              
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition-colors w-full justify-center"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
