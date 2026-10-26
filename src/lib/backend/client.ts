/**
 * Supabase client — created only when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
 * The anon key is public by design; Row Level Security (supabase/migrations) protects every table.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const backendConfigured = Boolean(url && anon);

export const supabase: SupabaseClient | null = backendConfigured
  ? createClient(url!, anon!, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'haneul-auth' },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;
