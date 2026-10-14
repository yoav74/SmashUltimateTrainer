import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Public values: the anon key is meant to be in the browser; row-level security in the database
// (supabase/migrations) is what keeps each user's data private.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null until Supabase is configured; the site then works without accounts. */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } }) : null;

export const accountsEnabled = supabase !== null;
