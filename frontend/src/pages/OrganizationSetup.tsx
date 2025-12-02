import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Video,
  Building2,
  FileText,
  Check,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Users,
  HardDrive,
  Clock,
  Sparkles,
} from "lucide-react";
import { API_ENDPOINTS } from "../config";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: string;
  period: string;
  description: string;
  features: PlanFeature[];
  popular?: boolean;
  maxUsers: string;
  storage: string;
  meetingDuration: string;
}

const OrganizationSetup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<string>("PRO");
  const [formData, setFormData] = useState({
    organization_name: "",
    organization_description: "",
    max_users: "",
    max_storage_gb: "",
  });

  // Get user info from location state or localStorage
  const userId =
    location.state?.userId || localStorage.getItem("signup_user_id");
  const email = location.state?.email || localStorage.getItem("signup_email");

  const plans: Plan[] = [
    {
      id: "STARTER",
      name: "Starter",
      displayName: "Starter",
      price: "$0",
      period: "/month",
      description: "Perfect for individuals and small projects.",
      maxUsers: "Up to 100 participants",
      storage: "Basic storage",
      meetingDuration: "40 minutes per meeting",
      features: [
        { text: "Up to 40 minutes per meeting", included: true },
        { text: "100 participants", included: true },
        { text: "Unlimited 1:1 meetings", included: true },
        { text: "Basic AI summaries", included: true },
        { text: "Cloud recording", included: false },
        { text: "Advanced AI Assistant", included: false },
      ],
    },
    {
      id: "PRO",
      name: "Pro",
      displayName: "Pro",
      price: "$20",
      period: "/month",
      description: "For growing teams that need more power.",
      maxUsers: "Up to 150 participants",
      storage: "10GB cloud storage",
      meetingDuration: "Unlimited duration",
      popular: true,
      features: [
        { text: "Unlimited meeting duration", included: true },
        { text: "Up to 150 participants in webinar", included: true },
        { text: "Cloud recording (10GB)", included: true },
        { text: "Advanced AI Assistant", included: true },
        { text: "Custom branding", included: true },
        { text: "Priority support", included: false },
      ],
    },
    {
      id: "BUSINESS",
      name: "Business",
      displayName: "Business",
      price: "$60",
      period: "/month",
      description: "Advanced control and support for large orgs.",
      maxUsers: "Up to 500 participants",
      storage: "Unlimited storage",
      meetingDuration: "Unlimited duration",
      features: [
        { text: "Up to 500 participants in webinar", included: true },
        { text: "Unlimited cloud recording", included: true },
        { text: "In-meeting AI assistant", included: true },
        { text: "Transcript translation", included: true },
        { text: "24/7 Priority Support", included: true },
        { text: "Dedicated account manager", included: true },
      ],
    },
  ];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.organization_name) {
      setError("Organization name is required");
      return;
    }

    if (!userId) {
      setError("User information not found. Please sign up again.");
      navigate("/signup");
      return;
    }

    setLoading(true);

    try {
      // First, we need to sign in to get the access token
      // Since the user just signed up, they need to authenticate
      setError("Please log in to complete organization setup");

      // Store organization setup data for after login
      localStorage.setItem(
        "pending_org_setup",
        JSON.stringify({
          organization_name: formData.organization_name,
          organization_description: formData.organization_description,
          selected_plan: selectedPlan,
          max_users: formData.max_users,
          max_storage_gb: formData.max_storage_gb,
        }),
      );

      setTimeout(() => {
        navigate("/login", {
          state: {
            message: "Please log in to complete your organization setup",
            redirectTo: "/complete-organization-setup",
          },
        });
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Organization setup failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Video size={16} className="text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">Lumina</span>
          </Link>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <Check className="text-white" size={16} />
            </div>
            <span className="text-sm font-medium text-slate-700">
              Account Created
            </span>
          </div>
          <div className="w-12 h-0.5 bg-indigo-200"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">2</span>
            </div>
            <span className="text-sm font-medium text-indigo-600">
              Organization Setup
            </span>
          </div>
          <div className="w-12 h-0.5 bg-slate-200"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-slate-400 font-semibold text-sm">3</span>
            </div>
            <span className="text-sm font-medium text-slate-400">Approval</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-20">
        {success ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="text-green-600" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">
                  Setup Complete!
                </h2>
                <p className="text-slate-600 mb-6">
                  Your organization has been created. You will receive an email
                  once a super-admin approves your request.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>What's next?</strong> Our team will review your
                    request within 24 hours. Once approved, you'll have full
                    access to your organization dashboard.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/login")}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Go to Login <ArrowRight size={20} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Title Section */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-slate-900 mb-4">
                Choose Your Plan
              </h1>
              <p className="text-lg text-slate-600">
                Select the plan that best fits your team's needs
              </p>
            </div>

            {/* Plans Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative p-8 rounded-2xl cursor-pointer transition-all ${
                    selectedPlan === plan.id
                      ? "bg-white border-2 border-indigo-600 shadow-xl scale-105"
                      : "bg-white border-2 border-slate-200 hover:border-indigo-300 shadow-md"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="px-4 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold uppercase tracking-wide">
                        Most Popular
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                      {plan.displayName}
                    </h3>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-4xl font-bold text-slate-900">
                        {plan.price}
                      </span>
                      <span className="text-slate-500">{plan.period}</span>
                    </div>
                    <p className="text-sm text-slate-600">{plan.description}</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                      <Users size={16} className="mt-0.5 flex-shrink-0" />
                      <span>{plan.maxUsers}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                      <HardDrive size={16} className="mt-0.5 flex-shrink-0" />
                      <span>{plan.storage}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                      <Clock size={16} className="mt-0.5 flex-shrink-0" />
                      <span>{plan.meetingDuration}</span>
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        {feature.included ? (
                          <Check
                            size={16}
                            className={`mt-0.5 flex-shrink-0 ${
                              selectedPlan === plan.id
                                ? "text-indigo-600"
                                : "text-green-500"
                            }`}
                          />
                        ) : (
                          <div className="w-4 h-4 mt-0.5 flex-shrink-0"></div>
                        )}
                        <span
                          className={
                            feature.included
                              ? "text-slate-700"
                              : "text-slate-400"
                          }
                        >
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {selectedPlan === plan.id && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
                        <CheckCircle size={16} />
                        <span>Selected Plan</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Organization Details Form */}
            <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  Organization Details
                </h2>
                <p className="text-slate-600">
                  Tell us about your organization
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                  <AlertCircle
                    className="text-red-500 flex-shrink-0 mt-0.5"
                    size={20}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">Error</p>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={20}
                    />
                    <input
                      type="text"
                      name="organization_name"
                      required
                      value={formData.organization_name}
                      onChange={handleChange}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                      placeholder="Acme Corporation"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Organization Description
                  </label>
                  <div className="relative">
                    <FileText
                      className="absolute left-4 top-4 text-slate-400"
                      size={20}
                    />
                    <textarea
                      name="organization_description"
                      value={formData.organization_description}
                      onChange={handleChange}
                      rows={4}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-none"
                      placeholder="Brief description of your organization..."
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Maximum Users
                    </label>
                    <input
                      type="number"
                      name="max_users"
                      min="1"
                      value={formData.max_users}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                      placeholder="e.g., 50"
                      disabled={loading}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Leave empty to use plan default
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Maximum Storage (GB)
                    </label>
                    <input
                      type="number"
                      name="max_storage_gb"
                      min="1"
                      value={formData.max_storage_gb}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                      placeholder="e.g., 100"
                      disabled={loading}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Leave empty to use plan default
                    </p>
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles
                      className="text-indigo-600 flex-shrink-0 mt-0.5"
                      size={20}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-indigo-900 mb-1">
                        Selected Plan:{" "}
                        {plans.find((p) => p.id === selectedPlan)?.displayName}
                      </p>
                      <p className="text-sm text-indigo-700">
                        Your account will be pending until approved by our admin
                        team. You'll receive an email notification once
                        approved.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Complete Setup <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OrganizationSetup;
