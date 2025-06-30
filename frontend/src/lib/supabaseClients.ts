import { createClient } from '@supabase/supabase-js';

// Obtiene la URL y la clave anónima de las variables de entorno de Vite.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Valida que las variables de entorno estén definidas.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be defined in your .env file");
}

// Crea y exporta el cliente de Supabase.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
