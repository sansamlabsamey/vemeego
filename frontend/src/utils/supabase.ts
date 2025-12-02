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
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      })
    : null;


