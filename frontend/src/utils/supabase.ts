import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

// Validate Supabase configuration
if (!SUPABASE_URL || SUPABASE_URL === '') {
  console.warn(
    '⚠️  SUPABASE_URL is not set. Please add REACT_APP_SUPABASE_URL to your .env file.'
  );
}

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === '') {
  console.warn(
    '⚠️  SUPABASE_ANON_KEY is not set. Please add REACT_APP_SUPABASE_ANON_KEY to your .env file.'
  );
}

// Create Supabase client for Realtime
// Only create if both URL and key are provided
export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

// Function to authenticate Supabase client with user's JWT
export const authenticateSupabaseClient = async (accessToken: string, refreshToken?: string): Promise<void> => {
  if (!supabase) {
    console.warn('⚠️ Supabase client not initialized');
    return;
  }
  
  // CRITICAL: For Realtime Authorization (private channels), we MUST set the auth token
  // on the realtime connection. This must happen BEFORE subscribing to private channels.
  // The token must be a valid Supabase JWT (which it is, since backend uses Supabase Auth).
  
  // Set the session for Supabase Auth first
  // This ensures auth.uid() works correctly in RLS policies
  try {
    if (refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        console.error('Failed to set Supabase session:', error);
        // Fallback to realtime auth only
        supabase.realtime.setAuth(accessToken);
      } else {
        console.log('✅ Supabase session set successfully');
        // CRITICAL: Also set auth on realtime connection after session is set
        // This is REQUIRED for Broadcast authorization (private channels)
        // The token must be set on the realtime connection, not just the auth session
        supabase.realtime.setAuth(accessToken);
        console.log('✅ Realtime auth also set after session');
      }
    } else {
      // If no refresh token, still set auth token for realtime
      // This is required for private channels to work
      supabase.realtime.setAuth(accessToken);
      console.log('✅ Supabase realtime auth set');
    }
  } catch (error) {
    console.error('Error authenticating Supabase client:', error);
    // Fallback: try realtime auth only
    try {
      supabase.realtime.setAuth(accessToken);
      console.log('✅ Fallback: Supabase realtime auth set');
    } catch (realtimeError) {
      console.error('Failed to set realtime auth:', realtimeError);
    }
  }
};
