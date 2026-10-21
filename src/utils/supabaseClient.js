import { createClient } from '@supabase/supabase-js';

// Both values are public (they ship to every browser); row-level security protects the data.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('[Supabase] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env');
}

export const supabase = createClient(url, anonKey);
