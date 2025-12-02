// API Configuration
export const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8000";

export const API_ENDPOINTS = {
  BASE_URL: API_BASE_URL,
  AUTH: {
    SIGNIN: `${API_BASE_URL}/auth/signin`,
    SIGNUP: `${API_BASE_URL}/auth/signup`,
    SIGNOUT: `${API_BASE_URL}/auth/signout`,
    REFRESH: `${API_BASE_URL}/auth/refresh`,
    ME: `${API_BASE_URL}/auth/me`,
    INVITE_USER: `${API_BASE_URL}/auth/invite-user`,
    APPROVE_ORG_ADMIN: `${API_BASE_URL}/auth/approve-org-admin`,
    PENDING_ORG_ADMINS: `${API_BASE_URL}/auth/pending-org-admins`,
    PASSWORD_RESET: `${API_BASE_URL}/auth/password-reset-request`,
    UPDATE_PASSWORD: `${API_BASE_URL}/auth/update-password`,
    ORGANIZATION_SETUP: `${API_BASE_URL}/auth/organization-setup`,
  },
  ORGANIZATIONS: {
    LIST: `${API_BASE_URL}/organizations`,
    DETAIL: (id: string) => `${API_BASE_URL}/organizations/${id}`,
  },
  MESSAGING: {
    CONVERSATIONS: `${API_BASE_URL}/messaging/conversations`,
    MEMBERS: `${API_BASE_URL}/messaging/members`,
    START_CONVERSATION: (userId: string) => `${API_BASE_URL}/messaging/conversations/${userId}/start`,
    MESSAGES: (conversationId: string) => `${API_BASE_URL}/messaging/conversations/${conversationId}/messages`,
    SEND_MESSAGE: `${API_BASE_URL}/messaging/messages`,
    UPDATE_MESSAGE: (messageId: string) => `${API_BASE_URL}/messaging/messages/${messageId}`,
    DELETE_MESSAGE: (messageId: string) => `${API_BASE_URL}/messaging/messages/${messageId}`,
    ADD_REACTION: (messageId: string) => `${API_BASE_URL}/messaging/messages/${messageId}/reactions`,
    REMOVE_REACTION: (messageId: string, emoji: string) => `${API_BASE_URL}/messaging/messages/${messageId}/reactions/${emoji}`,
    PIN_MESSAGE: (conversationId: string) => `${API_BASE_URL}/messaging/conversations/${conversationId}/pin`,
    UNPIN_MESSAGE: (conversationId: string, messageId: string) => `${API_BASE_URL}/messaging/conversations/${conversationId}/pin/${messageId}`,
    PINNED_MESSAGES: (conversationId: string) => `${API_BASE_URL}/messaging/conversations/${conversationId}/pinned`,
  },
};

// Supabase Configuration
// Note: Environment variables in Create React App must be prefixed with REACT_APP_
// and the app must be restarted after adding/changing .env variables
export const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Log configuration status (only in development)
if (process.env.NODE_ENV === 'development') {
  if (!SUPABASE_URL) {
    console.warn(
      '⚠️  REACT_APP_SUPABASE_URL is not set. Real-time messaging will not work.\n' +
        '   Please add it to your .env file in the frontend directory:\n' +
        '   REACT_APP_SUPABASE_URL=https://your-project.supabase.co'
    );
  }
  if (!SUPABASE_ANON_KEY) {
    console.warn(
      '⚠️  REACT_APP_SUPABASE_ANON_KEY is not set. Real-time messaging will not work.\n' +
        '   Please add it to your .env file in the frontend directory:\n' +
        '   REACT_APP_SUPABASE_ANON_KEY=your-anon-key'
    );
  }
}
