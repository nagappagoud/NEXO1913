import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration provided for Project ID qqjfpimvewpchyoxnjht
export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://qqjfpimvewpchyoxnjht.supabase.co';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxamZwaW12ZXdwY2h5b3huamh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNzUzODAsImV4cCI6MjEwMDc1MTM4MH0.CgBDkU5H5kT4QWpv845EKAMuUbfoLgzRkZkPfQR7zNY';
export const SUPABASE_PROJECT_ID = 'qqjfpimvewpchyoxnjht';

let supabaseClientInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClientInstance) {
    supabaseClientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClientInstance;
}

export const supabase = getSupabase();
